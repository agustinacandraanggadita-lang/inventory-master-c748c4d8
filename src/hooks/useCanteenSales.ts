import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CanteenSale, CanteenType } from '@/types/database';
import { toast } from 'sonner';

export function useCanteenSales(dateRange?: { start: string; end: string }) {
  return useQuery({
    queryKey: ['canteen-sales', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('canteen_sales' as never)
        .select('*')
        .order('sale_date', { ascending: false });

      if (dateRange) {
        query = query
          .gte('sale_date', dateRange.start)
          .lte('sale_date', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CanteenSale[];
    },
  });
}

export function useCanteenSalesByDate(date: string) {
  return useQuery({
    queryKey: ['canteen-sales-by-date', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('canteen_sales' as never)
        .select('*')
        .eq('sale_date', date)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CanteenSale[];
    },
  });
}

export function useCreateCanteenSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      canteen: CanteenType;
      cups_sold: number;
      sale_date: string;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('canteen_sales' as never)
        .insert([
          {
            canteen: data.canteen,
            cups_sold: data.cups_sold,
            sale_date: data.sale_date,
            notes: data.notes || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return result as CanteenSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-sales'] });
      queryClient.invalidateQueries({ queryKey: ['canteen-sales-by-date'] });
      toast.success('Data penjualan kantin berhasil ditambahkan');
    },
    onError: (error) => {
      console.error('Error adding canteen sale:', error);
      toast.error('Gagal menambahkan data penjualan kantin');
    },
  });
}

export function useUpdateCanteenSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      canteen?: CanteenType;
      cups_sold?: number;
      sale_date?: string;
      notes?: string;
    }) => {
      const { data: result, error } = await supabase
        .from('canteen_sales' as never)
        .update({
          ...(data.canteen && { canteen: data.canteen }),
          ...(data.cups_sold !== undefined && { cups_sold: data.cups_sold }),
          ...(data.sale_date && { sale_date: data.sale_date }),
          ...(data.notes !== undefined && { notes: data.notes }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.id)
        .select()
        .single();

      if (error) throw error;
      return result as CanteenSale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-sales'] });
      queryClient.invalidateQueries({ queryKey: ['canteen-sales-by-date'] });
      toast.success('Data penjualan kantin berhasil diperbarui');
    },
    onError: (error) => {
      console.error('Error updating canteen sale:', error);
      toast.error('Gagal memperbarui data penjualan kantin');
    },
  });
}

export function useDeleteCanteenSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('canteen_sales' as never)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['canteen-sales'] });
      queryClient.invalidateQueries({ queryKey: ['canteen-sales-by-date'] });
      toast.success('Data penjualan kantin berhasil dihapus');
    },
    onError: (error) => {
      console.error('Error deleting canteen sale:', error);
      toast.error('Gagal menghapus data penjualan kantin');
    },
  });
}
