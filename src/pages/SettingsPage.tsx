import { useState } from 'react';
import { useProducts } from '@/hooks/useProducts';
import { useRiders } from '@/hooks/useRiders';
import {
  useGlobalDistributionDefaults,
  useUpsertGlobalDistributionDefault,
  useRiderDistributionSettings,
  useUpsertRiderDistributionSetting,
  useDeleteRiderDistributionSetting,
  useProductExpirySettings,
  useUpsertProductExpirySetting,
} from '@/hooks/useSettings';
import { PageLayout } from '@/components/PageLayout';
import { Settings, Package, Truck, Calendar, Plus, Trash2, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function SettingsPage() {
  const { data: products } = useProducts();
  const { data: riders } = useRiders();
  const { data: globalDefaults } = useGlobalDistributionDefaults();
  const { data: expirySettings } = useProductExpirySettings();
  const { data: riderSettings } = useRiderDistributionSettings();

  const upsertGlobalDefault = useUpsertGlobalDistributionDefault();
  const upsertRiderSetting = useUpsertRiderDistributionSetting();
  const deleteRiderSetting = useDeleteRiderDistributionSetting();
  const upsertExpirySetting = useUpsertProductExpirySetting();

  // Global defaults form
  const [globalDefaultProduct, setGlobalDefaultProduct] = useState('');
  const [globalDefaultQuantity, setGlobalDefaultQuantity] = useState('5');

  // Rider settings form
  const [selectedRider, setSelectedRider] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [riderQuantity, setRiderQuantity] = useState('5');

  // Expiry settings form
  const [expiryProduct, setExpiryProduct] = useState('');
  const [shelfLifeDays, setShelfLifeDays] = useState('7');

  const handleAddGlobalDefault = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalDefaultProduct || !globalDefaultQuantity) return;

    try {
      await upsertGlobalDefault.mutateAsync({
        product_id: globalDefaultProduct,
        default_quantity: parseInt(globalDefaultQuantity),
      });
      setGlobalDefaultProduct('');
      setGlobalDefaultQuantity('5');
    } catch (error) {
      console.error('Error adding global default:', error);
    }
  };

  const handleAddRiderSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRider || !selectedProduct || !riderQuantity) return;

    try {
      await upsertRiderSetting.mutateAsync({
        rider_id: selectedRider,
        product_id: selectedProduct,
        default_quantity: parseInt(riderQuantity),
      });
      setSelectedProduct('');
      setRiderQuantity('5');
    } catch (error) {
      console.error('Error adding rider setting:', error);
    }
  };

  const handleAddExpirySetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expiryProduct || !shelfLifeDays) return;

    try {
      await upsertExpirySetting.mutateAsync({
        product_id: expiryProduct,
        default_shelf_life_days: parseInt(shelfLifeDays),
      });
      setExpiryProduct('');
      setShelfLifeDays('7');
    } catch (error) {
      console.error('Error adding expiry setting:', error);
    }
  };

  const getRiderSettingsByRider = (riderId: string) => {
    return riderSettings?.filter(s => s.rider_id === riderId) || [];
  };

  const getGlobalDefault = (productId: string) => {
    return globalDefaults?.find(d => d.product_id === productId)?.default_quantity || 5;
  };

  const getExpirySetting = (productId: string) => {
    return expirySettings?.find(s => s.product_id === productId)?.default_shelf_life_days || 7;
  };

  const getProductName = (productId: string) => {
    return products?.find(p => p.id === productId)?.name || 'Unknown';
  };

  return (
    <PageLayout icon={Settings} title="Pengaturan Distribusi & Produksi">
      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="global" className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            <span className="hidden sm:inline">Global Defaults</span>
          </TabsTrigger>
          <TabsTrigger value="rider" className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            <span className="hidden sm:inline">Rider</span>
          </TabsTrigger>
          <TabsTrigger value="expiry" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Expired</span>
          </TabsTrigger>
        </TabsList>

        {/* GLOBAL DISTRIBUTION DEFAULTS TAB */}
        <TabsContent value="global" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Kuantitas Distribusi</CardTitle>
              <CardDescription>
                Atur kuantitas default untuk setiap produk saat auto-distribution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Form to add global default */}
              <motion.form
                onSubmit={handleAddGlobalDefault}
                className="space-y-4 p-4 border rounded-lg bg-slate-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="global-product">Produk</Label>
                  <Select value={globalDefaultProduct} onValueChange={setGlobalDefaultProduct}>
                    <SelectTrigger id="global-product">
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
                  <Label htmlFor="global-quantity">Kuantitas Default</Label>
                  <Input
                    id="global-quantity"
                    type="number"
                    min="1"
                    value={globalDefaultQuantity}
                    onChange={e => setGlobalDefaultQuantity(e.target.value)}
                    placeholder="Jumlah"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={upsertGlobalDefault.isPending}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {upsertGlobalDefault.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </motion.form>

              {/* List of global defaults */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Pengaturan Saat Ini</h3>
                <AnimatePresence>
                  {globalDefaults && globalDefaults.length > 0 ? (
                    <div className="grid gap-2">
                      {globalDefaults.map(setting => (
                        <motion.div
                          key={setting.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center justify-between p-3 border rounded-lg bg-white"
                        >
                          <div>
                            <p className="font-medium">{setting.product?.name}</p>
                            <p className="text-sm text-slate-600">
                              Default: <span className="font-semibold">{setting.default_quantity}</span> unit
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-4">Belum ada pengaturan global</p>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* RIDER DISTRIBUTION SETTINGS TAB */}
        <TabsContent value="rider" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Distribusi Per Rider</CardTitle>
              <CardDescription>
                Atur kuantitas default untuk setiap produk per rider
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Form to add rider setting */}
              <motion.form
                onSubmit={handleAddRiderSetting}
                className="space-y-4 p-4 border rounded-lg bg-slate-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="rider-select">Rider</Label>
                  <Select value={selectedRider} onValueChange={setSelectedRider}>
                    <SelectTrigger id="rider-select">
                      <SelectValue placeholder="Pilih rider" />
                    </SelectTrigger>
                    <SelectContent>
                      {riders?.map(rider => (
                        <SelectItem key={rider.id} value={rider.id}>
                          {rider.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="product-select">Produk</Label>
                  <Select value={selectedProduct} onValueChange={setSelectedProduct}>
                    <SelectTrigger id="product-select">
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
                  <Label htmlFor="rider-quantity">Kuantitas Default</Label>
                  <Input
                    id="rider-quantity"
                    type="number"
                    min="1"
                    value={riderQuantity}
                    onChange={e => setRiderQuantity(e.target.value)}
                    placeholder="Jumlah"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={upsertRiderSetting.isPending}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {upsertRiderSetting.isPending ? 'Menyimpan...' : 'Tambah Pengaturan'}
                </Button>
              </motion.form>

              {/* List riders with their settings */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Pengaturan Per Rider</h3>
                {riders && riders.length > 0 ? (
                  <div className="grid gap-4">
                    {riders.map(rider => {
                      const riderSettings = getRiderSettingsByRider(rider.id);
                      return (
                        <motion.div
                          key={rider.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="border rounded-lg p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-lg">{rider.name}</p>
                            <span className={cn(
                              'text-sm px-2 py-1 rounded',
                              rider.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            )}>
                              {rider.is_active ? 'Aktif' : 'Tidak Aktif'}
                            </span>
                          </div>

                          {riderSettings.length > 0 ? (
                            <div className="grid gap-2">
                              {riderSettings.map(setting => (
                                <motion.div
                                  key={setting.id}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: 20 }}
                                  className="flex items-center justify-between p-2 bg-slate-50 rounded border"
                                >
                                  <div>
                                    <p className="text-sm font-medium">{setting.product?.name}</p>
                                    <p className="text-xs text-slate-600">
                                      {setting.default_quantity} unit
                                    </p>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteRiderSetting.mutate(setting.id)}
                                    disabled={deleteRiderSetting.isPending}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                  </Button>
                                </motion.div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-slate-500 italic">Belum ada pengaturan khusus</p>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-center text-slate-500 py-4">Tidak ada rider</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRODUCT EXPIRY SETTINGS TAB */}
        <TabsContent value="expiry" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Masa Expired Produk</CardTitle>
              <CardDescription>
                Atur berapa hari masa berlaku produk sejak tanggal produksi
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Form to add expiry setting */}
              <motion.form
                onSubmit={handleAddExpirySetting}
                className="space-y-4 p-4 border rounded-lg bg-slate-50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="expiry-product">Produk</Label>
                  <Select value={expiryProduct} onValueChange={setExpiryProduct}>
                    <SelectTrigger id="expiry-product">
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
                  <Label htmlFor="shelf-life">Masa Berlaku (Hari)</Label>
                  <Input
                    id="shelf-life"
                    type="number"
                    min="1"
                    value={shelfLifeDays}
                    onChange={e => setShelfLifeDays(e.target.value)}
                    placeholder="Jumlah hari"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={upsertExpirySetting.isPending}
                  className="w-full"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {upsertExpirySetting.isPending ? 'Menyimpan...' : 'Simpan Pengaturan'}
                </Button>
              </motion.form>

              {/* List of expiry settings */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Pengaturan Saat Ini</h3>
                <AnimatePresence>
                  {products && products.length > 0 ? (
                    <div className="grid gap-2">
                      {products.map(product => {
                        const shelfLife = getExpirySetting(product.id);
                        return (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="flex items-center justify-between p-3 border rounded-lg bg-white hover:bg-slate-50 transition-colors"
                          >
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-slate-600">
                                Kategori: <span className="font-semibold capitalize">{product.category}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-blue-600">{shelfLife}</p>
                              <p className="text-xs text-slate-500">hari</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center text-slate-500 py-4">Tidak ada produk</p>
                  )}
                </AnimatePresence>
              </div>

              {/* Info box */}
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>💡 Info:</strong> Pengaturan ini akan digunakan secara otomatis saat Anda menginput produk di halaman Produksi.
                  Tanggal expired akan dihitung otomatis berdasarkan tanggal produksi + masa berlaku yang ditetapkan.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

export default SettingsPage;
