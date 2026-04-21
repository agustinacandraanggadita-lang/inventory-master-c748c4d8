import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Distribution } from '@/types/database';
import { toast } from 'sonner';

export function useDistributions(date?: string, dateRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: ['distributions', date, dateRange],
    queryFn: async () => {
      let query = supabase
        .from('distributions' as never)
        .select(`
          *,
          rider:riders(*),
          batch:inventory_batches(
            *,
            product:products(*)
          )
        `)
        .order('distributed_at', { ascending: false })
        .range(0, 9999);
      
      // If date range provided, use it (for reports)
      if (dateRange) {
        query = query
          .gte('distributed_at', `${dateRange.start}T00:00:00`)
          .lte('distributed_at', `${dateRange.end}T23:59:59`);
      } 
      // Otherwise use single date (for daily view)
      else if (date) {
        const startOfDay = `${date}T00:00:00`;
        const endOfDay = `${date}T23:59:59`;
        query = query
          .gte('distributed_at', startOfDay)
          .lte('distributed_at', endOfDay);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Distribution[];
    },
  });
}

export function useRiderDistributions(riderId: string) {
  return useQuery({
    queryKey: ['rider-distributions', riderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distributions' as never)
        .select(`
          *,
          batch:inventory_batches(
            *,
            product:products(*)
          )
        `)
        .eq('rider_id', riderId)
        .order('distributed_at', { ascending: false });
      
      if (error) throw error;
      return data as Distribution[];
    },
    enabled: !!riderId,
  });
}

export function usePendingDistributions() {
  return useQuery({
    queryKey: ['pending-distributions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distributions' as never)
        .select(`
          *,
          rider:riders(*),
          batch:inventory_batches(
            *,
            product:products(*)
          )
        `)
        .order('distributed_at', { ascending: false });
      
      if (error) throw error;
      
      // Filter distribusi yang masih punya stok sisa (remaining > 0)
      const typed = data as Distribution[];
      return typed.filter(dist => {
        const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
        return remaining > 0;
      });
    },
  });
}

export function useAddDistribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rider_id,
      batch_id,
      quantity,
      distributed_at,
    }: {
      rider_id: string;
      batch_id: string;
      quantity: number;
      distributed_at?: string;
    }) => {
      // First get current batch quantity
      const { data: batchData, error: batchError } = await supabase
        .from('inventory_batches' as never)
        .select('current_quantity')
        .eq('id', batch_id)
        .single();

      if (batchError) throw batchError;
      
      const batch = batchData as { current_quantity: number };
      if (!batch) throw new Error('Batch tidak ditemukan');
      if (batch.current_quantity < quantity) {
        throw new Error('Stok tidak mencukupi');
      }

      // Update batch quantity
      const { error: updateError } = await supabase
        .from('inventory_batches' as never)
        .update({ current_quantity: batch.current_quantity - quantity } as never)
        .eq('id', batch_id);

      if (updateError) throw updateError;

      // Create distribution record
      const { data, error } = await supabase
        .from('distributions' as never)
        .insert([{
          rider_id,
          batch_id,
          quantity,
          distributed_at: distributed_at ? new Date(distributed_at).toISOString() : new Date().toISOString(),
          returned_quantity: 0,
          sold_quantity: 0,
          rejected_quantity: 0,
        }] as never)
        .select()
        .single();
      
      if (error) throw error;
      return data as Distribution;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Distribusi berhasil dicatat');
    },
    onError: (error: Error) => {
      toast.error('Gagal mencatat distribusi: ' + error.message);
    },
  });
}

export function useBulkDistribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rider_id,
      batch_ids,
      quantity_per_product,
      distributed_at,
    }: {
      rider_id: string;
      batch_ids: string[];
      quantity_per_product: number;
      distributed_at?: string;
    }) => {
      const results: Distribution[] = [];

      for (const batch_id of batch_ids) {
        // Get current batch quantity
        const { data: batchData, error: batchError } = await supabase
          .from('inventory_batches' as never)
          .select('current_quantity')
          .eq('id', batch_id)
          .single();

        if (batchError) throw batchError;
        
        const batch = batchData as { current_quantity: number } | null;
        if (!batch) continue;

        const actualQuantity = Math.min(batch.current_quantity, quantity_per_product);
        if (actualQuantity <= 0) continue;

        // Update batch quantity
        const { error: updateError } = await supabase
          .from('inventory_batches' as never)
          .update({ current_quantity: batch.current_quantity - actualQuantity } as never)
          .eq('id', batch_id);

        if (updateError) throw updateError;

        // Create distribution record
        const { data, error } = await supabase
          .from('distributions' as never)
          .insert([{
            rider_id,
            batch_id,
            quantity: actualQuantity,
            distributed_at: distributed_at ? new Date(distributed_at).toISOString() : new Date().toISOString(),
            returned_quantity: 0,
            sold_quantity: 0,
            rejected_quantity: 0,
          }] as never)
          .select()
          .single();
        
        if (error) throw error;
        results.push(data as Distribution);
      }

      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success(`${data.length} produk berhasil didistribusikan`);
    },
    onError: (error: Error) => {
      toast.error('Gagal mendistribusikan: ' + error.message);
    },
  });
}

