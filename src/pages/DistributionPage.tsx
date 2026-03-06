import { useState } from 'react';
import { useRiders, useAddRider } from '@/hooks/useRiders';
import { useAvailableBatches } from '@/hooks/useInventory';
import { useDistributions, useAddDistribution, useBulkDistribution, useAdjustRiderStock, usePendingDistributions } from '@/hooks/useDistributions';
import { useReconciliationSummary } from '@/hooks/useReconciliation';
import { useProducts } from '@/hooks/useProducts';
import { PageLayout } from '@/components/PageLayout';
import { Truck, Plus, User, Package, Send, Check, X, TrendingDown, RotateCcw, AlertCircle, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';

function DistributionPage() {
  const { data: riders } = useRiders();
  const { data: availableBatches } = useAvailableBatches();
  const { data: allProducts } = useProducts();
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: todayDistributions } = useDistributions(today);
  const { data: pendingDistributions } = usePendingDistributions();
  const reconciliationSummary = useReconciliationSummary({ start: today, end: today });
  const addRider = useAddRider();
  const addDistribution = useAddDistribution();
  const bulkDistribution = useBulkDistribution();
  const adjustRiderStock = useAdjustRiderStock();

  const [isRiderOpen, setIsRiderOpen] = useState(false);
  const [isDistOpen, setIsDistOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'today' | 'pending'>('today');
  const [adjustmentRiderId, setAdjustmentRiderId] = useState<string | null>(null);
  const [adjustmentStates, setAdjustmentStates] = useState<Record<string, { action: 'sell' | 'return' | 'reject'; amount: string }>>({});
  const [autoDistributionRiderId, setAutoDistributionRiderId] = useState<string | null>(null);
  const [autoDistributionMode, setAutoDistributionMode] = useState<'default' | 'custom' | null>(null);
  const [adjustmentDate, setAdjustmentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Rider form
  const [riderName, setRiderName] = useState('');
  const [riderPhone, setRiderPhone] = useState('');
  
  // Distribution form
  const [selectedRider, setSelectedRider] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [distQuantity, setDistQuantity] = useState('');
  const [distDate, setDistDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Bulk distribution form
  const [bulkRider, setBulkRider] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [bulkQuantity, setBulkQuantity] = useState('5');
  const [bulkDistDate, setBulkDistDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Default distribution config
  const DEFAULT_DISTRIBUTION_CONFIG = {
    'Kopi Aren': 30,
    'Matcha': 5,
    'Coklat': 5,
    'Bubblegum': 5,
    'Taro': 5,
  };

  const handleAutoDistribute = async (mode: 'default' | 'custom') => {
    if (!autoDistributionRiderId) return;
    
    if (mode === 'default') {
      // Auto-distribute default products
      const configNames = Object.keys(DEFAULT_DISTRIBUTION_CONFIG).map(k => k.toLowerCase());
      
      const productsToDistribute = allProducts?.filter(p => {
        const name = p.name.toLowerCase().trim();
        
        // Include ALL add-ons
        if (p.category === 'addon') return true;
        
        // Include products that match config names
        // Check exact match or partial match
        return configNames.some(configName => 
          name === configName || name.includes(configName)
        );
      }) || [];

      console.log('=== AUTO DISTRIBUTE START ===');
      console.log('All products in database:', allProducts?.map(p => ({ name: p.name, id: p.id, cat: p.category })));
      console.log('Config names to match:', configNames);
      console.log('Products to distribute:', productsToDistribute.map(p => ({ name: p.name, id: p.id, cat: p.category })));
      console.log('Available batches:', availableBatches?.map(b => {
        const daysUntil = Math.ceil(
          (new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          productName: b.product?.name,
          productId: b.product_id,
          qty: b.current_quantity,
          expiry: b.expiry_date,
          daysUntil,
          rejected: b.notes?.includes('REJECTED') || false
        };
      }));

      let successCount = 0;
      const distributed = new Set<string>();
      const failedProducts: Array<{name: string, reason: string}> = [];
      
      for (const product of productsToDistribute) {
        // Prevent duplicate distribution of same product
        if (distributed.has(product.id)) {
          console.log(`⏭️ Skipping ${product.name} - already distributed in this cycle`);
          continue;
        }
        distributed.add(product.id);

        // Find ALL valid batches for this product (sorted by production date - FIFO)
        const validBatches = availableBatches?.filter(b => {
          if (b.product_id !== product.id) return false;
          if (b.current_quantity <= 0) return false;
          
          // Jangan ambil batch yang sudah dimusnahkan
          if (b.notes && b.notes.includes('REJECTED')) return false;
          
          // Jangan ambil batch yang sudah expired
          const daysUntil = Math.ceil(
            (new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
          );
          return daysUntil >= 0;
        }).sort((a, b) => 
          new Date(a.production_date).getTime() - new Date(b.production_date).getTime()
        ) || [];
        
        if (validBatches.length === 0) {
          console.log(`⚠️ ${product.name} (ID: ${product.id}): No valid batch found`);
          failedProducts.push({name: product.name, reason: 'Stok habis atau semua batch expired'});
          continue;
        }

        const requiredQuantity = product.category === 'addon' 
          ? 5 
          : (DEFAULT_DISTRIBUTION_CONFIG[product.name as keyof typeof DEFAULT_DISTRIBUTION_CONFIG] || 5);

        console.log(`✅ Distributing ${product.name}: Need ${requiredQuantity} units. Available batches: ${validBatches.length}`);

        let remainingQuantity = requiredQuantity;
        let batchIndex = 0;

        // Distribute from available batches until quantity is met or no batches left
        while (remainingQuantity > 0 && batchIndex < validBatches.length) {
          const batch = validBatches[batchIndex];
          const quantityFromBatch = Math.min(remainingQuantity, batch.current_quantity);

          console.log(`  📦 Batch ${batchIndex + 1}/${validBatches.length}: Taking ${quantityFromBatch} units from ${batch.id} (available: ${batch.current_quantity})`);

          try {
            await addDistribution.mutateAsync({
              rider_id: autoDistributionRiderId,
              batch_id: batch.id,
              quantity: quantityFromBatch,
            });
            successCount++;
            remainingQuantity -= quantityFromBatch;
            console.log(`   → Success! Remaining: ${remainingQuantity} units`);
          } catch (error) {
            console.error(`   → Error:`, error);
            failedProducts.push({
              name: product.name, 
              reason: error instanceof Error ? error.message : 'Unknown error'
            });
            break; // Stop trying for this product
          }

          batchIndex++;
        }

        if (remainingQuantity > 0) {
          console.log(`⚠️ ${product.name}: Could not fulfill all ${requiredQuantity} units. Missing: ${remainingQuantity}`);
        }
      }

      console.log(`=== RESULT: ${successCount} success, ${failedProducts.length} failed ===`);
      if (failedProducts.length > 0) {
        console.log('Failed products:', failedProducts);
      }

      if (successCount === 0) {
        toast.warning('Tidak ada batch yang tersedia untuk didistribusikan (semua expired atau sudah dimusnahkan)');
      } else {
        const msg = failedProducts.length > 0 
          ? `${successCount} produk berhasil. Gagal: ${failedProducts.map(f => `${f.name} (${f.reason})`).join(', ')}`
          : `${successCount} produk berhasil didistribusi!`;
        toast.success(msg);
      }
      setAutoDistributionRiderId(null);
      setAutoDistributionMode(null);
    } else {
      // Custom distribution - open bulk dialog with this rider pre-selected
      setBulkRider(autoDistributionRiderId);
      setAutoDistributionRiderId(null);
      setAutoDistributionMode(null);
      setIsBulkOpen(true);
    }
  };

  const handleAddRider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!riderName.trim()) return;
    await addRider.mutateAsync({ name: riderName.trim(), phone: riderPhone.trim() || undefined });
    setRiderName('');
    setRiderPhone('');
    setIsRiderOpen(false);
  };

  const handleDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider || !selectedBatch || !distQuantity || !distDate) return;
    await addDistribution.mutateAsync({
      rider_id: selectedRider,
      batch_id: selectedBatch,
      quantity: parseInt(distQuantity),
      distributed_at: distDate,
    });
    setSelectedBatch('');
    setDistQuantity('');
    setIsDistOpen(false);
  };

  const handleBulkDistribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkRider || selectedBatches.length === 0 || !bulkQuantity || !bulkDistDate) return;
    await bulkDistribution.mutateAsync({
      rider_id: bulkRider,
      batch_ids: selectedBatches,
      quantity_per_product: parseInt(bulkQuantity),
      distributed_at: bulkDistDate,
    });
    setBulkRider('');
    setSelectedBatches([]);
    setBulkQuantity('5');
    setIsBulkOpen(false);
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustmentRiderId) return;
    
    // Determine if we're in pending view
    const isPending = adjustmentRiderId.startsWith('pending-');
    let riderDists: typeof todayDistributions = [];
    
    if (isPending) {
      // Extract riderId from "pending-${riderId}"
      const riderId = adjustmentRiderId.replace('pending-', '');
      riderDists = pendingDistributions?.filter(d => d.rider_id === riderId) || [];
    } else {
      // Use todayDistributions for today view
      riderDists = todayDistributions?.filter(d => d.rider_id === adjustmentRiderId) || [];
    }
    
    console.log('🚀 handleAdjustment started');
    console.log('View mode:', isPending ? 'pending' : 'today');
    console.log('Total distributions for rider:', riderDists.length);
    console.log('Adjustment states:', adjustmentStates);
    
    // Filter to only distributions with input data
    const distribsToProcess = riderDists.filter(dist => {
      const state = adjustmentStates[dist.id];
      const amount = state?.amount ? parseInt(state.amount) : 0;
      return amount > 0;
    });
    
    if (distribsToProcess.length === 0) {
      toast.info('Tidak ada perubahan yang diinput');
      return;
    }
    
    console.log(`Processing ${distribsToProcess.length} distributions with changes`);
    
    let successCount = 0;
    let errorCount = 0;
    const errorDetails: Array<{ product: string; amount: number | string; error: string; remaining: number }> = [];
    const successDetails: Array<{ product: string; amount: number; action: string }> = [];
    
    // Process each distribution
    for (const dist of distribsToProcess) {
      const state = adjustmentStates[dist.id];
      const rawAmount = state?.amount?.trim() || '';
      
      // Validate input
      if (!rawAmount) {
        console.warn(`Skipping dist ${dist.id} - no amount`);
        continue;
      }
      
      const amount = parseInt(rawAmount, 10);
      
      if (isNaN(amount) || amount <= 0) {
        console.warn(`Invalid amount for ${dist.batch?.product?.name}: "${state.amount}"`);
        errorCount++;
        errorDetails.push({
          product: dist.batch?.product?.name || 'Unknown',
          amount: state.amount,
          error: 'Jumlah harus berupa angka positif',
          remaining: dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0),
        });
        continue;
      }
      
      try {
        // Frontend validation before sending to backend
        const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
        
        console.log(`📌 Safety check for ${dist.batch?.product?.name}:`, {
          total: dist.quantity,
          input: amount,
          remaining: remaining,
          sold: dist.sold_quantity || 0,
          returned: dist.returned_quantity || 0,
          rejected: dist.rejected_quantity || 0,
        });
        
        if (amount > remaining) {
          const msg = `Jumlah ${amount} melebihi stok rider (tersisa: ${remaining})`;
          throw new Error(msg);
        }
        
        console.log(`✍️  Updating dist ${dist.id}:`, {
          product: dist.batch?.product?.name,
          action: state.action,
          amount: amount,
          remaining: remaining,
          current: { sold: dist.sold_quantity, returned: dist.returned_quantity, rejected: dist.rejected_quantity },
        });
        
        await adjustRiderStock.mutateAsync({
          id: dist.id,
          action: state.action || 'sell',
          amount: amount,
        });
        
        successCount++;
        successDetails.push({
          product: dist.batch?.product?.name || 'Unknown',
          amount: amount,
          action: state.action || 'sell',
        });
        console.log(`✅ Success: ${dist.batch?.product?.name} - ${amount} unit (${state.action})`);
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
        
        console.error(`❌ Error updating dist ${dist.id}:`, {
          product: dist.batch?.product?.name,
          amount: state.amount,
          error: errorMsg,
          remaining,
        });
        
        errorDetails.push({
          product: dist.batch?.product?.name || 'Unknown',
          amount: state.amount,
          error: errorMsg,
          remaining: remaining,
        });
        
        toast.error(`Gagal update ${dist.batch?.product?.name}: ${errorMsg}`);
      }
    }
    
    console.log(`📊 Summary - Success: ${successCount}, Error: ${errorCount}`);
    if (successDetails.length > 0) {
      console.log('✅ Success details:', successDetails);
    }
    if (errorDetails.length > 0) {
      console.log('❌ Error details:', errorDetails);
    }
    
    // Provide feedback to user
    if (successCount > 0) {
      toast.success(`✅ ${successCount} item berhasil diupdate!`);
      
      // If all successful, close adjustment panel and clear state
      if (errorCount === 0) {
        // Clear states immediately
        setAdjustmentStates({});
        setAdjustmentRiderId(null);
      }
    }
    
    if (errorCount > 0) {
      const errorMsg = errorDetails
        .map(e => `${e.product}: ${e.error} (input: ${e.amount}, max: ${e.remaining})`)
        .join('\n');
      toast.error(
        `❌ ${errorCount} item gagal:\n${errorMsg}\n\nSilakan periksa dan coba lagi.`,
        { duration: 5000 }
      );
      // Keep adjustment open so user can fix and retry
    }
  };

  const updateAdjustmentState = (distId: string, field: 'action' | 'amount', value: string) => {
    // Additional validation for amount field
    if (field === 'amount') {
      // Remove leading zeros and ensure valid number
      const trimmed = value.trim();
      if (trimmed && !/^\d+$/.test(trimmed)) {
        // Invalid input - only allow digits
        console.warn(`Invalid input: "${value}"`);
        return;
      }
      // Prevent empty state for valid positive numbers
      if (trimmed === '') {
        setAdjustmentStates(prev => ({
          ...prev,
          [distId]: {
            ...prev[distId],
            [field]: '',
          },
        }));
        return;
      }
    }
    
    setAdjustmentStates(prev => ({
      ...prev,
      [distId]: {
        ...prev[distId],
        [field]: value,
      },
    }));
  };

  const toggleBatchSelection = (batchId: string) => {
    setSelectedBatches(prev => 
      prev.includes(batchId) 
        ? prev.filter(id => id !== batchId)
        : [...prev, batchId]
    );
  };

  const selectAllBatches = () => {
    if (selectedBatches.length === availableBatches?.length) {
      setSelectedBatches([]);
    } else {
      setSelectedBatches(availableBatches?.map(b => b.id) || []);
    }
  };

  return (
    <PageLayout
      title="Distribusi"
      subtitle="Kirim produk ke rider"
      action={
        <div className="flex gap-2">
          <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
            <DialogTrigger asChild>
              <button className="btn-secondary flex items-center gap-2">
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Bulk</span>
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Distribusi Bulk ke Rider</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBulkDistribute} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pilih Rider</label>
                  <Select value={bulkRider} onValueChange={setBulkRider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih rider" />
                    </SelectTrigger>
                    <SelectContent>
                      {riders?.map((rider) => (
                        <SelectItem key={rider.id} value={rider.id}>
                          {rider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Jumlah per Produk</label>
                  <input
                    type="number"
                    value={bulkQuantity}
                    onChange={(e) => setBulkQuantity(e.target.value)}
                    placeholder="Jumlah untuk setiap produk"
                    className="input-field"
                    min="1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Jumlah ini akan dikirim untuk setiap produk yang dipilih
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tanggal Distribusi</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="input-field w-full text-left"
                      >
                        {bulkDistDate ? format(new Date(bulkDistDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={bulkDistDate ? new Date(bulkDistDate) : undefined}
                        onSelect={(date) => setBulkDistDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Pilih Produk</label>
                    <button
                      type="button"
                      onClick={selectAllBatches}
                      className="text-xs text-primary hover:underline"
                    >
                      {selectedBatches.length === availableBatches?.length ? 'Hapus Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto border border-border rounded-lg p-2">
                    {availableBatches?.map((batch) => (
                      <label
                        key={batch.id}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                          selectedBatches.includes(batch.id)
                            ? 'bg-primary/10 border border-primary/20'
                            : 'bg-muted/50 hover:bg-muted'
                        )}
                      >
                        <Checkbox
                          checked={selectedBatches.includes(batch.id)}
                          onCheckedChange={() => toggleBatchSelection(batch.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{batch.product?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Stok: {batch.current_quantity} • Exp: {format(new Date(batch.expiry_date), 'dd/MM')}
                          </p>
                        </div>
                      </label>
                    ))}
                    {(!availableBatches || availableBatches.length === 0) && (
                      <p className="text-center text-muted-foreground py-4">
                        Tidak ada stok tersedia
                      </p>
                    )}
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!bulkRider || selectedBatches.length === 0 || bulkDistribution.isPending}
                >
                  {bulkDistribution.isPending 
                    ? 'Memproses...' 
                    : `Kirim ${selectedBatches.length} Produk (${parseInt(bulkQuantity || '0') * selectedBatches.length} unit)`
                  }
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDistOpen} onOpenChange={setIsDistOpen}>
            <DialogTrigger asChild>
              <button className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Kirim</span>
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Distribusi Produk</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleDistribute} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Pilih Rider</label>
                  <Select value={selectedRider} onValueChange={setSelectedRider}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih rider" />
                    </SelectTrigger>
                    <SelectContent>
                      {riders?.map((rider) => (
                        <SelectItem key={rider.id} value={rider.id}>
                          {rider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Pilih Batch Produk</label>
                  <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBatches?.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.product?.name} - Stok: {batch.current_quantity} (Exp: {format(new Date(batch.expiry_date), 'dd/MM')})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Jumlah</label>
                  <input
                    type="number"
                    value={distQuantity}
                    onChange={(e) => setDistQuantity(e.target.value)}
                    placeholder="Jumlah unit"
                    className="input-field"
                    min="1"
                    max={availableBatches?.find(b => b.id === selectedBatch)?.current_quantity || 999}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tanggal Distribusi</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="input-field w-full text-left"
                      >
                        {distDate ? format(new Date(distDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={distDate ? new Date(distDate) : undefined}
                        onSelect={(date) => setDistDate(date ? format(date, 'yyyy-MM-dd') : '')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!selectedRider || !selectedBatch || !distQuantity || addDistribution.isPending}
                >
                  {addDistribution.isPending ? 'Mengirim...' : 'Kirim ke Rider'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Riders Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Daftar Rider</h2>
          </div>
          <Dialog open={isRiderOpen} onOpenChange={setIsRiderOpen}>
            <DialogTrigger asChild>
              <button className="btn-outline text-sm py-1.5 px-3">
                <Plus className="w-4 h-4 mr-1 inline" />
                Rider
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Rider Baru</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddRider} className="space-y-4 mt-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Nama Rider</label>
                  <input
                    type="text"
                    value={riderName}
                    onChange={(e) => setRiderName(e.target.value)}
                    placeholder="Nama lengkap"
                    className="input-field"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">No. Telepon (opsional)</label>
                  <input
                    type="tel"
                    value={riderPhone}
                    onChange={(e) => setRiderPhone(e.target.value)}
                    placeholder="08xxx"
                    className="input-field"
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full"
                  disabled={!riderName.trim() || addRider.isPending}
                >
                  {addRider.isPending ? 'Menyimpan...' : 'Simpan Rider'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {riders?.map((rider) => (
            <button
              key={rider.id}
              onClick={() => {
                setAutoDistributionRiderId(rider.id);
                setAutoDistributionMode(null); // Show modal
              }}
              className="flex-shrink-0 bg-card border border-border rounded-lg px-4 py-3 min-w-[140px] hover:border-primary hover:bg-primary/5 transition-all cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium text-sm">{rider.name}</p>
                  {rider.phone && (
                    <p className="text-xs text-muted-foreground">{rider.phone}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
          {(!riders || riders.length === 0) && (
            <p className="text-sm text-muted-foreground">Belum ada rider</p>
          )}
        </div>

        {/* Auto Distribution Mode Selection Modal */}
        <AnimatePresence>
          {autoDistributionRiderId && autoDistributionMode === null && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => {
                setAutoDistributionRiderId(null);
                setAutoDistributionMode(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-card border border-border rounded-lg p-6 max-w-sm mx-4 shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">
                  Distribusi ke {riders?.find(r => r.id === autoDistributionRiderId)?.name}
                </h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleAutoDistribute('default')}
                    className="w-full p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                    disabled={addDistribution.isPending}
                  >
                    <p className="font-medium">📦 Default Distribution</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Kopi Aren 30pcs, Matcha/Coklat/Taro 5pcs, Add-on 5pcs
                    </p>
                  </button>

                  <button
                    onClick={() => setAutoDistributionMode('custom')}
                    className="w-full p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                  >
                    <p className="font-medium">⚙️ Custom Distribution</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Pilih produk dan jumlah secara manual
                    </p>
                  </button>

                  <button
                    onClick={() => {
                      setAutoDistributionRiderId(null);
                      setAutoDistributionMode(null);
                    }}
                    className="w-full p-2 text-center text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Distribution Modal */}
        <AnimatePresence>
          {autoDistributionRiderId && autoDistributionMode === 'custom' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
              onClick={() => {
                setAutoDistributionRiderId(null);
                setAutoDistributionMode(null);
              }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">
                  Custom Distribution untuk {riders?.find(r => r.id === autoDistributionRiderId)?.name}
                </h3>
                
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Jumlah per Produk</label>
                    <input
                      type="number"
                      value={bulkQuantity}
                      onChange={(e) => setBulkQuantity(e.target.value)}
                      placeholder="Jumlah untuk setiap produk"
                      className="input-field"
                      min="1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Jumlah ini akan dikirim untuk setiap produk yang dipilih
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium">Pilih Produk</label>
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedBatches.length === availableBatches?.length) {
                            setSelectedBatches([]);
                          } else {
                            setSelectedBatches(availableBatches?.map(b => b.id) || []);
                          }
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        {selectedBatches.length === availableBatches?.length ? 'Hapus Semua' : 'Pilih Semua'}
                      </button>
                    </div>
                    <div className="space-y-2 max-h-60 overflow-y-auto border border-border rounded-lg p-2">
                      {availableBatches?.map((batch) => (
                        <label
                          key={batch.id}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                            selectedBatches.includes(batch.id)
                              ? 'bg-primary/10 border border-primary/20'
                              : 'bg-muted/50 hover:bg-muted'
                          )}
                        >
                          <Checkbox
                            checked={selectedBatches.includes(batch.id)}
                            onCheckedChange={() => {
                              setSelectedBatches(prev => 
                                prev.includes(batch.id) 
                                  ? prev.filter(id => id !== batch.id)
                                  : [...prev, batch.id]
                              );
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{batch.product?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              Stok: {batch.current_quantity} • Exp: {format(new Date(batch.expiry_date), 'dd/MM')}
                            </p>
                          </div>
                        </label>
                      ))}
                      {(!availableBatches || availableBatches.length === 0) && (
                        <p className="text-center text-muted-foreground py-4">
                          Tidak ada stok tersedia
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAutoDistribute('custom')}
                    className="flex-1 btn-primary"
                    disabled={selectedBatches.length === 0 || addDistribution.isPending}
                  >
                    {addDistribution.isPending 
                      ? 'Memproses...' 
                      : `Kirim ${selectedBatches.length} Produk`
                    }
                  </button>
                  <button
                    onClick={() => {
                      setAutoDistributionRiderId(null);
                      setAutoDistributionMode(null);
                      setSelectedBatches([]);
                    }}
                    className="btn-outline px-4"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reconciliation Summary */}
      {reconciliationSummary.totalDistributed > 0 && (
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-blue-50/50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Database className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-blue-900">📊 Reconciliation Hari Ini</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div className="bg-white/70 rounded p-2.5">
              <p className="text-muted-foreground text-xs">Total Dikirim</p>
              <p className="font-semibold text-lg text-blue-900">{reconciliationSummary.totalDistributed}</p>
            </div>
            <div className="bg-white/70 rounded p-2.5">
              <p className="text-muted-foreground text-xs">Terjual ✓</p>
              <p className="font-semibold text-lg text-green-600">{reconciliationSummary.totalSold}</p>
            </div>
            <div className="bg-white/70 rounded p-2.5">
              <p className="text-muted-foreground text-xs">Dikembalikan</p>
              <p className="font-semibold text-lg text-orange-600">{reconciliationSummary.totalReturned}</p>
            </div>
            <div className="bg-white/70 rounded p-2.5">
              <p className="text-muted-foreground text-xs">Ditolak</p>
              <p className="font-semibold text-lg text-red-600">{reconciliationSummary.totalRejected}</p>
            </div>
            <div className={cn(
              'bg-white/70 rounded p-2.5',
              reconciliationSummary.totalUnaccounted > 0 ? 'border-2 border-orange-300' : ''
            )}>
              <p className="text-muted-foreground text-xs">Belum Tercatat</p>
              <p className={cn(
                'font-semibold text-lg',
                reconciliationSummary.totalUnaccounted > 0 ? 'text-orange-600' : 'text-green-600'
              )}>
                {reconciliationSummary.totalUnaccounted}
              </p>
              {reconciliationSummary.totalUnaccounted > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  {Math.round((reconciliationSummary.totalUnaccounted / reconciliationSummary.totalDistributed) * 100)}% pending
                </p>
              )}
            </div>
          </div>
          {reconciliationSummary.pendingItems.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-2">
                ⚠️ Ada {reconciliationSummary.pendingItems.length} item yang belum tercatat:
              </p>
              <div className="space-y-1 text-xs">
                {reconciliationSummary.pendingItems.slice(0, 3).map(item => (
                  <p key={item.id} className="text-blue-700">
                    • {item.productName} × {item.unaccountedQuantity} unit (dari rider {item.riderName})
                  </p>
                ))}
                {reconciliationSummary.pendingItems.length > 3 && (
                  <p className="text-blue-700">• +{reconciliationSummary.pendingItems.length - 3} item lainnya...</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Today's Distributions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-success" />
            <h2 className="font-semibold">
              {viewMode === 'today' ? 'Distribusi Hari Ini' : 'Distribusi Pending (Stok Sisa)'}
            </h2>
          </div>
          <div className="flex gap-2 bg-muted p-1 rounded-lg">
            <button
              onClick={() => setViewMode('today')}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                viewMode === 'today' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setViewMode('pending')}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors relative',
                viewMode === 'pending' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Pending
              {pendingDistributions && pendingDistributions.length > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-orange-600 rounded-full">
                  {Array.from(new Set(pendingDistributions.map(d => d.rider_id))).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {viewMode === 'today' ? (
          // Today's View
          <>
            {(!todayDistributions || todayDistributions.length === 0) ? (
              <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Belum ada distribusi hari ini</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Get unique riders for today */}
                {Array.from(new Set(todayDistributions.map(d => d.rider_id)))
                  .map((riderId) => {
                    const riderDists = todayDistributions.filter(d => d.rider_id === riderId);
                    
                    // Filter produk yang masih punya stok sisa (remaining > 0)
                    const activeDists = riderDists.filter(dist => {
                      const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                      return remaining > 0;
                    });
                    
                    // Skip rider jika semua produk sudah habis
                    if (activeDists.length === 0) return null;
                    
                    const rider = riderDists[0]?.rider;
                    const isOpen = adjustmentRiderId === riderId;

                    return (
                      <div key={riderId} className="border border-border rounded-lg overflow-hidden">
                        <div 
                          className="p-4 bg-card hover:bg-muted/50 transition-colors cursor-pointer" 
                          onClick={() => setAdjustmentRiderId(isOpen ? null : riderId)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-success/10 text-success flex items-center justify-center">
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold">{rider?.name}</p>
                                <p className="text-sm text-muted-foreground">{activeDists.length} produk</p>
                                <p className="text-xs text-success">Distribusi hari ini</p>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-sm font-medium">{activeDists.reduce((acc, d) => acc + (d.quantity - (d.sold_quantity || 0) - (d.returned_quantity || 0) - (d.rejected_quantity || 0)), 0)} unit</p>
                              <p className="text-muted-foreground">
                                📦 Terjual: {riderDists.reduce((acc, d) => acc + (d.sold_quantity || 0), 0)}
                              </p>
                              <p className="text-muted-foreground">
                                🔄 Kembali: {riderDists.reduce((acc, d) => acc + (d.returned_quantity || 0), 0)}
                              </p>
                            </div>
                          </div>
                        </div>

                    {/* Expanded content */}
                    {isOpen && (
                      <AnimatePresence>
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border overflow-hidden"
                        >
                          <div className="p-4 space-y-3 bg-muted/20">
                            {/* Help text untuk penjelasan action */}
                            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-xs text-primary/80">
                              <p className="font-medium mb-1">📝 Panduan Pengisian Status:</p>
                              <ul className="space-y-1 ml-2">
                                <li>• <strong className="text-primary">Terjual:</strong> Produk berhasil dijual ke customer</li>
                                <li>• <strong className="text-warning">Dikembalikan:</strong> Produk tidak terjual - kembalikan ke gudang/stok</li>
                                <li>• <strong className="text-destructive">Ditolak:</strong> Produk rusak/tidak layak - tidak masuk stok</li>
                              </ul>
                            </div>

                            {activeDists.map((dist) => {
                              const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                              const state = adjustmentStates[dist.id] || { action: 'sell', amount: '' };
                              return (
                                <div key={dist.id} className="border border-border rounded-lg p-3 space-y-3 bg-card">
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="font-medium text-sm">{dist.batch?.product?.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Exp: {format(new Date(dist.batch?.expiry_date || ''), 'dd/MM/yy')}
                                      </p>
                                    </div>
                                    <div className="text-right text-xs">
                                      <p className="font-semibold">{dist.quantity} unit</p>
                                      <p className="text-muted-foreground">
                                        📦 {dist.sold_quantity || 0} | 🔄 {dist.returned_quantity || 0} | ❌ {dist.rejected_quantity || 0} | ⭘ {remaining}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div>
                                      <label className="text-xs font-medium mb-1 block">Aksi</label>
                                      <Select 
                                        value={state.action || 'sell'} 
                                        onValueChange={(val) => updateAdjustmentState(dist.id, 'action', val as 'sell' | 'return' | 'reject')}
                                      >
                                        <SelectTrigger className="h-8 text-xs">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="sell">Terjual</SelectItem>
                                          <SelectItem value="return">Dikembalikan</SelectItem>
                                          <SelectItem value="reject">Ditolak</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <label className="text-xs font-medium mb-1 block">Jumlah</label>
                                      <input
                                        type="number"
                                        value={state.amount || ''}
                                        onChange={(e) => updateAdjustmentState(dist.id, 'amount', e.target.value)}
                                        placeholder="0"
                                        className="input-field h-8 text-xs"
                                        min="0"
                                        max={remaining}
                                      />
                                    </div>
                                    <div className="flex items-end gap-1">
                                      <button
                                        type="button"
                                        onClick={() => updateAdjustmentState(dist.id, 'amount', remaining.toString())}
                                        className="btn-secondary text-xs h-8 px-2 whitespace-nowrap"
                                        title="Isi dengan jumlah maksimal"
                                      >
                                        Semua
                                      </button>
                                      <div className="text-xs text-muted-foreground">
                                        Maks: {remaining}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}

                          {/* Quick action buttons for bulk fill */}
                          <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-medium text-primary/70">💡 Isi Semua Sekaligus:</p>
                            <div className="grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  activeDists.forEach(dist => {
                                    const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                    updateAdjustmentState(dist.id, 'action', 'sell');
                                    updateAdjustmentState(dist.id, 'amount', remaining.toString());
                                  });
                                }}
                                className="btn-secondary text-xs h-8 px-2"
                              >
                                ✅ Semua Terjual
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  activeDists.forEach(dist => {
                                    const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                    updateAdjustmentState(dist.id, 'action', 'return');
                                    updateAdjustmentState(dist.id, 'amount', remaining.toString());
                                  });
                                }}
                                className="btn-secondary text-xs h-8 px-2"
                              >
                                🔄 Semua Kembali
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  activeDists.forEach(dist => {
                                    const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                    updateAdjustmentState(dist.id, 'action', 'reject');
                                    updateAdjustmentState(dist.id, 'amount', remaining.toString());
                                  });
                                }}
                                className="btn-secondary text-xs h-8 px-2"
                              >
                                ❌ Semua Tolak
                              </button>
                            </div>
                          </div>

                          {/* Preview of changes before submission */}
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-primary mb-2">📋 Preview Perubahan:</p>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {activeDists.filter(dist => {
                                const state = adjustmentStates[dist.id];
                                return state?.amount && parseInt(state.amount) > 0;
                              }).map(dist => {
                                const state = adjustmentStates[dist.id];
                                const actionLabel = {
                                  'sell': '✓ Terjual',
                                  'return': '↩ Kembali',
                                  'reject': '✗ Tolak'
                                }[state.action || 'sell'];
                                return (
                                  <div key={dist.id} className="flex items-center justify-between text-xs bg-white/50 rounded p-1.5">
                                    <span className="font-medium text-primary truncate">
                                      {dist.batch?.product?.name}
                                    </span>
                                    <span className="text-primary/70 ml-2">
                                      {state.amount || '0'} × {actionLabel}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {activeDists.every(dist => {
                              const state = adjustmentStates[dist.id];
                              return !state?.amount || parseInt(state.amount) === 0;
                            }) && (
                              <p className="text-xs text-muted-foreground text-center py-1">
                                Belum ada perubahan yang diinput
                              </p>
                            )}
                          </div>

                          <div className="mb-3">
                            <label className="block text-xs font-medium mb-1">Tanggal Update Status</label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="input-field w-full text-left"
                                >
                                  {adjustmentDate ? format(new Date(adjustmentDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={adjustmentDate ? new Date(adjustmentDate) : undefined}
                                  onSelect={(date) => setAdjustmentDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          <form onSubmit={handleAdjustment} className="flex gap-2 pt-2">
                            <Button
                              type="submit"
                              className="flex-1"
                              disabled={adjustRiderStock.isPending || activeDists.every(dist => {
                                const state = adjustmentStates[dist.id];
                                return !state?.amount || parseInt(state.amount) === 0;
                              })}
                            >
                              {adjustRiderStock.isPending ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
                            </Button>
                            <button
                              type="button"
                              onClick={() => {
                                setAdjustmentRiderId(null);
                                setAdjustmentStates({});
                              }}
                              className="btn-outline px-4"
                            >
                              Batal
                            </button>
                          </form>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              );
            }).filter(Boolean)}
              </div>
            )}
          </>
        ) : (
          // Pending View - Show distributions with remaining stock from any date
          <>
            {(!pendingDistributions || pendingDistributions.length === 0) ? (
              <div className="p-8 text-center text-muted-foreground bg-muted/30 rounded-lg">
                <Check className="w-12 h-12 mx-auto mb-3 opacity-50 text-success" />
                <p>Semua distribusi sudah selesai! ✓</p>
                <p className="text-sm mt-2">Tidak ada produk yang pending (stok sisa)</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Get unique riders from pending distributions */}
                {Array.from(new Set(pendingDistributions.map(d => d.rider_id)))
                  .map((riderId) => {
                    const riderDists = pendingDistributions.filter(d => d.rider_id === riderId);
                    const rider = riderDists[0]?.rider;
                    const isOpen = adjustmentRiderId === `pending-${riderId}`;

                    return (
                      <div key={`pending-${riderId}`} className="border border-border rounded-lg overflow-hidden">
                        <div 
                          className="p-4 bg-card hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-orange-500" 
                          onClick={() => setAdjustmentRiderId(isOpen ? null : `pending-${riderId}`)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-orange-500/10 text-orange-600 flex items-center justify-center">
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold">{rider?.name}</p>
                                <p className="text-sm text-muted-foreground">{riderDists.length} produk pending</p>
                                <p className="text-xs text-orange-600">⚠️ Ada stok yang belum di-update</p>
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              <p className="text-sm font-medium">{riderDists.reduce((acc, d) => acc + (d.quantity - (d.sold_quantity || 0) - (d.returned_quantity || 0) - (d.rejected_quantity || 0)), 0)} unit sisa</p>
                              <p className="text-muted-foreground">
                                📦 Terjual: {riderDists.reduce((acc, d) => acc + (d.sold_quantity || 0), 0)}
                              </p>
                              <p className="text-muted-foreground">
                                🔄 Kembali: {riderDists.reduce((acc, d) => acc + (d.returned_quantity || 0), 0)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Expanded content */}
                        {isOpen && (
                          <AnimatePresence>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="border-t border-border overflow-hidden"
                            >
                              <div className="p-4 space-y-3 bg-muted/20">
                              {/* Help text untuk penjelasan action */}
                                <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-xs text-info/80">
                                  <p className="font-medium mb-1">📝 Panduan Pengisian Status:</p>
                                  <ul className="space-y-1 ml-2">
                                    <li>• <strong className="text-info">Terjual:</strong> Produk berhasil dijual ke customer</li>
                                    <li>• <strong className="text-warning">Dikembalikan:</strong> Produk tidak terjual - kembalikan ke gudang/stok</li>
                                    <li>• <strong className="text-destructive">Ditolak:</strong> Produk rusak/tidak layak - tidak masuk stok</li>
                                  </ul>
                                </div>

                                {riderDists.map((dist) => {
                                  const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                  const state = adjustmentStates[dist.id] || { action: 'sell', amount: '' };

                                  return (
                                    <div key={dist.id} className="border border-border rounded-lg p-3 space-y-3 bg-card">
                                      <div className="flex items-start justify-between">
                                        <div>
                                          <p className="font-medium text-sm">{dist.batch?.product?.name}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Distribusi: {format(new Date(dist.distributed_at), 'dd/MM/yy')} • Exp: {format(new Date(dist.batch?.expiry_date || ''), 'dd/MM/yy')}
                                          </p>
                                        </div>
                                        <div className="text-right text-xs">
                                          <p className="font-semibold">{dist.quantity} unit</p>
                                          <p className="text-muted-foreground">
                                            📦 {dist.sold_quantity || 0} | 🔄 {dist.returned_quantity || 0} | ❌ {dist.rejected_quantity || 0} | ⭘ {remaining}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-3 gap-2">
                                        <div>
                                          <label className="text-xs font-medium mb-1 block">Aksi</label>
                                          <Select 
                                            value={state.action || 'sell'} 
                                            onValueChange={(val) => updateAdjustmentState(dist.id, 'action', val as 'sell' | 'return' | 'reject')}
                                          >
                                            <SelectTrigger className="h-8 text-xs">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="sell">Terjual</SelectItem>
                                              <SelectItem value="return">Dikembalikan</SelectItem>
                                              <SelectItem value="reject">Ditolak</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </div>
                                        <div>
                                          <label className="text-xs font-medium mb-1 block">Jumlah</label>
                                          <input
                                            type="number"
                                            value={state.amount || ''}
                                            onChange={(e) => updateAdjustmentState(dist.id, 'amount', e.target.value)}
                                            placeholder="0"
                                            className="input-field h-8 text-xs"
                                            min="0"
                                            max={remaining}
                                          />
                                        </div>
                                        <div className="flex items-end gap-1">
                                          <button
                                            type="button"
                                            onClick={() => updateAdjustmentState(dist.id, 'amount', remaining.toString())}
                                            className="btn-secondary text-xs h-8 px-2 whitespace-nowrap"
                                            title="Isi dengan jumlah maksimal"
                                          >
                                            Semua
                                          </button>
                                          <div className="text-xs text-muted-foreground">
                                            Maks: {remaining}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* Quick action buttons for bulk fill */}
                                <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 space-y-2">
                                  <p className="text-xs font-medium text-orange-700">💡 Isi Semua Sekaligus:</p>
                                  <div className="grid grid-cols-3 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        riderDists.forEach(dist => {
                                          const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                          updateAdjustmentState(dist.id, 'action', 'sell');
                                          updateAdjustmentState(dist.id, 'amount', remaining.toString());
                                        });
                                      }}
                                      className="btn-secondary text-xs h-8 px-2"
                                    >
                                      ✅ Semua Terjual
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        riderDists.forEach(dist => {
                                          const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                          updateAdjustmentState(dist.id, 'action', 'return');
                                          updateAdjustmentState(dist.id, 'amount', remaining.toString());
                                        });
                                      }}
                                      className="btn-secondary text-xs h-8 px-2"
                                    >
                                      🔄 Semua Kembali
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        riderDists.forEach(dist => {
                                          const remaining = dist.quantity - (dist.sold_quantity || 0) - (dist.returned_quantity || 0) - (dist.rejected_quantity || 0);
                                          updateAdjustmentState(dist.id, 'action', 'reject');
                                          updateAdjustmentState(dist.id, 'amount', remaining.toString());
                                        });
                                      }}
                                      className="btn-secondary text-xs h-8 px-2"
                                    >
                                      ❌ Semua Tolak
                                    </button>
                                  </div>
                                </div>

                                {/* Preview of changes before submission */}
                                <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-orange-700 mb-2">📋 Preview Perubahan:</p>
                                  <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {riderDists.filter(dist => {
                                      const state = adjustmentStates[dist.id];
                                      return state?.amount && parseInt(state.amount) > 0;
                                    }).map(dist => {
                                      const state = adjustmentStates[dist.id];
                                      const actionLabel = {
                                        'sell': '✓ Terjual',
                                        'return': '↩ Kembali',
                                        'reject': '✗ Tolak'
                                      }[state.action || 'sell'];
                                      
                                      return (
                                        <div key={dist.id} className="flex items-center justify-between text-xs bg-white/50 rounded p-1.5">
                                          <span className="font-medium text-orange-700 truncate">
                                            {dist.batch?.product?.name}
                                          </span>
                                          <span className="text-orange-600 ml-2">
                                            {state.amount || '0'} × {actionLabel}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {riderDists.every(dist => {
                                    const state = adjustmentStates[dist.id];
                                    return !state?.amount || parseInt(state.amount) === 0;
                                  }) && (
                                    <p className="text-xs text-muted-foreground text-center py-1">
                                      Belum ada perubahan yang diinput
                                    </p>
                                  )}
                                </div>

                                <div className="mb-3">
                                  <label className="block text-xs font-medium mb-1">Tanggal Update Status</label>
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="input-field w-full text-left"
                                      >
                                        {adjustmentDate ? format(new Date(adjustmentDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                                      </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="w-auto p-0">
                                      <Calendar
                                        mode="single"
                                        selected={adjustmentDate ? new Date(adjustmentDate) : undefined}
                                        onSelect={(date) => setAdjustmentDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                        initialFocus
                                      />
                                    </PopoverContent>
                                  </Popover>
                                </div>

                                <form onSubmit={handleAdjustment} className="flex gap-2 pt-2">
                                  <Button
                                    type="submit"
                                    className="flex-1"
                                    disabled={adjustRiderStock.isPending || riderDists.every(dist => {
                                      const state = adjustmentStates[dist.id];
                                      return !state?.amount || parseInt(state.amount) === 0;
                                    })}
                                  >
                                    {adjustRiderStock.isPending ? 'Menyimpan...' : 'Simpan Semua Perubahan'}
                                  </Button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAdjustmentRiderId(null);
                                      setAdjustmentStates({});
                                    }}
                                    className="btn-outline px-4"
                                  >
                                    Batal
                                  </button>
                                </form>
                              </div>
                            </motion.div>
                          </AnimatePresence>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default DistributionPage;
