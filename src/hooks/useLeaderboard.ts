import { useMemo } from 'react';
import { useDistributions } from '@/hooks/useDistributions';

export interface RiderLeaderboardEntry {
  rider_id: string;
  rider_name: string;
  total_cups: number;
  rank: number;
}

export function useRiderLeaderboard(dateRange: { start: string; end: string }) {
  const { data: distributions } = useDistributions(undefined, dateRange);

  const leaderboard = useMemo(() => {
    if (!distributions) return [];

    // Kelompokkan berdasarkan rider dan hitung total cups terjual
    const ridersSold = new Map<string, { name: string; total: number }>();

    distributions.forEach((dist) => {
      const batch = dist.batch;
      // Hanya hitung produk (tidak addon) yang terjual
      if (batch?.product?.category === 'product' && dist.sold_quantity > 0) {
        const riderId = dist.rider_id;
        const riderName = dist.rider?.name || 'Unknown';
        const existing = ridersSold.get(riderId);
        
        if (existing) {
          existing.total += dist.sold_quantity;
        } else {
          ridersSold.set(riderId, { name: riderName, total: dist.sold_quantity });
        }
      }
    });

    // Buat leaderboard entries
    const entries: RiderLeaderboardEntry[] = Array.from(ridersSold.entries())
      .map(([riderId, data]) => ({
        rider_id: riderId,
        rider_name: data.name,
        total_cups: data.total,
      }))
      .filter((e) => e.total_cups > 0) // Hanya yang ada penjualan
      .sort((a, b) => b.total_cups - a.total_cups) // Sort descending
      .map((e, index) => ({
        ...e,
        rank: index + 1,
      }));

    return entries;
  }, [distributions]);

  const totalCupsSold = useMemo(
    () => leaderboard.reduce((acc, e) => acc + e.total_cups, 0),
    [leaderboard]
  );

  return {
    leaderboard,
    totalCupsSold,
  };
}

