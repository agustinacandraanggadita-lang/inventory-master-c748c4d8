import { useMemo } from 'react';
import { useProducts } from './useProducts';
import { useInventorySummary } from './useInventory';
import { useRiders } from './useRiders';

// Default allocation per rider for each product
export const DEFAULT_PRODUCT_ALLOCATION: Record<string, number> = {
  'Kopi Aren': 25,
  'Matcha': 5,
  'Bubblegum': 5,
  'Taro': 5,
  'Coklat': 5,
};

// Default allocation for add-ons
export const DEFAULT_ADDON_ALLOCATION = 5;

export interface ProductionNeed {
  product_id: string;
  product_name: string;
  category: 'product' | 'addon';
  current_stock: number;
  allocation_per_rider: number;
  total_allocation: number; // allocation_per_rider * number_of_riders
  buffer_target: number; // minimum stock to keep in warehouse after distribution
  total_needed: number; // total_allocation + buffer_target
  needed: number; // max(0, total_needed - current_stock)
  stock_after_distribution: number; // current_stock - total_allocation
  stockStatus: 'low' | 'balanced' | 'surplus';
}

export function useProductionNeeds() {
  const { data: products } = useProducts();
  const { data: summary } = useInventorySummary();
  const { data: riders } = useRiders();

  const productionNeeds = useMemo(() => {
    if (!products || !riders) return [];

    const riderCount = riders.length || 4; // Default to 4 if no riders exist

    // Buffer target: maintain minimum stock in warehouse after distribution
    // At least 20 units or 15% of total allocation (whichever is higher)
    const BUFFER_PERCENTAGE = 0.15;
    const BUFFER_MIN = 20;

    return products
      .map((product) => {
        // Get allocation per rider
        let allocationPerRider = DEFAULT_ADDON_ALLOCATION;
        if (product.category === 'product') {
          allocationPerRider = DEFAULT_PRODUCT_ALLOCATION[product.name] || 0;
        }

        // Get current stock
        const summaryItem = summary?.find((s) => s.product_id === product.id);
        const currentStock = summaryItem?.total_in_inventory || 0;

        // Calculate total allocation for all riders
        const totalAllocation = allocationPerRider * riderCount;
        
        // Calculate buffer target based on allocation
        const bufferTarget = Math.max(BUFFER_MIN, Math.ceil(totalAllocation * BUFFER_PERCENTAGE));
        
        // Total needed = allocation + buffer in warehouse
        const totalNeeded = totalAllocation + bufferTarget;
        
        // Calculate how much needs to be produced
        const needed = Math.max(0, totalNeeded - currentStock);
        
        // Stock remaining in warehouse after distribution
        const stockAfterDistribution = Math.max(0, currentStock - totalAllocation);

        // Determine stock status
        let stockStatus: 'low' | 'balanced' | 'surplus';
        if (needed > 0) {
          stockStatus = 'low';
        } else if (currentStock > totalNeeded * 1.3) {
          stockStatus = 'surplus';
        } else {
          stockStatus = 'balanced';
        }

        return {
          product_id: product.id,
          product_name: product.name,
          category: product.category,
          current_stock: currentStock,
          allocation_per_rider: allocationPerRider,
          total_allocation: totalAllocation,
          buffer_target: bufferTarget,
          total_needed: totalNeeded,
          needed,
          stock_after_distribution: stockAfterDistribution,
          stockStatus,
        };
      })
      .sort((a, b) => {
        // Sort by: low > balanced > surplus, then by needed amount
        const statusOrder = { low: 0, balanced: 1, surplus: 2 };
        if (statusOrder[a.stockStatus] !== statusOrder[b.stockStatus]) {
          return statusOrder[a.stockStatus] - statusOrder[b.stockStatus];
        }
        return b.needed - a.needed;
      });
  }, [products, riders, summary]);

  const lowStock = productionNeeds.filter((p) => p.stockStatus === 'low');
  const balanced = productionNeeds.filter((p) => p.stockStatus === 'balanced');
  const surplus = productionNeeds.filter((p) => p.stockStatus === 'surplus');

  return {
    all: productionNeeds,
    lowStock,
    balanced,
    surplus,
    riderCount: riders?.length || 4,
  };
}
