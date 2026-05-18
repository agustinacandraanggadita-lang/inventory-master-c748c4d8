import { useMemo } from 'react';
import { useDistributions } from '@/hooks/useDistributions';
import { useCanteenSales } from '@/hooks/useCanteenSales';

export interface RiderLeaderboardEntry {
  id: string; // rider_id atau canteen name
  name: string;
  total_cups: number;
  rank: number;
  type: 'rider' | 'canteen';
}

export function useRiderLeaderboard(dateRange: { start: string; end: string }) {
  const { data: distributions } = useDistributions(undefined, dateRange);
  const { data: canteenSales } = useCanteenSales(dateRange);

  const leaderboard = useMemo(() => {
    const entries: RiderLeaderboardEntry[] = [];

    // Hitung dari rider distributions
    if (distributions) {
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

      Array.from(ridersSold.entries()).forEach(([riderId, data]) => {
        if (data.total > 0) {
          entries.push({
            id: riderId,
            name: data.name,
            total_cups: data.total,
            rank: 0, // Will be set after sorting
            type: 'rider',
          });
        }
      });
    }

    // Hitung dari canteen sales dan group by canteen
    if (canteenSales) {
      const canteenMap = new Map<string, number>();

      canteenSales.forEach((sale) => {
        const existing = canteenMap.get(sale.canteen) || 0;
        canteenMap.set(sale.canteen, existing + sale.cups_sold);
      });

      Array.from(canteenMap.entries()).forEach(([canteenName, total]) => {
        if (total > 0) {
          entries.push({
            id: canteenName,
            name: canteenName,
            total_cups: total,
            rank: 0, // Will be set after sorting
            type: 'canteen',
          });
        }
      });
    }

    // Sort dan set rank
    const sorted = entries
      .sort((a, b) => b.total_cups - a.total_cups)
      .map((e, index) => ({
        ...e,
        rank: index + 1,
      }));

    return sorted;
  }, [distributions, canteenSales]);

  const totalCupsSold = useMemo(
    () => leaderboard.reduce((acc, e) => acc + e.total_cups, 0),
    [leaderboard]
  );

  return {
    leaderboard,
    totalCupsSold,
  };
}