export function useUpdateDistribution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      sold_quantity,
      returned_quantity,
      notes,
    }: {
      id: string;
      sold_quantity: number;
      returned_quantity: number;
      notes?: string;
    }) => {
      // Get current distribution
      const { data: distData, error: distError } = await supabase
        .from('distributions' as never)
        .select('batch_id, quantity, returned_quantity')
        .eq('id', id)
        .single();

      if (distError) throw distError;
      
      const dist = distData as { batch_id: string; quantity: number; returned_quantity: number } | null;
      if (!dist) throw new Error('Distribution not found');

      // If returning items, add them back to inventory
      if (returned_quantity > 0 && returned_quantity !== dist.returned_quantity) {
        const returnDiff = returned_quantity - (dist.returned_quantity || 0);
        
        const { data: batchData, error: batchError } = await supabase
          .from('inventory_batches' as never)
          .select('current_quantity')
          .eq('id', dist.batch_id)
          .single();

        if (batchError) throw batchError;
        
        const batch = batchData as { current_quantity: number } | null;
        if (batch) {
          await supabase
            .from('inventory_batches' as never)
            .update({ current_quantity: batch.current_quantity + returnDiff } as never)
            .eq('id', dist.batch_id);
        }
      }

      const { error } = await supabase
        .from('distributions' as never)
        .update({ sold_quantity, returned_quantity, notes } as never)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Data distribusi berhasil diperbarui');
    },
    onError: (error: Error) => {
      toast.error('Gagal memperbarui: ' + error.message);
    },
  });
}

export function useAdjustRiderStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      action,
      amount,
    }: {
      id: string;
      action: 'sell' | 'return' | 'reject';
      amount: number;
    }) => {
      console.log(`📝 useAdjustRiderStock.mutationFn called`, { id, action, amount });
      
      // Get current distribution with ALL quantity fields
      const { data: distData, error: distError } = await supabase
        .from('distributions')
        .select('batch_id, quantity, sold_quantity, returned_quantity, rejected_quantity, notes, rider_id')
        .eq('id', id)
        .single();

      if (distError) {
        console.error('❌ Failed to fetch distribution:', distError);
        throw distError;
      }

      const dist = distData as {
        batch_id: string;
        quantity: number;
        sold_quantity: number;
        returned_quantity: number;
        rejected_quantity: number;
        notes?: string;
        rider_id: string;
      } | null;

      if (!dist) {
        console.error('❌ Distribution not found:', id);
        throw new Error('Distribution not found');
      }

      console.log(`📦 Current distribution state:`, {
        total: dist.quantity,
        sold: dist.sold_quantity || 0,
        returned: dist.returned_quantity || 0,
        rejected: dist.rejected_quantity || 0,
      });

      if (amount <= 0) {
        throw new Error('Amount harus lebih besar dari 0');
      }

      // Calculate remaining with rider, considering ALL distributions (sold, returned, rejected)
      const remainingWithRider = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
      
      console.log(`🔍 Validation:`, { amount, remainingWithRider, isValid: amount <= remainingWithRider });
      
      if (amount > remainingWithRider) {
        throw new Error(`Jumlah melebihi stok rider saat ini. Diminta: ${amount}, Sisa: ${remainingWithRider} unit`);
      }

      if (action === 'sell') {
        const newSold = (dist.sold_quantity || 0) + amount;
        console.log(`💰 Marking as sold: ${dist.sold_quantity || 0} + ${amount} = ${newSold}`);
        
        const { error } = await supabase
          .from('distributions')
          .update({ sold_quantity: newSold })
          .eq('id', id);

        if (error) {
          console.error('❌ Failed to update sold_quantity:', error);
          throw error;
        }
        console.log(`✅ Updated sold_quantity to ${newSold}`);
        return;
      }

      if (action === 'return') {
        const newReturned = (dist.returned_quantity || 0) + amount;
        console.log(`🔄 Marking as returned: ${dist.returned_quantity || 0} + ${amount} = ${newReturned}`);

        // Add returned items back to inventory batch
        const { data: batchData, error: batchError } = await supabase
          .from('inventory_batches')
          .select('current_quantity')
          .eq('id', dist.batch_id)
          .single();

        if (batchError) {
          console.error('❌ Failed to fetch batch:', batchError);
          throw batchError;
        }

        const batch = batchData as { current_quantity: number } | null;
        if (batch) {
          const newBatchQty = batch.current_quantity + amount;
          console.log(`📦 Batch quantity: ${batch.current_quantity} + ${amount} = ${newBatchQty}`);
          
          const { error: updateBatchError } = await supabase
            .from('inventory_batches')
            .update({ current_quantity: newBatchQty })
            .eq('id', dist.batch_id);

          if (updateBatchError) {
            console.error('❌ Failed to update batch quantity:', updateBatchError);
            throw updateBatchError;
          }
          console.log(`✅ Updated batch quantity to ${newBatchQty}`);
        }

        const { error } = await supabase
          .from('distributions')
          .update({ returned_quantity: newReturned })
          .eq('id', id);

        if (error) {
          console.error('❌ Failed to update returned_quantity:', error);
          throw error;
        }
        console.log(`✅ Updated returned_quantity to ${newReturned}`);
        return;
      }

      if (action === 'reject') {
        // For rejects, track in rejected_quantity column
        // Items are NOT added back to inventory (they're damaged/lost)
        const newRejected = (dist.rejected_quantity || 0) + amount;
        console.log(`❌ Marking as rejected: ${dist.rejected_quantity || 0} + ${amount} = ${newRejected}`);

        const { error } = await supabase
          .from('distributions')
          .update({ 
            rejected_quantity: newRejected,
            rejected_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) {
          console.error('❌ Failed to update rejected_quantity:', error);
          throw error;
        }
        console.log(`✅ Updated rejected_quantity to ${newRejected}`);
        return;
      }
    },
    onSuccess: () => {
      console.log('🔄 Invalidating queries...');
      queryClient.invalidateQueries({ queryKey: ['distributions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-distributions'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Stok rider berhasil diperbarui');
    },
    onError: (error: Error) => {
      console.error('❌ Mutation failed:', error.message);
      toast.error('Gagal memperbarui stok rider: ' + error.message);
    },
  });
}
