import { useState } from 'react';
import { useProducts, useAddProduct, useUpdateProduct, useDeleteProduct } from '@/hooks/useProducts';
import { useProductExpirySettings } from '@/hooks/useSettings';
import { useInventoryBatches, useAddBatch, useRejectBatch, useUpdateBatchQuantity, useUpdateWarehouseReject, useDeleteBatch } from '@/hooks/useInventory';
import { PageLayout } from '@/components/PageLayout';
import { Factory, Plus, Package, Clock, ChevronDown, ChevronUp, Trash2, AlertTriangle, Edit2, AlertOctagon, Coffee, Cookie } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ProductCategory } from '@/types/database';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

function ProductionManagementPage() {
  const { data: products, isLoading: productsLoading } = useProducts();
  const { data: expirySettings } = useProductExpirySettings();
  const { data: batches, isLoading: batchesLoading } = useInventoryBatches();
  const addProduct = useAddProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const addBatch = useAddBatch();
  const rejectBatch = useRejectBatch();
  const updateBatchQuantity = useUpdateBatchQuantity();
  const updateWarehouseReject = useUpdateWarehouseReject();
  const deleteBatch = useDeleteBatch();

  // Production States
  const [isProductionOpen, setIsProductionOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRejectBatch, setSelectedRejectBatch] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedDeleteBatch, setSelectedDeleteBatch] = useState<string | null>(null);
  const [editBatchDialogOpen, setEditBatchDialogOpen] = useState(false);
  const [selectedEditBatch, setSelectedEditBatch] = useState<any>(null);
  const [editBatchQuantity, setEditBatchQuantity] = useState('');
  const [warehouseRejectDialogOpen, setWarehouseRejectDialogOpen] = useState(false);
  const [selectedWarehouseRejectBatch, setSelectedWarehouseRejectBatch] = useState<any>(null);
  const [warehouseRejectQuantity, setWarehouseRejectQuantity] = useState('');
  const [warehouseRejectReason, setWarehouseRejectReason] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [productionDate, setProductionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [expiryDate, setExpiryDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({});

  // Product Management States
  const [isProductOpen, setIsProductOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [productCategory, setProductCategory] = useState<ProductCategory>('product');
  const [productPrice, setProductPrice] = useState('');
  const [priceEditId, setPriceEditId] = useState<string | null>(null);
  const [priceEditValue, setPriceEditValue] = useState('');

  // Production Functions
  const selectedProduct = products?.find(p => p.id === productId);
  
  const getDefaultExpiryDays = () => {
    if (!selectedProduct) return 7;
    
    const setting = expirySettings?.find(s => s.product_id === selectedProduct.id);
    if (setting) {
      return setting.default_shelf_life_days;
    }
    
    return selectedProduct.category === 'product' ? 7 : 3;
  };

  const handleProductChange = (value: string) => {
    setProductId(value);
    const product = products?.find(p => p.id === value);
    if (product) {
      const defaultDays = getDefaultExpiryDays();
      const newExpiryDate = format(addDays(new Date(productionDate), defaultDays), 'yyyy-MM-dd');
      setExpiryDate(newExpiryDate);
    }
  };

  const handleProductionDateChange = (value: string) => {
    setProductionDate(value);
    const currentShelfLife = Math.ceil(
      (new Date(expiryDate).getTime() - new Date(productionDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const shelfLife = currentShelfLife > 0 ? currentShelfLife : getDefaultExpiryDays();
    const newExpiryDate = format(addDays(new Date(value), shelfLife), 'yyyy-MM-dd');
    setExpiryDate(newExpiryDate);
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !quantity || !productionDate || !expiryDate) return;

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
      setIsProductionOpen(false);
    } catch (error) {
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

  const handleDeleteBatch = async () => {
    if (!selectedDeleteBatch) return;
    
    await deleteBatch.mutateAsync(selectedDeleteBatch);
    
    setDeleteDialogOpen(false);
    setSelectedDeleteBatch(null);
  };

  const handleEditBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEditBatch || !editBatchQuantity) return;

    const newQty = parseInt(editBatchQuantity);
    if (isNaN(newQty) || newQty < 0) {
      toast.error('Jumlah stok harus angka positif');
      return;
    }

    if (newQty > selectedEditBatch.initial_quantity) {
      toast.error(`Tidak bisa lebih dari ${selectedEditBatch.initial_quantity} (jumlah diproduksi)`);
      return;
    }

    await updateBatchQuantity.mutateAsync({
      id: selectedEditBatch.id,
      quantity: newQty,
    });

    setEditBatchDialogOpen(false);
    setSelectedEditBatch(null);
    setEditBatchQuantity('');
  };

  // Product Management Functions
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) return;

    if (editingProductId) {
      await updateProduct.mutateAsync({ 
        id: editingProductId, 
        name: productName.trim(), 
        category: productCategory,
        price: productPrice ? parseInt(productPrice) : 0
      });
      setEditingProductId(null);
    } else {
      await addProduct.mutateAsync({ name: productName.trim(), category: productCategory });
    }
    setProductName('');
    setProductPrice('');
    setProductCategory('product');
    setIsProductOpen(false);
  };

  const handleEditProduct = (id: string, currentName: string, currentCategory: ProductCategory, currentPrice?: number) => {
    setEditingProductId(id);
    setProductName(currentName);
    setProductCategory(currentCategory);
    setProductPrice(currentPrice?.toString() || '');
    setIsProductOpen(true);
  };

  const handleCloseProductDialog = () => {
    setIsProductOpen(false);
    setEditingProductId(null);
    setProductName('');
    setProductPrice('');
    setProductCategory('product');
  };

  const handlePriceEdit = async (id: string, newPrice: string) => {
    if (!newPrice || parseInt(newPrice) < 0) return;
    
    await updateProduct.mutateAsync({
      id,
      name: products?.find(p => p.id === id)?.name || '',
      category: products?.find(p => p.id === id)?.category || 'product',
      price: parseInt(newPrice)
    });
    
    setPriceEditId(null);
    setPriceEditValue('');
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('Hapus produk ini? Data inventori terkait juga akan terhapus.')) {
      await deleteProduct.mutateAsync(id);
    }
  };

  const productList = products?.filter(p => p.category === 'product') || [];
  const addonList = products?.filter(p => p.category === 'addon') || [];

  return (
    <PageLayout title="Produksi & Produk" icon={Factory}>
      <Accordion type="single" collapsible defaultValue="production" className="w-full space-y-3">
        
        {/* PRODUCTION ACCORDION */}
        <AccordionItem value="production" className="border border-border rounded-lg px-0 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Factory className="w-5 h-5 text-primary" />
              <div className="text-left">
                <p className="font-semibold">Tambah Batch Produksi</p>
                <p className="text-xs text-muted-foreground">Input produk baru ke gudang</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-4 border-t border-border">
            <div className="space-y-4">
              {/* Add Batch Form */}
              <motion.form
                onSubmit={handleBatchSubmit}
                className="space-y-4 p-4 border border-border rounded-lg bg-muted/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Produk</label>
                  <Select value={productId} onValueChange={handleProductChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih produk" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map(product => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium">Jumlah</label>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Jumlah produk"
                    className="input-field"
                    min="0"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Tanggal Produksi</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="input-field w-full text-left"
                        >
                          {productionDate ? format(new Date(productionDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={productionDate ? new Date(productionDate) : undefined}
                          onSelect={(date) => handleProductionDateChange(date ? format(date, 'yyyy-MM-dd') : '')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">Tanggal Expired</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="input-field w-full text-left bg-blue-50 border-blue-200"
                        >
                          {expiryDate ? format(new Date(expiryDate), 'dd/MM/yyyy') : 'Pilih tanggal'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={expiryDate ? new Date(expiryDate) : undefined}
                          onSelect={(date) => setExpiryDate(date ? format(date, 'yyyy-MM-dd') : '')}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-blue-600">Auto-hitung berdasarkan settings</p>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!productId || !quantity || addBatch.isPending}
                >
                  {addBatch.isPending ? 'Menyimpan...' : 'Tambah Batch'}
                </Button>
              </motion.form>

              {/* Batch List */}
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Daftar Batch
                </h3>
                
                {!batches || batches.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">Belum ada batch</p>
                ) : (
                  <div className="space-y-4">
                    {/* Active Batches */}
                    {(() => {
                      const activeBatches = batches.filter(b => {
                        const daysUntilExpiry = Math.ceil(
                          (new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return b.current_quantity > 0 && daysUntilExpiry >= 0;
                      });
                      
                      if (activeBatches.length === 0) return null;
                      
                      return (
                        <div>
                          <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                            Stok Aktif ({activeBatches.length})
                          </h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {activeBatches.map((batch) => {
                              const isExpanded = expandedProducts[batch.id];
                              const daysUntilExpiry = Math.ceil(
                                (new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                              );
                              const stockPercentage = batch.initial_quantity > 0 
                                ? Math.round((batch.current_quantity / batch.initial_quantity) * 100)
                                : 0;
                              const isExpiring = daysUntilExpiry < 3;

                              return (
                                <div key={batch.id} className="border border-green-200 bg-green-50/50 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => setExpandedProducts(prev => ({ ...prev, [batch.id]: !isExpanded }))}
                                    className="w-full p-3 hover:bg-green-100/50 transition-colors flex items-center justify-between"
                                  >
                                    <div className="text-left flex-1 min-w-0">
                                      <p className="font-medium text-sm">{batch.product?.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(batch.production_date), 'dd/MM/yy')} • Exp: {format(new Date(batch.expiry_date), 'dd/MM/yy')}
                                      </p>
                                    </div>
                                    <div className="text-right text-xs ml-2 flex-shrink-0">
                                      <p className="font-semibold text-sm">{batch.current_quantity} / {batch.initial_quantity}</p>
                                      <div className="flex items-center gap-1">
                                        <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                          <div 
                                            className={`h-full ${stockPercentage > 50 ? 'bg-green-500' : stockPercentage > 25 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                            style={{ width: `${stockPercentage}%` }}
                                          />
                                        </div>
                                        <span className="text-xs font-medium w-8">{stockPercentage}%</span>
                                      </div>
                                      <p className="text-muted-foreground">
                                        {isExpiring ? `⚠️ ${daysUntilExpiry}h` : `${daysUntilExpiry}h`}
                                      </p>
                                    </div>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 ml-2 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                                    )}
                                  </button>

                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="border-t border-green-200 bg-green-100/30 p-3 space-y-2"
                                    >
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="bg-blue-600 hover:bg-blue-700"
                                          onClick={() => {
                                            setSelectedEditBatch(batch);
                                            setEditBatchQuantity(batch.current_quantity.toString());
                                            setEditBatchDialogOpen(true);
                                          }}
                                        >
                                          <Edit2 className="w-3 h-3 mr-1" />
                                          Edit Stok
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => {
                                            setSelectedRejectBatch(batch.id);
                                            setRejectDialogOpen(true);
                                          }}
                                        >
                                          <Trash2 className="w-3 h-3 mr-1" />
                                          Musnahkan
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                          onClick={() => {
                                            setSelectedDeleteBatch(batch.id);
                                            setDeleteDialogOpen(true);
                                          }}
                                        >
                                          <AlertOctagon className="w-3 h-3 mr-1" />
                                          Hapus
                                        </Button>
                                      </div>
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Empty/Expired Batches */}
                    {(() => {
                      const emptyBatches = batches.filter(b => {
                        const daysUntilExpiry = Math.ceil(
                          (new Date(b.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                        );
                        return b.current_quantity === 0 || daysUntilExpiry < 0;
                      });
                      
                      if (emptyBatches.length === 0) return null;
                      
                      return (
                        <div>
                          <h4 className="text-sm font-medium text-gray-500 mb-2 flex items-center gap-2">
                            <span className="inline-block w-2 h-2 bg-gray-400 rounded-full"></span>
                            Habis / Expired ({emptyBatches.length})
                          </h4>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {emptyBatches.map((batch) => {
                              const isExpanded = expandedProducts[batch.id];
                              const daysUntilExpiry = Math.ceil(
                                (new Date(batch.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                              );
                              const isExpired = daysUntilExpiry < 0;

                              return (
                                <div key={batch.id} className="border border-gray-200 bg-gray-50/50 rounded-lg overflow-hidden">
                                  <button
                                    onClick={() => setExpandedProducts(prev => ({ ...prev, [batch.id]: !isExpanded }))}
                                    className="w-full p-3 hover:bg-gray-100/50 transition-colors flex items-center justify-between"
                                  >
                                    <div className="text-left flex-1 min-w-0">
                                      <p className="font-medium text-sm text-gray-600">{batch.product?.name}</p>
                                      <p className="text-xs text-muted-foreground">
                                        {format(new Date(batch.production_date), 'dd/MM/yy')} • Exp: {format(new Date(batch.expiry_date), 'dd/MM/yy')}
                                      </p>
                                    </div>
                                    <div className="text-right text-xs ml-2 flex-shrink-0">
                                      <p className="font-semibold text-sm text-gray-500">0 / {batch.initial_quantity}</p>
                                      <p className="text-muted-foreground">
                                        {isExpired ? '❌ Expired' : '⭕ Habis'}
                                      </p>
                                    </div>
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4 ml-2 flex-shrink-0" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
                                    )}
                                  </button>

                                  {isExpanded && (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="border-t border-gray-200 bg-gray-100/30 p-3 space-y-2"
                                    >
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => {
                                          setSelectedDeleteBatch(batch.id);
                                          setDeleteDialogOpen(true);
                                        }}
                                      >
                                        <AlertOctagon className="w-3 h-3 mr-1" />
                                        Hapus Data
                                      </Button>
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* PRODUCTS ACCORDION */}
        <AccordionItem value="products" className="border border-border rounded-lg px-0 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:bg-muted/50">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-secondary" />
              <div className="text-left">
                <p className="font-semibold">Kelola Produk</p>
                <p className="text-xs text-muted-foreground">Edit produk dan add-on ({products?.length || 0})</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 py-4 border-t border-border">
            <div className="space-y-4">
              {/* Add Product Button */}
              <Dialog open={isProductOpen} onOpenChange={setIsProductOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full flex items-center justify-center gap-2">
                    <Plus className="w-4 h-4" />
                    Tambah Produk
                  </Button>
                </DialogTrigger>
                <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
                  <DialogHeader>
                    <DialogTitle>{editingProductId ? 'Edit Produk' : 'Tambah Produk Baru'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleProductSubmit} className="space-y-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Nama Produk</label>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="Contoh: Kopi Aren"
                        className="input-field"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Kategori</label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setProductCategory('product')}
                          className={cn(
                            'p-4 rounded-xl border-2 transition-all text-left',
                            productCategory === 'product'
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <Coffee className={cn(
                            'w-6 h-6 mb-2',
                            productCategory === 'product' ? 'text-primary' : 'text-muted-foreground'
                          )} />
                          <p className="font-medium text-sm">Produk</p>
                          <p className="text-xs text-muted-foreground">Cup</p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setProductCategory('addon')}
                          className={cn(
                            'p-4 rounded-xl border-2 transition-all text-left',
                            productCategory === 'addon'
                              ? 'border-secondary bg-secondary/5'
                              : 'border-border hover:border-secondary/50'
                          )}
                        >
                          <Cookie className={cn(
                            'w-6 h-6 mb-2',
                            productCategory === 'addon' ? 'text-secondary' : 'text-muted-foreground'
                          )} />
                          <p className="font-medium text-sm">Add-on</p>
                          <p className="text-xs text-muted-foreground">Tambahan</p>
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Harga (Rp)</label>
                      <input
                        type="number"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        placeholder="Contoh: 50000"
                        className="input-field"
                        min="0"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        type="submit" 
                        className="flex-1"
                        disabled={!productName.trim()}
                      >
                        {editingProductId ? 'Simpan Perubahan' : 'Simpan Produk'}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleCloseProductDialog}
                        variant="outline"
                      >
                        Batal
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Products List */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Coffee className="w-4 h-4 text-primary" />
                  Produk ({productList.length})
                </h4>
                <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                  {productList.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada produk</p>
                  ) : (
                    productList.map(product => (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-2 bg-white rounded border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {priceEditId === product.id ? (
                              <input
                                type="number"
                                value={priceEditValue}
                                onChange={(e) => setPriceEditValue(e.target.value)}
                                className="input-field h-6 text-xs"
                                min="0"
                                autoFocus
                                onBlur={() => handlePriceEdit(product.id, priceEditValue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePriceEdit(product.id, priceEditValue);
                                  if (e.key === 'Escape') setPriceEditId(null);
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => {
                                  setPriceEditId(product.id);
                                  setPriceEditValue(product.price?.toString() || '0');
                                }}
                                className="hover:text-primary transition-colors"
                              >
                                Rp {(product.price || 0).toLocaleString('id-ID')}
                              </button>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditProduct(product.id, product.name, product.category, product.price)}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(product.id)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Add-ons List */}
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <Cookie className="w-4 h-4 text-secondary" />
                  Add-on ({addonList.length})
                </h4>
                <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                  {addonList.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Belum ada add-on</p>
                  ) : (
                    addonList.map(addon => (
                      <motion.div
                        key={addon.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center justify-between p-2 bg-white rounded border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{addon.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {priceEditId === addon.id ? (
                              <input
                                type="number"
                                value={priceEditValue}
                                onChange={(e) => setPriceEditValue(e.target.value)}
                                className="input-field h-6 text-xs"
                                min="0"
                                autoFocus
                                onBlur={() => handlePriceEdit(addon.id, priceEditValue)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handlePriceEdit(addon.id, priceEditValue);
                                  if (e.key === 'Escape') setPriceEditId(null);
                                }}
                              />
                            ) : (
                              <button
                                onClick={() => {
                                  setPriceEditId(addon.id);
                                  setPriceEditValue(addon.price?.toString() || '0');
                                }}
                                className="hover:text-primary transition-colors"
                              >
                                Rp {(addon.price || 0).toLocaleString('id-ID')}
                              </button>
                            )}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => handleEditProduct(addon.id, addon.name, addon.category, addon.price)}
                            className="p-1 hover:bg-blue-100 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(addon.id)}
                            className="p-1 hover:bg-red-100 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Reject Batch Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Musnahkan Batch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRejectBatch} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Alasan Pemusnahan</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Rusak, Kadaluarsa, dsb"
                className="input-field min-h-24"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                type="submit"
                variant="destructive"
                disabled={!rejectReason.trim()}
              >
                Musnahkan
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRejectDialogOpen(false)}
              >
                Batal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Batch Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">Hapus Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Tindakan Ini Tidak Bisa Dibatalkan
              </p>
              <p className="text-sm text-red-700">
                Data batch akan dihapus permanen dari sistem. Gunakan tombol ini hanya untuk batch lama yang tidak perlu lagi.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleDeleteBatch}
                disabled={deleteBatch.isPending}
              >
                {deleteBatch.isPending ? 'Menghapus...' : 'Ya, Hapus Batch'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Batal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Batch Dialog */}
      <Dialog open={editBatchDialogOpen} onOpenChange={setEditBatchDialogOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Edit Stok Batch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditBatchSubmit} className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Produk</label>
              <p className="text-sm font-semibold">{selectedEditBatch?.product?.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Diproduksi (Max)</label>
                <input
                  type="number"
                  value={selectedEditBatch?.initial_quantity || 0}
                  disabled
                  className="input-field bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Sisa Stok</label>
                <input
                  type="number"
                  value={editBatchQuantity}
                  onChange={(e) => setEditBatchQuantity(e.target.value)}
                  placeholder="Masukkan jumlah sisa stok"
                  className="input-field"
                  min="0"
                  max={selectedEditBatch?.initial_quantity || 0}
                  autoFocus
                />
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Info:</strong> Anda bisa edit jumlah stok di sini. Misalnya, jika ada produk baru yang habis di produksi, ubah jumlahnya menjadi 0 atau angka yang sesuai. Tidak perlu buat batch baru.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                type="submit"
                className="flex-1"
                disabled={!editBatchQuantity || updateBatchQuantity.isPending}
              >
                {updateBatchQuantity.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditBatchDialogOpen(false)}
              >
                Batal
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

export default ProductionManagementPage;
