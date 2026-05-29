import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Rider } from '@/types/database';
import { toast } from 'sonner';

export function useRiders() {
  return useQuery({
    queryKey: ['riders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('riders' as never)
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data as Rider[];
    },
  });
}

export function useAddRider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone?: string }) => {
      const { data, error } = await supabase
        .from('riders' as never)
        .insert([{ name, phone }] as never)
        .select()
        .single();
      
      if (error) throw error;
      return data as Rider;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riders'] });
      toast.success('Rider berhasil ditambahkan');
    },
    onError: (error: Error) => {
      toast.error('Gagal menambahkan rider: ' + error.message);
    },
  });
}

export function useDeleteRider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('riders' as never)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['riders'] });
      toast.success('Rider berhasil dihapus');
    },
    onError: (error: Error) => {
      toast.error('Gagal menghapus rider: ' + error.message);
    },
  });
}

export function useUpdateRiderStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { data, error } = await supabase
        .from('riders' as never)
        .update({ is_active, updated_at: new Date().toISOString() } as never)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data as Rider;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['riders'] });
      const status = data.is_active ? 'aktif' : 'tidak aktif';
      toast.success(`Rider berhasil diubah menjadi ${status}`);
    },
    onError: (error: Error) => {
      toast.error('Gagal mengubah status rider: ' + error.message);
    },
  });
}
