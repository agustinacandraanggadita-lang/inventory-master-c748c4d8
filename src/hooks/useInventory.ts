import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { InventoryBatch, InventorySummary, Distribution } from '@/types/database';
import { toast } from 'sonner';

export function useInventoryBatches() {
  return useQuery({
    queryKey: ['inventory-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_batches' as never)
        .select(`
          *,
          product:products(*)
        `)
        .order('expiry_date', { ascending: true });
      
      if (error) throw error;
      return data as InventoryBatch[];
    },
  });
}

export function useAvailableBatches() {
  return useQuery({
    queryKey: ['available-batches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_batches' as never)
        .select(`
          *,
          product:products(*)
        `)
        .gt('current_quantity', 0)
        .order('expiry_date', { ascending: true });
      
      if (error) throw error;
      return data as InventoryBatch[];
    },
  });
}

export function useInventorySummary() {
  return useQuery({
    queryKey: ['inventory-summary'],
    queryFn: async () => {
      const { data: batches, error: batchError } = await supabase
        .from('inventory_batches' as never)
        .select(`
          *,
          product:products(*)
        `)
        .order('expiry_date', { ascending: true });

      if (batchError) throw batchError;

      const { data: distributions, error: distError } = await supabase
        .from('distributions' as never)
        .select('*');

      if (distError) throw distError;

      const typedBatches = batches as InventoryBatch[];
      const typedDistributions = distributions as Distribution[];

      // Group by product
      const summaryMap = new Map<string, InventorySummary>();

      for (const batch of typedBatches || []) {
        const productId = batch.product_id;
        const product = batch.product;

        if (!summaryMap.has(productId)) {
          summaryMap.set(productId, {
            product_id: productId,
            product_name: product?.name || 'Unknown',
            category: product?.category || 'product',
            total_in_inventory: 0,
            total_distributed: 0,
            total_sold: 0,
            total_returned: 0,
            total_rejected: 0,
            total_warehouse_rejected: 0,
            batches: [],
          });
        }

        const summary = summaryMap.get(productId)!;
        summary.total_in_inventory += batch.current_quantity;
        summary.total_warehouse_rejected += batch.warehouse_rejected_quantity || 0;
        summary.batches.push(batch);
      }

      // Add distribution data
      for (const dist of typedDistributions || []) {
        const batch = typedBatches?.find(b => b.id === dist.batch_id);
        if (batch) {
          const summary = summaryMap.get(batch.product_id);
          if (summary) {
            summary.total_distributed += dist.quantity;
            summary.total_sold += dist.sold_quantity || 0;
            summary.total_returned += dist.returned_quantity || 0;
            summary.total_rejected += dist.rejected_quantity || 0;
          }
        }
      }

      return Array.from(summaryMap.values());
    },
  });
}

export function useAddBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      product_id,
      production_date,
      expiry_date,
      initial_quantity,
    }: {
      product_id: string;
      production_date: string;
      expiry_date: string;
      initial_quantity: number;
    }) => {
      // Validate inputs
      const prodDate = new Date(production_date);
      const expDate = new Date(expiry_date);

      if (isNaN(prodDate.getTime()) || isNaN(expDate.getTime())) {
        throw new Error('Format tanggal tidak valid');
      }

      if (expDate < prodDate) {
        throw new Error('Tanggal expired harus lebih besar atau sama dengan tanggal produksi');
      }

      if (initial_quantity <= 0) {
        throw new Error('Jumlah produksi harus lebih dari 0');
      }

      const { data, error } = await supabase
        .from('inventory_batches' as never)
        .insert([{
          product_id,
          production_date,
          expiry_date,
          initial_quantity,
          current_quantity: initial_quantity,
        }] as never)
        .select()
        .single();
      
      if (error) {
        // Parse Supabase error for better user message
        if (error.message.includes('foreign key')) {
          throw new Error('Produk tidak ditemukan. Silakan pilih produk yang valid.');
        }
        throw error;
      }
      return data as InventoryBatch;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Batch produksi berhasil ditambahkan');
    },
    onError: (error: Error) => {
      console.error('Add batch error:', error);
      const errorMessage = error.message || 'Gagal menambahkan batch';
      toast.error(errorMessage);
    },
  });
}

export function useUpdateBatchQuantity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      quantity,
      expiry_date 
    }: { 
      id: string; 
      quantity: number;
      expiry_date?: string;
    }) => {
      const updateData: any = { current_quantity: quantity };
      if (expiry_date) {
        updateData.expiry_date = expiry_date;
      }
      
      const { error } = await supabase
        .from('inventory_batches' as never)
        .update(updateData as never)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
    },
  });
}
export function useRejectBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      quantity, 
      reason 
    }: { 
      id: string; 
      quantity: number; 
      reason: string 
    }) => {
      // Set current_quantity to 0 to mark as rejected
      // Use notes field to store rejection reason
      const { error } = await supabase
        .from('inventory_batches' as never)
        .update({ 
          current_quantity: 0,
          notes: `REJECTED: ${reason} at ${new Date().toISOString()}`
        } as never)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Batch berhasil dimusnahkan');
    },
    onError: (error: Error) => {
      toast.error('Gagal memusnahkan batch: ' + error.message);
    },
  });
}

export function useUpdateWarehouseReject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      quantity,
      reason
    }: { 
      id: string; 
      quantity: number;
      reason?: string;
    }) => {
      // First get current warehouse_rejected_quantity to add to it
      const { data: batchData, error: fetchError } = await supabase
        .from('inventory_batches' as never)
        .select('warehouse_rejected_quantity, current_quantity')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const batch = batchData as { warehouse_rejected_quantity: number; current_quantity: number } | null;
      if (!batch) throw new Error('Batch tidak ditemukan');

      if (quantity > batch.current_quantity) {
        throw new Error(`Jumlah reject (${quantity}) melebihi stok tersedia (${batch.current_quantity})`);
      }

      const newTotal = (batch.warehouse_rejected_quantity || 0) + quantity;

      // Add to warehouse_rejected_quantity (additive) and reduce current_quantity
      const { error } = await supabase
        .from('inventory_batches' as never)
        .update({ 
          warehouse_rejected_quantity: newTotal,
          current_quantity: batch.current_quantity - quantity,
          warehouse_rejected_at: new Date().toISOString(),
          notes: `WAREHOUSE_REJECTED: ${newTotal} pcs total${reason ? ' - ' + reason : ''} at ${new Date().toISOString()}`
        } as never)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-summary'] });
      toast.success('Data reject gudang berhasil diperbarui');
    },
    onError: (error: Error) => {
      toast.error('Gagal memperbarui reject gudang: ' + error.message);
    },
  });
}

