import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useInventoryBatches, useAddBatch, useRejectBatch, useUpdateBatchQuantity, useUpdateWarehouseReject } from '@/hooks/useInventory';
import { PageLayout } from '@/components/PageLayout';
import { Factory, Plus, Package, Clock, ChevronDown, ChevronUp, Trash2, AlertTriangle, Edit2, AlertOctagon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

function ProductionPage() {
  const { data: products } = useProducts();
  const { data: batches, isLoading } = useInventoryBatches();
  const addBatch = useAddBatch();
  const rejectBatch = useRejectBatch();
  const updateBatchQuantity = useUpdateBatchQuantity();
  const updateWarehouseReject = useUpdateWarehouseReject();
  const [isOpen, setIsOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRejectBatch, setSelectedRejectBatch] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedEditBatch, setSelectedEditBatch] = useState<any>(null);
  const [editedQuantity, setEditedQuantity] = useState('');
  const [editedExpiryDate, setEditedExpiryDate] = useState('');
  const [warehouseRejectDialogOpen, setWarehouseRejectDialogOpen] = useState(false);
  const [selectedWarehouseRejectBatch, setSelectedWarehouseRejectBatch] = useState<any>(null);
  const [warehouseRejectQuantity, setWarehouseRejectQuantity] = useState('');
  const [warehouseRejectReason, setWarehouseRejectReason] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiryDate, setExpiryDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Get selected product
  const selectedProduct = products?.find(p => p.id === productId);
  
  // Calculate default suggestion based on product category
  const getDefaultExpiryDays = () => {
    return selectedProduct?.category === 'product' ? 7 : 3;
  };

  // Auto-update expiry when product changes (only if expiry is still default)
  const handleProductChange = (value: string) => {
    setProductId(value);
    const product = products?.find(p => p.id === value);
    if (product) {
      // Set default expiry based on product category
      const defaultDays = product?.category === 'product' ? 7 : 3;
      const newExpiryDate = format(addDays(new Date(productionDate), defaultDays), 'yyyy-MM-dd');
      setExpiryDate(newExpiryDate);
    }
  };

  // Auto-update expiry when production date changes
  const handleProductionDateChange = (value: string) => {
    setProductionDate(value);
    // Maintain the same shelf life duration
    const currentShelfLife = Math.ceil(
      (new Date(expiryDate).getTime() - new Date(productionDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const shelfLife = currentShelfLife > 0 ? currentShelfLife : getDefaultExpiryDays();
    const newExpiryDate = format(addDays(new Date(value), shelfLife), 'yyyy-MM-dd');
    setExpiryDate(newExpiryDate);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || !productionDate || !expiryDate) return;

    // Validate expiry date is after or equal to production date
    const prodDate = new Date(productionDate);
    const expDate = new Date(expiryDate);
    
    if (expDate < prodDate) {
      toast.error('Tanggal expired harus lebih besar atau sama dengan tanggal produksi');
      return;
    }

    try {
      await addBatch.mutateAsync({
        product_id: productId,
        initial_quantity: parseInt(quantity),
        production_date: productionDate,
        expiry_date: expiryDate,
      });
      
      setProductId('');
      setQuantity('');
      setProductionDate(format(new Date(), 'yyyy-MM-dd'));
      setExpiryDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
      setIsOpen(false);
    } catch (error) {
      // Error is already handled by useAddBatch onError
      console.error('Error adding batch:', error);
    }
  };

  const handleRejectBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRejectBatch || !rejectReason.trim()) return;

    const batch = batches?.find(b => b.id === selectedRejectBatch);
    if (!batch) return;

    await rejectBatch.mutateAsync({
      id: selectedRejectBatch,
      quantity: batch.initial_quantity,
      reason: rejectReason.trim(),
    });

    setRejectDialogOpen(false);
    setSelectedRejectBatch(null);
    setRejectReason('');
  };

  const handleEditBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditBatch || !editedQuantity || !editedExpiryDate) return;

    const newQuantity = parseInt(editedQuantity);
    if (newQuantity < 0) {
      toast.error('Jumlah tidak boleh negatif');
      return;
    }

    // Validate expiry date is after or equal to production date
    const prodDate = new Date(selectedEditBatch.production_date);
    const expDate = new Date(editedExpiryDate);
    
    if (expDate < prodDate) {
      toast.error('Tanggal expired harus lebih besar atau sama dengan tanggal produksi');
      return;
    }

    await updateBatchQuantity.mutateAsync({
      id: selectedEditBatch.id,
      quantity: newQuantity,
      expiry_date: editedExpiryDate,
    });

    setEditDialogOpen(false);
    setSelectedEditBatch(null);
    setEditedQuantity('');
    setEditedExpiryDate('');
    toast.success('Batch berhasil diperbarui');
  };

  const handleWarehouseReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWarehouseRejectBatch || !warehouseRejectQuantity) return;

    const quantity = parseInt(warehouseRejectQuantity);
    if (quantity <= 0) {
      toast.error('Jumlah harus lebih dari 0');
      return;
    }

    if (quantity > selectedWarehouseRejectBatch.current_quantity) {
      toast.error(`Jumlah reject tidak boleh lebih dari stok tersedia (${selectedWarehouseRejectBatch.current_quantity})`);
      return;
    }

    await updateWarehouseReject.mutateAsync({
      id: selectedWarehouseRejectBatch.id,
      quantity: quantity,
      reason: warehouseRejectReason.trim() || undefined,
    });

    setWarehouseRejectDialogOpen(false);
    setSelectedWarehouseRejectBatch(null);
    setWarehouseRejectQuantity('');
    setWarehouseRejectReason('');
  };

  const getDaysUntilExpiry = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryStatus = (days: number) => {
    if (days < 0) return { label: 'Expired', class: 'badge-danger' };
    if (days === 0) return { label: 'Hari ini', class: 'badge-danger' };
    if (days <= 3) return { label: `${days} hari`, class: 'badge-warning' };
    return { label: `${days} hari`, class: 'badge-success' };
  };

  // Group and consolidate batches by product name
  const consolidatedBatches = batches?.reduce((acc, batch) => {
    const productName = batch.product?.name || 'Unknown';
    if (!acc[productName]) {
      acc[productName] = {
        productName,
        productId: batch.product_id,
        category: batch.product?.category,
        batches: [],
        totalProduced: 0,
        totalCurrent: 0,
      };
    }
    acc[productName].batches.push(batch);
    acc[productName].totalProduced += batch.initial_quantity;
    acc[productName].totalCurrent += batch.current_quantity;
    return acc;
  }, {} as Record<string, any>) || {};

  // Sort by product name
  const sortedProducts = Object.values(consolidatedBatches).sort((a, b) => 
    a.productName.localeCompare(b.productName)
  );

  return (
    <PageLayout
      title="Produksi"
      subtitle="Kelola batch produksi dan tanggal expired"
      action={
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <button className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Produksi Baru</span>
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Produksi Baru</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-sm font-medium mb-2">Produk</label>
                <Select value={productId} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih produk" />
                  </SelectTrigger>
                  <SelectContent>
                    {products?.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} ({product.category === 'product' ? 'Produk' : 'Add-on'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Rekomendasi: {getDefaultExpiryDays()} hari (bisa disesuaikan)
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Jumlah Produksi</label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Contoh: 50"
                  className="input-field"
                  min="1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">Tanggal Produksi</label>
                  <input
                    type="date"
                    value={productionDate}
                    onChange={(e) => handleProductionDateChange(e.target.value)}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Tanggal Expired</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="input-field"
                    min={productionDate}
                  />
                  {selectedProduct && (
                    <>
                      <p className="text-xs text-muted-foreground mt-1">
                        ({Math.max(0, Math.ceil((new Date(expiryDate).getTime() - new Date(productionDate).getTime()) / (1000 * 60 * 60 * 24)))} hari shelf life)
                      </p>
                      {new Date(expiryDate) < new Date() && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Tanggal expired sudah lewat
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={!productId || !quantity || addBatch.isPending}
              >
                {addBatch.isPending ? 'Menyimpan...' : 'Simpan Produksi'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Consolidated Product List */}
      <div className="space-y-3">
        {sortedProducts.map((consolidated, index) => {
          const isExpanded = expandedProducts[consolidated.productName];
          const latestBatch = consolidated.batches.sort((a, b) => 
            new Date(b.production_date).getTime() - new Date(a.production_date).getTime()
          )[0];
          const daysUntil = latestBatch ? getDaysUntilExpiry(latestBatch.expiry_date) : 0;
          const status = getExpiryStatus(daysUntil);

          return (
            <motion.div
              key={consolidated.productName}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* Summary Row */}
              <button
                onClick={() => setExpandedProducts(prev => ({
                  ...prev,
                  [consolidated.productName]: !prev[consolidated.productName]
                }))}
                className="w-full p-4 hover:bg-muted/30 transition-colors text-left flex items-center justify-between"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center',
                    consolidated.category === 'product'
                      ? 'bg-primary/10 text-primary'
                      : 'bg-secondary/10 text-secondary'
                  )}>
                    <Package className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{consolidated.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {consolidated.batches.length} batch • Produksi: {consolidated.totalProduced} • Sisa: {consolidated.totalCurrent}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className={status.class}>{status.label}</span>
                    {latestBatch && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Exp: {format(new Date(latestBatch.expiry_date), 'dd/MM')}
                      </p>
                    )}
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded Batch Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border bg-muted/20"
                  >
                    <div className="divide-y divide-border">
                      {consolidated.batches
                        .filter(b => b.current_quantity > 0)
                        .sort((a, b) => new Date(b.production_date).getTime() - new Date(a.production_date).getTime())
                        .map((batch) => {
                          const daysUntil = getDaysUntilExpiry(batch.expiry_date);
                          const status = getExpiryStatus(daysUntil);
                          const isRejected = batch.notes?.includes('REJECTED');

                          return (
                            <div key={batch.id} className={cn(
                              'p-3 text-sm',
                              isRejected && 'bg-red-500/5 border-l-4 border-red-500'
                            )}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-muted-foreground">
                                      Produksi: {format(new Date(batch.production_date), 'dd/MM/yy')}
                                    </p>
                                    {isRejected && (
                                      <span className="text-xs bg-red-500/20 text-red-600 px-2 py-0.5 rounded font-medium">
                                        Ditolak
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Awal: {batch.initial_quantity} • Sisa: {batch.current_quantity}
                                  </p>
                                  {batch.warehouse_rejected_quantity && batch.warehouse_rejected_quantity > 0 && (
                                    <p className="text-xs text-orange-600 mt-1">
                                      🔧 Reject Gudang: {batch.warehouse_rejected_quantity} pcs
                                    </p>
                                  )}
                                  {isRejected && batch.notes && (
                                    <p className="text-xs text-red-600 mt-1">
                                      {batch.notes}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="text-right">
                                    <span className={status.class}>{status.label}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {format(new Date(batch.expiry_date), 'dd/MM/yy')}
                                    </p>
                                  </div>
                                  {!isRejected && batch.current_quantity > 0 && (
                                    <div className="flex items-center gap-1">
                                      <Dialog open={editDialogOpen && selectedEditBatch?.id === batch.id} onOpenChange={(open) => {
                                        if (open) {
                                          setEditDialogOpen(true);
                                          setSelectedEditBatch(batch);
                                          setEditedQuantity(batch.current_quantity.toString());
                                          setEditedExpiryDate(batch.expiry_date);
                                        } else {
                                          setEditDialogOpen(false);
                                          setSelectedEditBatch(null);
                                          setEditedQuantity('');
                                          setEditedExpiryDate('');
                                        }
                                      }}>
                                        <DialogTrigger asChild>
                                          <button
                                            className="p-1 text-blue-600 hover:bg-blue-500/10 rounded transition-colors"
                                            title="Edit jumlah stok"
                                          >
                                            <Edit2 className="w-4 h-4" />
                                          </button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2">
                                              <Edit2 className="w-5 h-5" />
                                              Edit Stok Batch
                                            </DialogTitle>
                                          </DialogHeader>
                                          <form onSubmit={handleEditBatch} className="space-y-4 mt-4">
                                            <div>
                                              <p className="text-sm font-medium mb-2">Batch Details</p>
                                              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                                                <p><span className="font-medium">Produk:</span> {batch.product?.name}</p>
                                                <p><span className="font-medium">Produksi:</span> {format(new Date(batch.production_date), 'dd/MM/yyyy')}</p>
                                                <p><span className="font-medium">Awal:</span> {batch.initial_quantity} unit</p>
                                              </div>
                                            </div>
                                            <div>
                                              <label className="block text-sm font-medium mb-2">Jumlah Stok Saat Ini</label>
                                              <input
                                                type="number"
                                                value={editedQuantity}
                                                onChange={(e) => setEditedQuantity(e.target.value)}
                                                placeholder="Jumlah stok"
                                                className="input-field"
                                                min="0"
                                                max={batch.initial_quantity}
                                              />
                                              <p className="text-xs text-muted-foreground mt-1">
                                                Jumlah awal: {batch.initial_quantity} unit
                                              </p>
                                            </div>
                                            <div>
                                              <label className="block text-sm font-medium mb-2">Tanggal Expired</label>
                                              <Popover>
                                                <PopoverTrigger asChild>
                                                  <button
                                                    type="button"
                                                    className="input-field w-full text-left"
                                                  >
                                                    {editedExpiryDate ? format(new Date(editedExpiryDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                                                  </button>
                                                </PopoverTrigger>
                                                <PopoverContent align="start" className="w-auto p-0">
                                                  <Calendar
                                                    mode="single"
                                                    selected={editedExpiryDate ? new Date(editedExpiryDate) : undefined}
                                                    onSelect={(date) => setEditedExpiryDate(date ? format(date, 'yyyy-MM-dd') : '')}
                                                    initialFocus
                                                  />
                                                </PopoverContent>
                                              </Popover>
                                              <p className="text-xs text-muted-foreground mt-1">
                                                Tanggal expired saat ini: {format(new Date(batch.expiry_date), 'dd/MM/yyyy')}
                                              </p>
                                            </div>
                                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                                              <p className="text-xs text-blue-600">
                                                ℹ️ Update ini berguna untuk balancing stok dengan kondisi riil di gudang.
                                              </p>
                                            </div>
                                            <div className="flex gap-2">
                                              <Button
                                                type="submit"
                                                className="flex-1"
                                                disabled={!editedQuantity || !editedExpiryDate || updateBatchQuantity.isPending}
                                              >
                                                {updateBatchQuantity.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
                                              </Button>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setEditDialogOpen(false);
                                                  setSelectedEditBatch(null);
                                                  setEditedQuantity('');
                                                  setEditedExpiryDate('');
                                                }}
                                                className="btn-outline flex-1"
                                              >
                                                Batal
                                              </button>
                                            </div>
                                          </form>
                                        </DialogContent>
                                      </Dialog>
                                      <Dialog open={rejectDialogOpen && selectedRejectBatch === batch.id} onOpenChange={(open) => {
                                        if (open) {
                                          setRejectDialogOpen(true);
                                          setSelectedRejectBatch(batch.id);
                                        } else {
                                          setRejectDialogOpen(false);
                                          setSelectedRejectBatch(null);
                                          setRejectReason('');
                                        }
                                      }}>
                                        <DialogTrigger asChild>
                                          <button
                                            className="p-1 text-red-600 hover:bg-red-500/10 rounded transition-colors"
                                            title="Tandai sebagai reject/rusak"
                                          >
                                            <Trash2 className="w-4 h-4" />
                                          </button>
                                        </DialogTrigger>
                                        <DialogContent>
                                          <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                              <AlertTriangle className="w-5 h-5" />
                                              Tandai Batch Sebagai Reject
                                            </DialogTitle>
                                          </DialogHeader>
                                          <form onSubmit={handleRejectBatch} className="space-y-4 mt-4">
                                          <div>
                                            <p className="text-sm font-medium mb-2">Batch Details</p>
                                            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                                              <p><span className="font-medium">Produk:</span> {batch.product?.name}</p>
                                              <p><span className="font-medium">Jumlah:</span> {batch.initial_quantity} unit</p>
                                              <p><span className="font-medium">Produksi:</span> {format(new Date(batch.production_date), 'dd/MM/yyyy')}</p>
                                              <p><span className="font-medium">Expired:</span> {format(new Date(batch.expiry_date), 'dd/MM/yyyy')}</p>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium mb-2">Alasan Reject</label>
                                            <textarea
                                              value={rejectReason}
                                              onChange={(e) => setRejectReason(e.target.value)}
                                              placeholder="Contoh: Kemasan rusak, warna berubah, dll"
                                              className="input-field min-h-[80px]"
                                              required
                                            />
                                          </div>
                                          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                            <p className="text-xs text-red-600">
                                              ⚠️ Batch ini akan ditandai sebagai reject dan tidak akan bisa didistribusikan.
                                            </p>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              type="submit"
                                              variant="destructive"
                                              className="flex-1"
                                              disabled={!rejectReason.trim() || rejectBatch.isPending}
                                            >
                                              {rejectBatch.isPending ? 'Menyimpan...' : 'Reject Batch'}
                                            </Button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setRejectDialogOpen(false);
                                                setSelectedRejectBatch(null);
                                                setRejectReason('');
                                              }}
                                              className="btn-outline flex-1"
                                            >
                                              Batal
                                            </button>
                                          </div>
                                        </form>
                                      </DialogContent>
                                    </Dialog>
                                    </div>
                                  )}
                                  {batch.current_quantity > 0 && (
                                    <Dialog open={warehouseRejectDialogOpen && selectedWarehouseRejectBatch?.id === batch.id} onOpenChange={(open) => {
                                      if (open) {
                                        setWarehouseRejectDialogOpen(true);
                                        setSelectedWarehouseRejectBatch(batch);
                                        setWarehouseRejectQuantity('');
                                      } else {
                                        setWarehouseRejectDialogOpen(false);
                                        setSelectedWarehouseRejectBatch(null);
                                        setWarehouseRejectQuantity('');
                                        setWarehouseRejectReason('');
                                      }
                                    }}>
                                      <DialogTrigger asChild>
                                        <button
                                          className="p-1 text-orange-600 hover:bg-orange-500/10 rounded transition-colors"
                                          title="Catat barang rusak di gudang"
                                        >
                                          <AlertOctagon className="w-4 h-4" />
                                        </button>
                                      </DialogTrigger>
                                      <DialogContent>
                                        <DialogHeader>
                                          <DialogTitle className="flex items-center gap-2 text-orange-600">
                                            <AlertOctagon className="w-5 h-5" />
                                            Catat Reject Gudang (Barang Rusak)
                                          </DialogTitle>
                                        </DialogHeader>
                                        <form onSubmit={handleWarehouseReject} className="space-y-4 mt-4">
                                          <div>
                                            <p className="text-sm font-medium mb-2">Batch Details</p>
                                            <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                                              <p><span className="font-medium">Produk:</span> {batch.product?.name}</p>
                                              <p><span className="font-medium">Produksi:</span> {format(new Date(batch.production_date), 'dd/MM/yyyy')}</p>
                                              <p><span className="font-medium">Expired:</span> {format(new Date(batch.expiry_date), 'dd/MM/yyyy')}</p>
                                              <p><span className="font-medium">Stok Saat Ini:</span> {batch.current_quantity} unit</p>
                                            </div>
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium mb-2">Jumlah Tambahan Barang Rusak (pcs)</label>
                                            <input
                                              type="number"
                                              value={warehouseRejectQuantity}
                                              onChange={(e) => setWarehouseRejectQuantity(e.target.value)}
                                              placeholder="Contoh: 5"
                                              className="input-field"
                                              min="1"
                                              max={batch.current_quantity}
                                              required
                                            />
                                            <p className="text-xs text-muted-foreground mt-1">
                                              Stok tersedia: {batch.current_quantity} unit • Sudah reject: {batch.warehouse_rejected_quantity || 0} unit
                                            </p>
                                          </div>
                                          <div>
                                            <label className="block text-sm font-medium mb-2">Alasan Kerusakan (Opsional)</label>
                                            <textarea
                                              value={warehouseRejectReason}
                                              onChange={(e) => setWarehouseRejectReason(e.target.value)}
                                              placeholder="Contoh: Kemasan penyok, produk bocor, jamur, dll"
                                              className="input-field min-h-[60px]"
                                            />
                                          </div>
                                          {batch.warehouse_rejected_quantity && batch.warehouse_rejected_quantity > 0 && (
                                            <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                                              <p className="text-xs text-orange-600">
                                                📋 Saat ini ada {batch.warehouse_rejected_quantity} unit yang tercatat rusak.
                                              </p>
                                            </div>
                                          )}
                                          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
                                            <p className="text-xs text-orange-600">
                                              ℹ️ Catat jumlah barang yang rusak/tidak layak jual di gudang untuk laporan akurat.
                                            </p>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              type="submit"
                                              className="flex-1 bg-orange-600 hover:bg-orange-700"
                                              disabled={!warehouseRejectQuantity || updateWarehouseReject.isPending}
                                            >
                                              {updateWarehouseReject.isPending ? 'Menyimpan...' : 'Simpan Reject Gudang'}
                                            </Button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setWarehouseRejectDialogOpen(false);
                                                setSelectedWarehouseRejectBatch(null);
                                                setWarehouseRejectQuantity('');
                                                setWarehouseRejectReason('');
                                              }}
                                              className="btn-outline flex-1"
                                            >
                                              Batal
                                            </button>
                                          </div>
                                        </form>
                                      </DialogContent>
                                    </Dialog>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}

        {sortedProducts.length === 0 && (
          <div className="table-container p-8 text-center text-muted-foreground">
            <Factory className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Belum ada data produksi</p>
            <p className="text-sm">Tambahkan produksi baru untuk memulai</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default ProductionPage;
