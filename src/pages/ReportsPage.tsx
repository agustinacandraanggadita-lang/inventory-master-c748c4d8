import { useState } from 'react';
import { useInventoryBatches, useInventorySummary } from '@/hooks/useInventory';
import { useDistributions, useUpdateDistribution } from '@/hooks/useDistributions';
import { PageLayout } from '@/components/PageLayout';
import { FileText, Download, Calendar, Coffee, Package, ChevronDown, X, Edit2, Trash2 } from 'lucide-react';
import { format, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, addDays } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { generateDailyReport } from '@/lib/pdfReport';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type FilterType = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'range';

function ReportsPage() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  
  const [filterType, setFilterType] = useState<FilterType>('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [rangeStart, setRangeStart] = useState(format(addDays(today, -7), 'yyyy-MM-dd'));
  const [rangeEnd, setRangeEnd] = useState(todayStr);
  const [expandedSections, setExpandedSections] = useState<{
    periodSummary: boolean;
    productDetail: boolean;
    distributionDetail: boolean;
  }>({
    periodSummary: false,
    productDetail: false,
    distributionDetail: false,
  });
  
  // Modal state for rider details
  const [selectedRiderName, setSelectedRiderName] = useState<string | null>(null);
  const [isRiderModalOpen, setIsRiderModalOpen] = useState(false);
  const [riderModalData, setRiderModalData] = useState<Array<{
    id: string;
    productName: string;
    productPrice: number;
    quantity: number;
    soldQty: number;
    returnedQty: number;
    rejectedQty: number;
  }>>([]);
  const [editingDistId, setEditingDistId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, { sold: string; returned: string; rejected: string }>>({});
  
  const { data: batches } = useInventoryBatches();
  const { data: summary } = useInventorySummary();
  
  // Determine date range based on filter type (moved before hook call)
  const getDateRange = () => {
    const baseDate = new Date(selectedDate);
    
    switch (filterType) {
      case 'daily':
        return { start: selectedDate, end: selectedDate };
      case 'weekly': {
        const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
        return { 
          start: format(weekStart, 'yyyy-MM-dd'), 
          end: format(weekEnd, 'yyyy-MM-dd') 
        };
      }
      case 'monthly': {
        const monthStart = startOfMonth(baseDate);
        const monthEnd = endOfMonth(baseDate);
        return { 
          start: format(monthStart, 'yyyy-MM-dd'), 
          end: format(monthEnd, 'yyyy-MM-dd') 
        };
      }
      case 'yearly': {
        const yearStart = startOfYear(baseDate);
        const yearEnd = endOfYear(baseDate);
        return { 
          start: format(yearStart, 'yyyy-MM-dd'), 
          end: format(yearEnd, 'yyyy-MM-dd') 
        };
      }
      case 'range':
        return { start: rangeStart, end: rangeEnd };
      default:
        return { start: selectedDate, end: selectedDate };
    }
  };

  const dateRange = getDateRange();
  const { data: distributions } = useDistributions(undefined, dateRange);
  const updateDistribution = useUpdateDistribution();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingDistributions, setIsSavingDistributions] = useState(false);

  // Filter data based on date range
  // Get batch IDs from distributions in the date range (to ensure we only show batches that were actually distributed)
  const batchIdInDistributions = new Set(distributions?.map(d => d.batch_id) || []);

  // Filter batches - either by production date OR if they appear in distributions for this period
  const filteredBatches = batches?.filter(b => {
    const bDate = b.production_date;
    const isInDateRange = bDate >= dateRange.start && bDate <= dateRange.end;
    const isInDistribution = batchIdInDistributions.has(b.id);
    // Show batch if it was produced in this period OR if it was distributed in this period
    return isInDateRange || isInDistribution;
  }) || [];

  // Distributions are already filtered by dateRange from hook, no need to filter again
  const filteredDistributions = distributions || [];

  // Dapatkan daftar rider unik dari distribusi
  const riderList = Array.from(new Set(filteredDistributions.map(d => d.rider?.name).filter(Boolean)));

  // Tambahkan filter rider
  const [riderFilter, setRiderFilter] = useState<string>('all'); // 'all' untuk seluruh rider

  // Filter distribusi sesuai rider jika riderFilter != 'all'
  const filteredDistributionsByRider = riderFilter === 'all'
    ? filteredDistributions
    : filteredDistributions.filter(d => d.rider?.name === riderFilter);

  // Calculate summary stats
  const calculateStats = (batchesData: typeof batches, distData: typeof distributions) => {
    let totalProduced = 0;
    let totalDistributed = 0;
    let totalSold = 0;
    let totalReturned = 0;
    let totalRejected = 0;
    let totalWarehouseRejected = 0;

    batchesData?.forEach(b => {
      totalProduced += b.initial_quantity;
      totalWarehouseRejected += b.warehouse_rejected_quantity || 0;
    });

    distData?.forEach(d => {
      totalDistributed += d.quantity;
      totalSold += d.sold_quantity || 0;
      totalReturned += d.returned_quantity || 0;
      totalRejected += d.rejected_quantity || 0;
    });

    return { totalProduced, totalDistributed, totalSold, totalReturned, totalRejected, totalWarehouseRejected };
  };

  const stats = calculateStats(filteredBatches, filteredDistributionsByRider);

  const todayBatches = filteredBatches || [];
  const totalCups = summary?.filter(s => s.category === 'product')
    .reduce((acc, s) => acc + s.total_in_inventory, 0) || 0;
  const totalAddons = summary?.filter(s => s.category === 'addon')
    .reduce((acc, s) => acc + s.total_in_inventory, 0) || 0;

  // Open rider modal with their details
  const openRiderModal = (riderName: string) => {
    const riderDists = filteredDistributions.filter(d => d.rider?.name === riderName);
    const modalData = riderDists.map(dist => ({
      id: dist.id,
      productName: dist.batch?.product?.name || 'Unknown',
      productPrice: dist.batch?.product?.price || 0,
      quantity: dist.quantity,
      soldQty: dist.sold_quantity || 0,
      returnedQty: dist.returned_quantity || 0,
      rejectedQty: dist.rejected_quantity || 0,
    }));
    
    setRiderModalData(modalData);
    setSelectedRiderName(riderName);
    // Initialize editing values
    const initialEdits: Record<string, { sold: string; returned: string; rejected: string }> = {};
    modalData.forEach(item => {
      initialEdits[item.id] = {
        sold: item.soldQty.toString(),
        returned: item.returnedQty.toString(),
        rejected: item.rejectedQty.toString(),
      };
    });
    setEditingValues(initialEdits);
    setEditingDistId(null);
    setIsRiderModalOpen(true);
  };

  const handleGenerateReport = async () => {
    if (!batches || !summary) return;
    setIsGenerating(true);
    try {
      generateDailyReport({
        dateRange: dateRange,
        filterType: filterType,
        batches: filteredBatches,
        distributions: filteredDistributionsByRider, // gunakan filter rider
        summary: summary,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveEditedDistributions = async () => {
    if (Object.keys(editingValues).length === 0) return;

    setIsSavingDistributions(true);
    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      // Process each edited item
      for (const item of riderModalData) {
        const editVal = editingValues[item.id];
        if (!editVal) continue; // Skip if not edited

        const newSold = parseInt(editVal.sold || '0');
        const newReturned = parseInt(editVal.returned || '0');
        const newRejected = parseInt(editVal.rejected || '0');

        // Check if there are actual changes
        if (
          newSold === item.soldQty &&
          newReturned === item.returnedQty &&
          newRejected === item.rejectedQty
        ) {
          continue; // No changes, skip
        }

        // Validate total doesn't exceed quantity
        const total = newSold + newReturned + newRejected;
        if (total > item.quantity) {
          errors.push(
            `${item.productName}: Total melebihi jumlah dikirim (${total} > ${item.quantity})`
          );
          errorCount++;
          continue;
        }

        try {
          await updateDistribution.mutateAsync({
            id: item.id,
            sold_quantity: newSold,
            returned_quantity: newReturned,
          });
          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(
            `${item.productName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }

      if (successCount > 0) {
        // Clear editing state
        setEditingValues({});
        setEditingDistId(null);
      }

      // Show result message
      if (errorCount === 0) {
        // Success - modal will close due to clearing editingValues
        setIsRiderModalOpen(false);
      } else if (successCount > 0) {
        alert(
          `${successCount} item berhasil disimpan.\n\nGagal: ${errors.join('; ')}`
        );
      } else {
        alert(`Gagal menyimpan perubahan:\n${errors.join('\n')}`);
      }
    } finally {
      setIsSavingDistributions(false);
    }
  };

  // Format display date range
  const getDisplayDateRange = () => {
    const start = new Date(dateRange.start);
    const end = new Date(dateRange.end);
    
    if (filterType === 'daily') {
      return format(start, 'EEEE, dd MMMM yyyy', { locale: localeId });
    } else if (filterType === 'weekly') {
      return `${format(start, 'dd MMM')} - ${format(end, 'dd MMMM yyyy', { locale: localeId })}`;
    } else if (filterType === 'monthly') {
      return format(start, 'MMMM yyyy', { locale: localeId });
    } else if (filterType === 'yearly') {
      return format(start, 'yyyy');
    }
    return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
  };

  return (
    <PageLayout
      title="Laporan"
      subtitle="Buat dan unduh laporan inventori"
      action={
        <Button
          onClick={handleGenerateReport}
          disabled={isGenerating || !batches}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">
            {isGenerating ? 'Membuat...' : 'Unduh PDF'}
          </span>
        </Button>
      }
    >
      {/* Filter Type Selection */}
      <div className="mb-6 p-4 bg-gradient-to-r from-primary/5 to-secondary/5 rounded-lg border border-primary/20">
        <label className="block text-sm font-semibold mb-3 text-foreground">📅 Tipe Laporan</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { id: 'daily', label: '📆 Harian' },
            { id: 'weekly', label: '📊 Mingguan' },
            { id: 'monthly', label: '📈 Bulanan' },
            { id: 'yearly', label: '📉 Tahunan' },
            { id: 'range', label: '📍 Custom' },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setFilterType(id as FilterType)}
              className={cn(
                'py-2 px-3 rounded-lg text-sm font-medium transition-all border',
                filterType === id
                  ? 'bg-primary text-primary-foreground border-primary shadow-md'
                  : 'bg-background border-border hover:border-primary/50 hover:bg-primary/5'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Selection */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        {filterType === 'range' ? (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Pilih Rentang Tanggal</label>
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="date"
                value={rangeStart}
                onChange={(e) => setRangeStart(e.target.value)}
                className="input-field flex-1"
              />
              <span className="text-muted-foreground">sampai</span>
              <input
                type="date"
                value={rangeEnd}
                onChange={(e) => setRangeEnd(e.target.value)}
                className="input-field flex-1"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">Pilih Tanggal Referensi</label>
            <div className="flex gap-3 items-center">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input-field flex-1 max-w-xs"
              />
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="btn-outline text-sm"
              >
                Hari Ini
              </button>
            </div>
          </div>
        )}
        
        <div className="mt-3 p-2 bg-primary/5 rounded border border-primary/20">
          <p className="text-sm text-foreground">
            <Calendar className="w-4 h-4 inline mr-2" />
            <strong>Periode:</strong> {getDisplayDateRange()}
          </p>
        </div>
      </div>

      {/* Filter Rider */}
      <div className="mb-6 p-4 bg-card border border-border rounded-lg">
        <label className="block text-sm font-semibold mb-3">Filter Rider</label>
        <select
          value={riderFilter}
          onChange={e => setRiderFilter(e.target.value)}
          className="input-field max-w-xs"
        >
          <option value="all">Seluruh Rider</option>
          {riderList.map(rider => (
            <option key={rider} value={rider}>{rider}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="stat-card bg-primary/5 border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Coffee className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium">Total Cup</span>
          </div>
          <p className="stat-value text-primary">{totalCups}</p>
          <p className="text-xs text-muted-foreground">stok saat ini</p>
        </div>
        <div className="stat-card bg-secondary/5 border-secondary/20">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-5 h-5 text-secondary" />
            <span className="text-sm font-medium">Total Add-on</span>
          </div>
          <p className="stat-value text-secondary">{totalAddons}</p>
          <p className="text-xs text-muted-foreground">stok saat ini</p>
        </div>
        <div className="stat-card bg-green-500/5 border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">📦 Diproduksi</span>
          </div>
          <p className="stat-value text-green-600">{stats.totalProduced}</p>
          <p className="text-xs text-muted-foreground">periode ini</p>
        </div>
        <div className="stat-card bg-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">📈 Terjual</span>
          </div>
          <p className="stat-value text-blue-600">{stats.totalSold}</p>
          <p className="text-xs text-muted-foreground">periode ini</p>
        </div>
        <div className="stat-card bg-red-500/5 border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">❌ Reject Rider</span>
          </div>
          <p className="stat-value text-red-600">{stats.totalRejected}</p>
          <p className="text-xs text-muted-foreground">periode ini</p>
        </div>
        <div className="stat-card bg-orange-500/5 border-orange-500/20">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">🔧 Reject Gudang</span>
          </div>
          <p className="stat-value text-orange-600">{stats.totalWarehouseRejected}</p>
          <p className="text-xs text-muted-foreground">periode ini</p>
        </div>
      </div>

      {/* Period Summary */}
      <Collapsible
        open={expandedSections.periodSummary}
        onOpenChange={(open) =>
          setExpandedSections({ ...expandedSections, periodSummary: open })
        }
        className="table-container mb-6"
      >
        <CollapsibleTrigger className="w-full">
          <div className="p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <h3 className="font-semibold">📊 Ringkasan Periode</h3>
            <ChevronDown
              className={cn(
                'w-5 h-5 transition-transform',
                expandedSections.periodSummary ? 'rotate-180' : ''
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Total Diproduksi</span>
              <span className="font-semibold text-lg">{stats.totalProduced} unit</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Total Didistribusi</span>
              <span className="font-semibold text-lg">{stats.totalDistributed} unit</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Total Terjual</span>
              <span className="font-semibold text-lg text-green-600">{stats.totalSold} unit</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Total Dikembalikan</span>
              <span className="font-semibold text-lg text-orange-600">{stats.totalReturned} unit</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-border/50">
              <span className="text-muted-foreground">Total Ditolak/Rusak (Rider)</span>
              <span className="font-semibold text-lg text-red-600">{stats.totalRejected} unit</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Total Rusak di Gudang (Warehouse)</span>
              <span className="font-semibold text-lg text-orange-600">{stats.totalWarehouseRejected} unit</span>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Product Summary */}
      <Collapsible
        open={expandedSections.productDetail}
        onOpenChange={(open) =>
          setExpandedSections({ ...expandedSections, productDetail: open })
        }
        className="table-container"
      >
        <CollapsibleTrigger className="w-full">
          <div className="p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
            <h3 className="font-semibold">Detail per Produk</h3>
            <ChevronDown
              className={cn(
                'w-5 h-5 transition-transform',
                expandedSections.productDetail ? 'rotate-180' : ''
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y divide-border">
            {summary?.map((item) => {
              const inRider = item.total_distributed - item.total_sold - item.total_returned - item.total_rejected;
              const total = item.total_in_inventory + inRider;
              
              return (
                <div key={item.product_id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.product_name}</span>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        item.category === 'product' 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-secondary/10 text-secondary'
                      )}>
                        {item.category === 'product' ? 'Cup' : 'Add-on'}
                      </span>
                    </div>
                    <span className="font-semibold">{total}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Di Gudang: {item.total_in_inventory}</span>
                    <span>Di Rider: {inRider}</span>
                    <span>Terjual: {item.total_sold}</span>
                    {item.total_warehouse_rejected > 0 && (
                      <span className="text-orange-600">Rusak Gudang: {item.total_warehouse_rejected}</span>
                    )}
                    {item.total_rejected > 0 && (
                      <span className="text-red-600">Reject Rider: {item.total_rejected}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {(!summary || summary.length === 0) && (
              <div className="p-8 text-center text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Belum ada data untuk laporan</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Rekapitulasi Rider - Total Keseluruhan */}
      {filteredDistributions && filteredDistributions.length > 0 && (
        <div className="table-container mt-6">
          <div className="p-4 border-b border-border bg-green-500/10">
            <h3 className="font-semibold">🧮 Total Rekapitulasi Rider</h3>
            <p className="text-xs text-muted-foreground mt-1">Total produk dan nominal penjualan seluruh rider pada periode ini</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Total Produk Terjual</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">Total Nominal Penjualan</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let totalProduk = 0;
                  let totalNominal = 0;
                  filteredDistributions.forEach(dist => {
                    totalProduk += dist.sold_quantity || 0;
                    totalNominal += (dist.sold_quantity || 0) * (dist.batch?.product?.price || 0);
                  });
                  return (
                    <tr className="border-b border-border bg-white">
                      <td className="px-4 py-3 font-semibold text-green-600">{totalProduk} unit</td>
                      <td className="px-4 py-3 font-semibold text-blue-600">Rp {totalNominal.toLocaleString('id-ID')}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rider Sales Summary - untuk perhitungan fee */}
      {filteredDistributionsByRider && filteredDistributionsByRider.length > 0 && (
        <div className="table-container mt-6">
          <div className="p-4 border-b border-border bg-blue-500/5">
            <h3 className="font-semibold">💰 Rekapitulasi Penjualan Per Rider</h3>
            <p className="text-xs text-muted-foreground mt-1">Untuk perhitungan fee/komisi rider</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-semibold">Rider</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Qty Dikirim</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-green-600">📦 Terjual</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-blue-600">💰 Nominal</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-orange-600">🔄 Kembali</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-red-600">❌ Ditolak</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">Sisa/Hilang</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const riderSummary = new Map<string, {
                    rider: string;
                    totalQty: number;
                    totalSold: number;
                    totalNominal: number;
                    totalReturned: number;
                    totalRejected: number;
                  }>();

                  filteredDistributionsByRider.forEach(dist => {
                    const rider = dist.rider?.name || 'Unknown';
                    if (!riderSummary.has(rider)) {
                      riderSummary.set(rider, {
                        rider,
                        totalQty: 0,
                        totalSold: 0,
                        totalNominal: 0,
                        totalReturned: 0,
                        totalRejected: 0,
                      });
                    }
                    const summary = riderSummary.get(rider)!;
                    const soldQty = dist.sold_quantity || 0;
                    const price = dist.batch?.product?.price || 0;
                    summary.totalQty += dist.quantity;
                    summary.totalSold += soldQty;
                    summary.totalNominal += soldQty * price;
                    summary.totalReturned += dist.returned_quantity || 0;
                    summary.totalRejected += dist.rejected_quantity || 0;
                  });

                  // Sort by totalNominal descending (highest revenue first)
                  const sortedRiders = Array.from(riderSummary.values())
                    .sort((a, b) => b.totalNominal - a.totalNominal);

                  return sortedRiders.map((item, idx) => {
                    const remaining = item.totalQty - item.totalSold - item.totalReturned - item.totalRejected;
                    return (
                      <tr key={item.rider} className={cn(
                        'border-b border-border',
                        idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'
                      )}>
                        <td className="px-4 py-3 font-medium">
                          <button
                            onClick={() => openRiderModal(item.rider)}
                            className="text-primary hover:underline cursor-pointer transition-colors hover:text-primary/80"
                            title="Klik untuk melihat detail penjualan"
                          >
                            {item.rider}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{item.totalQty}</td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-green-600">{item.totalSold}</td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-blue-600">
                          Rp {item.totalNominal.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-orange-600">{item.totalReturned}</td>
                        <td className="px-4 py-3 text-center text-sm font-semibold text-red-600">{item.totalRejected}</td>
                        <td className="px-4 py-3 text-center text-sm font-medium">{remaining}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-border bg-muted/30 text-xs text-muted-foreground">
            <p><strong>💡 Tips Perhitungan Fee:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-1 ml-2">
              <li>Gunakan kolom <strong>Nominal</strong> untuk menghitung komisi langsung dari revenue</li>
              <li>Contoh: Jika fee 10%, maka Rider A = Rp 1.000.000 × 10% = Rp 100.000</li>
              <li>Atau gunakan kolom "Terjual" untuk komisi per unit</li>
            </ul>
          </div>
        </div>
      )}

      {/* Distributions for Selected Date - Detail */}
      {filteredDistributions && filteredDistributions.length > 0 && (
        <Collapsible
          open={expandedSections.distributionDetail}
          onOpenChange={(open) =>
            setExpandedSections({ ...expandedSections, distributionDetail: open })
          }
          className="table-container mt-6"
        >
          <CollapsibleTrigger className="w-full">
            <div className="p-4 border-b border-border flex items-center justify-between hover:bg-muted/50 transition-colors">
              <h3 className="font-semibold">🚚 Detail Distribusi Periode Ini</h3>
              <ChevronDown
                className={cn(
                  'w-5 h-5 transition-transform',
                  expandedSections.distributionDetail ? 'rotate-180' : ''
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="divide-y divide-border">
              {filteredDistributions.map((dist) => (
                <div key={dist.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{dist.rider?.name}</p>
                    <p className="text-sm text-muted-foreground">{dist.batch?.product?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Batch: {format(new Date(dist.batch?.production_date || ''), 'dd/MM')} - Exp: {format(new Date(dist.batch?.expiry_date || ''), 'dd/MM')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{dist.quantity} unit</p>
                    <p className="text-xs text-muted-foreground">
                      Terjual: {dist.sold_quantity || 0} • Retur: {dist.returned_quantity || 0} • Tolak: {dist.rejected_quantity || 0}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Reject Summary by Product */}
      {filteredDistributions && filteredDistributions.some(d => d.rejected_quantity > 0) && (
        <div className="table-container mt-6">
          <div className="p-4 border-b border-border bg-red-500/5">
            <h3 className="font-semibold">❌ Detail Produk yang Ditolak/Rusak</h3>
          </div>
          <div className="divide-y divide-border">
            {(() => {
              const rejectMap = new Map<string, { product: string, quantity: number, count: number }>();
              filteredDistributions.forEach(dist => {
                if (dist.rejected_quantity > 0) {
                  const key = dist.batch?.product?.name || 'Unknown';
                  const existing = rejectMap.get(key) || { product: key, quantity: 0, count: 0 };
                  existing.quantity += dist.rejected_quantity;
                  existing.count += 1;
                  rejectMap.set(key, existing);
                }
              });
              return Array.from(rejectMap.values()).map((item) => (
                <div key={item.product} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.product}</p>
                    <p className="text-xs text-muted-foreground">{item.count} kalinya ditolak</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{item.quantity} unit</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Reject Summary by Rider */}
      {filteredDistributions && filteredDistributions.some(d => d.rejected_quantity > 0) && (
        <div className="table-container mt-6">
          <div className="p-4 border-b border-border bg-red-500/5">
            <h3 className="font-semibold">👤 Penolakan Per Rider</h3>
          </div>
          <div className="divide-y divide-border">
            {(() => {
              const riderRejectMap = new Map<string, { rider: string, quantity: number, count: number }>();
              filteredDistributions.forEach(dist => {
                if (dist.rejected_quantity > 0) {
                  const rider = dist.rider?.name || 'Unknown';
                  const existing = riderRejectMap.get(rider) || { rider, quantity: 0, count: 0 };
                  existing.quantity += dist.rejected_quantity;
                  existing.count += 1;
                  riderRejectMap.set(rider, existing);
                }
              });
              return Array.from(riderRejectMap.values()).map((item) => (
                <div key={item.rider} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{item.rider}</p>
                    <p className="text-xs text-muted-foreground">{item.count} produk ditolak</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600">{item.quantity} unit</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Rider Details Modal */}
      <Dialog open={isRiderModalOpen} onOpenChange={setIsRiderModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📋 Detail Penjualan - {selectedRiderName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {riderModalData.map((item) => {
              const isEditing = editingDistId === item.id;
              const editVal = editingValues[item.id] || {
                sold: item.soldQty.toString(),
                returned: item.returnedQty.toString(),
                rejected: item.rejectedQty.toString(),
              };
              const remaining =
                item.quantity -
                parseInt(editVal.sold || '0') -
                parseInt(editVal.returned || '0') -
                parseInt(editVal.rejected || '0');

              return (
                <div
                  key={item.id}
                  className="border border-border rounded-lg p-4 space-y-3 bg-muted/20"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{item.productName}</h4>
                      <p className="text-xs text-muted-foreground">
                        Harga: Rp {item.productPrice.toLocaleString('id-ID')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Total Dikirim: <span className="font-semibold">{item.quantity} unit</span>
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        setEditingDistId(isEditing ? null : item.id)
                      }
                      className="p-2 hover:bg-primary/10 rounded-lg transition-colors"
                      title={isEditing ? 'Batal edit' : 'Edit data'}
                    >
                      <Edit2 className="w-4 h-4 text-primary" />
                    </button>
                  </div>

                  {isEditing ? (
                    <div className="bg-card rounded-lg p-3 space-y-3 border border-primary/20">
                      <p className="text-xs font-medium text-primary">✏️ Edit Status Penjualan</p>

                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium block mb-1">
                            📦 Terjual
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={editVal.sold || ''}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  sold: e.target.value,
                                },
                              }))
                            }
                            className="input-field text-xs h-8 w-full"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium block mb-1">
                            🔄 Dikembalikan
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={editVal.returned || ''}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  returned: e.target.value,
                                },
                              }))
                            }
                            className="input-field text-xs h-8 w-full"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium block mb-1">
                            ❌ Ditolak
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={item.quantity}
                            value={editVal.rejected || ''}
                            onChange={(e) =>
                              setEditingValues((prev) => ({
                                ...prev,
                                [item.id]: {
                                  ...prev[item.id],
                                  rejected: e.target.value,
                                },
                              }))
                            }
                            className="input-field text-xs h-8 w-full"
                          />
                        </div>
                      </div>

                      {remaining < 0 && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-2 text-xs text-red-600">
                          ⚠️ Total melebihi jumlah yang dikirim! Sisa: {remaining} unit
                        </div>
                      )}

                      <div className="bg-muted/50 rounded p-2 text-xs">
                        <p className="font-medium">
                          Sisa Stok: <span className="text-primary">{remaining}</span> unit
                        </p>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setEditingDistId(null)}
                          className="btn-primary text-xs h-8 px-3 flex-1"
                        >
                          ✓ Selesai Edit
                        </button>
                        <button
                          onClick={() => {
                            setEditingValues((prev) => ({
                              ...prev,
                              [item.id]: {
                                sold: item.soldQty.toString(),
                                returned: item.returnedQty.toString(),
                                rejected: item.rejectedQty.toString(),
                              },
                            }));
                            setEditingDistId(null);
                          }}
                          className="btn-outline text-xs h-8 px-3 flex-1"
                        >
                          ✕ Batal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-3 bg-card rounded-lg p-3">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Terjual</p>
                        <p className="font-semibold text-sm text-green-600">
                          {item.soldQty}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Dikembalikan</p>
                        <p className="font-semibold text-sm text-orange-600">
                          {item.returnedQty}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Ditolak</p>
                        <p className="font-semibold text-sm text-red-600">
                          {item.rejectedQty}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3 space-y-2">
              <p className="text-xs font-medium text-blue-600">💡 Tips Penggunaan:</p>
              <ul className="text-xs text-blue-600/80 space-y-1 ml-4">
                <li>• Klik 🖊️ untuk edit status penjualan</li>
                <li>• Pastikan total tidak melebihi jumlah yang dikirim</li>
                <li>• Gunakan untuk koreksi jika ada kesalahan input sebelumnya</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={() => setIsRiderModalOpen(false)}
                variant="outline"
                className="flex-1"
              >
                Tutup
              </Button>
              <Button
                variant="default"
                className="flex-1"
                disabled={Object.keys(editingValues).length === 0 || isSavingDistributions}
                onClick={handleSaveEditedDistributions}
              >
                {isSavingDistributions ? '⏳ Menyimpan...' : '💾 Simpan Perubahan'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

export default ReportsPage;
