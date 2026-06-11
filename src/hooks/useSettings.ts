import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DistributionSetting, GlobalDistributionDefault, ProductExpirySetting } from '@/types/database';
import { toast } from 'sonner';

// ========== RIDER DISTRIBUTION SETTINGS ==========

export function useRiderDistributionSettings(riderId?: string) {
  return useQuery({
    queryKey: ['distributionSettings', riderId],
    queryFn: async () => {
      if (!riderId) return [];
      
      const { data, error } = await supabase
        .from('distribution_settings' as never)
        .select(`
          *,
          product:products(*)
        `)
        .eq('rider_id', riderId);
      
      if (error) throw error;
      return data as DistributionSetting[];
    },
    enabled: !!riderId,
  });
}

export function useAllRiderDistributionSettings() {
  return useQuery({
    queryKey: ['allDistributionSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('distribution_settings' as never)
        .select(`
          *,
          rider:riders(*),
          product:products(*)
        `);
      
      if (error) throw error;
      return data as DistributionSetting[];
    },
  });
}

export function useUpsertRiderDistributionSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      rider_id,
      product_id,
      default_quantity,
    }: {
      rider_id: string;
      product_id: string;
      default_quantity: number;
    }) => {
      const { data, error } = await supabase
        .from('distribution_settings' as never)
        .upsert(
          { rider_id, product_id, default_quantity } as never,
          { onConflict: 'rider_id,product_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data as DistributionSetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributionSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allDistributionSettings'] });
      toast.success('Pengaturan distribusi rider berhasil disimpan');
    },
    onError: (error: Error) => {
      toast.error('Gagal menyimpan pengaturan: ' + error.message);
    },
  });
}

export function useDeleteRiderDistributionSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settingId: string) => {
      const { error } = await supabase
        .from('distribution_settings' as never)
        .delete()
        .eq('id', settingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['distributionSettings'] });
      queryClient.invalidateQueries({ queryKey: ['allDistributionSettings'] });
      toast.success('Pengaturan distribusi berhasil dihapus');
    },
    onError: (error: Error) => {
      toast.error('Gagal menghapus pengaturan: ' + error.message);
    },
  });
}

// ========== GLOBAL DISTRIBUTION DEFAULTS ==========

export function useGlobalDistributionDefaults() {
  return useQuery({
    queryKey: ['globalDistributionDefaults'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('global_distribution_defaults' as never)
        .select(`
          *,
          product:products(*)
        `);
      
      if (error) throw error;
      return data as GlobalDistributionDefault[];
    },
  });
}

export function useUpsertGlobalDistributionDefault() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      product_id,
      default_quantity,
    }: {
      product_id: string;
      default_quantity: number;
    }) => {
      const { data, error } = await supabase
        .from('global_distribution_defaults' as never)
        .upsert(
          { product_id, default_quantity } as never,
          { onConflict: 'product_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data as GlobalDistributionDefault;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['globalDistributionDefaults'] });
      toast.success('Pengaturan default global berhasil disimpan');
    },
    onError: (error: Error) => {
      toast.error('Gagal menyimpan pengaturan: ' + error.message);
    },
  });
}

// ========== PRODUCT EXPIRY SETTINGS ==========

export function useProductExpirySettings() {
  return useQuery({
    queryKey: ['productExpirySettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_expiry_settings' as never)
        .select(`
          *,
          product:products(*)
        `);
      
      if (error) throw error;
      return data as ProductExpirySetting[];
    },
  });
}

export function useUpsertProductExpirySetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      product_id,
      default_shelf_life_days,
    }: {
      product_id: string;
      default_shelf_life_days: number;
    }) => {
      const { data, error } = await supabase
        .from('product_expiry_settings' as never)
        .upsert(
          { product_id, default_shelf_life_days } as never,
          { onConflict: 'product_id' }
        )
        .select()
        .single();
      
      if (error) throw error;
      return data as ProductExpirySetting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['productExpirySettings'] });
      toast.success('Pengaturan masa expired produk berhasil disimpan');
    },
    onError: (error: Error) => {
      toast.error('Gagal menyimpan pengaturan: ' + error.message);
    },
  });
}

export function useGetDefaultShelfLife(productId?: string) {
  const { data: expirySettings } = useProductExpirySettings();
  
  if (!productId || !expirySettings) return 7; // Default fallback
  
  const setting = expirySettings.find(s => s.product_id === productId);
  return setting?.default_shelf_life_days || 7;
}
