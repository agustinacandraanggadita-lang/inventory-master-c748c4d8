import { useState } from 'react';
import { useCanteenSales, useCreateCanteenSale, useDeleteCanteenSale, useUpdateCanteenSale } from '@/hooks/useCanteenSales';
import { PageLayout } from '@/components/PageLayout';
import { Coffee, Plus, Trash2, Edit2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import type { CanteenType, CanteenSale } from '@/types/database';

export function CanteenPage() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');

  const { data: canteenSales, isLoading } = useCanteenSales({ start: monthStart, end: monthEnd });
  const createCanteen = useCreateCanteenSale();
  const deleteCanteen = useDeleteCanteenSale();
  const updateCanteen = useUpdateCanteenSale();

  // Dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [canteen, setCanteen] = useState<CanteenType>('Kantin Garuda');
  const [cupsSold, setCupsSold] = useState('');
  const [saleDate, setSaleDate] = useState(today);
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setCanteen('Kantin Garuda');
    setCupsSold('');
    setSaleDate(today);
    setNotes('');
    setEditingId(null);
  };

  const handleOpenDialog = (sale?: CanteenSale) => {
    if (sale) {
      setEditingId(sale.id);
      setCanteen(sale.canteen);
      setCupsSold(String(sale.cups_sold));
      setSaleDate(sale.sale_date);
      setNotes(sale.notes || '');
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!cupsSold || isNaN(Number(cupsSold)) || Number(cupsSold) < 0) {
      toast.error('Jumlah cup harus angka positif');
      return;
    }

    if (editingId) {
      await updateCanteen.mutateAsync({
        id: editingId,
        canteen,
        cups_sold: Number(cupsSold),
        sale_date: saleDate,
        notes: notes || undefined,
      });
    } else {
      await createCanteen.mutateAsync({
        canteen,
        cups_sold: Number(cupsSold),
        sale_date: saleDate,
        notes: notes || undefined,
      });
    }

    handleCloseDialog();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Yakin ingin menghapus data ini?')) {
      await deleteCanteen.mutateAsync(id);
    }
  };

  // Group sales by canteen
  const salesByCanteen = {
    'Kantin Garuda': canteenSales?.filter((s) => s.canteen === 'Kantin Garuda') || [],
    'Kantin BTB AU': canteenSales?.filter((s) => s.canteen === 'Kantin BTB AU') || [],
  };

  const totalByCanteen = {
    'Kantin Garuda': salesByCanteen['Kantin Garuda'].reduce((acc, s) => acc + s.cups_sold, 0),
    'Kantin BTB AU': salesByCanteen['Kantin BTB AU'].reduce((acc, s) => acc + s.cups_sold, 0),
  };

  const grandTotal = totalByCanteen['Kantin Garuda'] + totalByCanteen['Kantin BTB AU'];

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Memuat data...</div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Coffee className="w-8 h-8 text-orange-600" />
              Manajemen Penjualan Kantin
            </h1>
            <p className="text-muted-foreground mt-1">
              Input penjualan cup dari Kantin Garuda dan Kantin BTB AU
            </p>
          </div>
          <Button
            onClick={() => handleOpenDialog()}
            className="gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            Tambah Penjualan Kantin
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kantin Garuda */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-orange-100">
                <Coffee className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Kantin Garuda</p>
                <p className="text-2xl font-bold">{totalByCanteen['Kantin Garuda']}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {salesByCanteen['Kantin Garuda'].length} transaksi
                </p>
              </div>
            </div>
          </div>

          {/* Kantin BTB AU */}
          <div className="p-6 rounded-lg border border-border bg-card hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100">
                <Coffee className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Kantin BTB AU</p>
                <p className="text-2xl font-bold">{totalByCanteen['Kantin BTB AU']}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {salesByCanteen['Kantin BTB AU'].length} transaksi
                </p>
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="p-6 rounded-lg border border-border bg-gradient-to-br from-primary to-primary/80 text-primary-foreground hover:shadow-md transition-shadow">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-white/20">
                <Coffee className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm opacity-90">Total Penjualan</p>
                <p className="text-2xl font-bold">{grandTotal}</p>
                <p className="text-xs opacity-75 mt-1">
                  {canteenSales?.length || 0} transaksi
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Kantin Garuda Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-orange-50">
              <h3 className="font-semibold text-orange-900">📍 Kantin Garuda</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Tanggal</th>
                    <th className="px-4 py-2 text-right">Cup</th>
                    <th className="px-4 py-2 text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {salesByCanteen['Kantin Garuda'].length > 0 ? (
                    salesByCanteen['Kantin Garuda'].map((sale) => (
                      <tr key={sale.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-2">
                          {format(new Date(sale.sale_date), 'dd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {sale.cups_sold}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleOpenDialog(sale)}
                              className="p-1 hover:bg-primary/10 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={() => handleDelete(sale.id)}
                              className="p-1 hover:bg-destructive/10 rounded"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        Belum ada penjualan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Kantin BTB AU Table */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border bg-blue-50">
              <h3 className="font-semibold text-blue-900">📍 Kantin BTB AU</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left">Tanggal</th>
                    <th className="px-4 py-2 text-right">Cup</th>
                    <th className="px-4 py-2 text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {salesByCanteen['Kantin BTB AU'].length > 0 ? (
                    salesByCanteen['Kantin BTB AU'].map((sale) => (
                      <tr key={sale.id} className="hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-2">
                          {format(new Date(sale.sale_date), 'dd MMM yyyy', { locale: localeId })}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">
                          {sale.cups_sold}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => handleOpenDialog(sale)}
                              className="p-1 hover:bg-primary/10 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4 text-primary" />
                            </button>
                            <button
                              onClick={() => handleDelete(sale.id)}
                              className="p-1 hover:bg-destructive/10 rounded"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        Belum ada penjualan
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Form */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Penjualan Kantin' : 'Tambah Penjualan Kantin'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="canteen">Kantin</Label>
              <Select value={canteen} onValueChange={(value) => setCanteen(value as CanteenType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kantin Garuda">Kantin Garuda</SelectItem>
                  <SelectItem value="Kantin BTB AU">Kantin BTB AU</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cupsSold">Jumlah Cup Terjual</Label>
              <Input
                id="cupsSold"
                type="number"
                placeholder="Masukkan jumlah cup"
                value={cupsSold}
                onChange={(e) => setCupsSold(e.target.value)}
                min="0"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="saleDate">Tanggal Penjualan</Label>
              <Input
                id="saleDate"
                type="date"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Catatan (Opsional)</Label>
              <Textarea
                id="notes"
                placeholder="Tambahkan catatan..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={createCanteen.isPending || updateCanteen.isPending}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={createCanteen.isPending || updateCanteen.isPending}
              >
                {createCanteen.isPending || updateCanteen.isPending
                  ? 'Menyimpan...'
                  : 'Simpan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
