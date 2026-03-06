import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Distribution, InventorySummary, InventoryBatch } from '@/types/database';
import { format, isValid } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface ReportData {
  dateRange: { start: string; end: string };
  filterType?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'range';
  batches: InventoryBatch[];
  distributions: Distribution[];
  summary: InventorySummary[];
}

// Helper function to safely format dates
function safeFormat(dateString: string | Date | undefined | null, formatStr: string, options?: any): string {
  if (!dateString) {
    return '-';
  }
  
  try {
    const date = new Date(dateString);
    if (!isValid(date)) {
      return '-';
    }
    return format(date, formatStr, options);
  } catch (error) {
    return '-';
  }
}

// Helper function to safely calculate days until expiry
function safeDaysUntilExpiry(expiryDateStr: string | undefined | null): number {
  if (!expiryDateStr) {
    return -999; // Return large negative number for invalid dates
  }
  
  try {
    const expiryDate = new Date(expiryDateStr);
    if (!isValid(expiryDate)) {
      return -999;
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);
    
    const diff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  } catch (error) {
    return -999;
  }
}

// Helper function to safely get expiry status string
function getSafeExpiryStatus(expiryDateStr: string | undefined | null): string {
  const daysUntil = safeDaysUntilExpiry(expiryDateStr);
  
  if (daysUntil === -999) return '-';
  if (daysUntil < 0) return 'EXPIRED';
  if (daysUntil === 0) return 'Hari ini';
  if (daysUntil === 1) return '1 hari';
  return daysUntil + ' hari';
}

export function generateDailyReport(data: ReportData) {
  // Validate input data
  if (!data || !data.dateRange || !data.dateRange.start || !data.dateRange.end) {
    console.error('Invalid report data: missing dateRange');
    return;
  }
  
  if (!Array.isArray(data.batches) || !Array.isArray(data.distributions) || !Array.isArray(data.summary)) {
    console.error('Invalid report data: missing arrays');
    return;
  }

  const doc = new jsPDF();
  let reportTitle = 'LAPORAN HARIAN INVENTORI';
  let reportDate = safeFormat(data.dateRange.start, 'dd/MM/yyyy');
  
  // Adjust title and date display based on filter type
  if (data.filterType === 'weekly') {
    reportTitle = 'LAPORAN MINGGUAN INVENTORI';
    reportDate = `${safeFormat(data.dateRange.start, 'dd/MM')} - ${safeFormat(data.dateRange.end, 'dd/MM/yyyy')}`;
  } else if (data.filterType === 'monthly') {
    reportTitle = 'LAPORAN BULANAN INVENTORI';
    reportDate = safeFormat(data.dateRange.start, 'MMMM yyyy', { locale: localeId });
  } else if (data.filterType === 'yearly') {
    reportTitle = 'LAPORAN TAHUNAN INVENTORI';
    reportDate = safeFormat(data.dateRange.start, 'yyyy');
  } else if (data.filterType === 'range') {
    reportTitle = 'LAPORAN INVENTORI (CUSTOM RANGE)';
    reportDate = `${safeFormat(data.dateRange.start, 'dd/MM')} - ${safeFormat(data.dateRange.end, 'dd/MM/yyyy')}`;
  }
  
  let yPos = 0;

  const addPageHeader = () => {
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 157, 143);
    doc.text(reportTitle, 105, 15, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Periode: ' + reportDate, 105, 22, { align: 'center' });
    
    doc.setDrawColor(42, 157, 143);
    doc.setLineWidth(0.5);
    doc.line(14, 25, 196, 25);
    
    yPos = 32;
  };

  const checkAndAddPage = (space: number) => {
    if (yPos + space > 270) {
      doc.addPage();
      yPos = 20;
      addPageHeader();
    }
  };

  addPageHeader();

  // Summary Table
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(42, 157, 143);
  doc.text('RINGKASAN STOK PRODUK', 14, yPos);
  yPos += 6;

  let totalCups = 0;
  let totalAddons = 0;
  let totalSold = 0;
  let totalReturned = 0;
  let totalRejected = 0;

  // Ubah header dan tambahkan kolom Keterangan
  const summaryData = data.summary.map(item => {
    const inRider = item.total_distributed - item.total_sold - item.total_returned - item.total_rejected;
    const total = item.total_in_inventory + inRider;
    let keterangan = '';
    if (item.category === 'product') {
      totalCups += total;
    } else {
      totalAddons += total;
    }
    totalSold += item.total_sold;
    totalReturned += item.total_returned;
    totalRejected += item.total_rejected;
    // Contoh keterangan: "Produk utama" atau "Add-on"
    keterangan = item.category === 'product' ? 'Produk utama' : 'Add-on';
    return [
      item.product_name,
      item.category === 'product' ? 'Produk' : 'Add-on',
      item.total_in_inventory.toString(), // Stok Awal
      inRider.toString(), // Penambahan/Masuk
      (item.total_sold || 0).toString(),
      total.toString(), // Stok Akhir
      keterangan,
    ];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Produk', 'Tipe', 'Stok Awal', 'Penambahan/Masuk', 'Terjual', 'Stok Akhir', 'Keterangan']],
    body: summaryData,
    theme: 'grid',
    headStyles: { 
      fillColor: [42, 157, 143],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      textColor: [50, 50, 50],
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [240, 248, 248],
    },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { halign: 'left' },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Metrik Utama sesuai periode bulan
  checkAndAddPage(30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(42, 157, 143);
  doc.text('METRIK UTAMA', 14, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(60, 60, 60);
  doc.text('Total Cup: ' + totalCups + ' unit', 14, yPos);
  yPos += 5;
  doc.text('Total Add-on: ' + totalAddons + ' unit', 14, yPos);
  yPos += 5;
  doc.text('Total Terjual: ' + totalSold + ' unit', 14, yPos);
  yPos += 5;
  doc.text('Total Dikembalikan: ' + totalReturned + ' unit', 14, yPos);
  yPos += 5;
  doc.text('Total Ditolak/Rusak: ' + totalRejected + ' unit', 14, yPos);
  yPos += 10;

  // === REKAPITULASI PENJUALAN RIDER & DETAIL ===
  if (data.distributions && data.distributions.length > 0) {
    checkAndAddPage(40);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 157, 143);
    doc.text('REKAPITULASI PENJUALAN RIDER', 14, yPos);
    yPos += 6;

    // Group by rider
    const riderMap = new Map();
    data.distributions.forEach(dist => {
      const rider = dist.rider?.name || 'Tanpa Nama';
      if (!riderMap.has(rider)) {
        riderMap.set(rider, { produk: 0, nominal: 0 });
      }
      const sold = dist.sold_quantity || 0;
      const price = dist.batch?.product?.price || 0;
      riderMap.get(rider).produk += sold;
      riderMap.get(rider).nominal += sold * price;
    });
    const riderRows = Array.from(riderMap.entries()).map(([rider, val]) => [
      rider,
      val.produk.toString(),
      'Rp ' + val.nominal.toLocaleString('id-ID'),
    ]);
    // Total keseluruhan
    const totalProduk = Array.from(riderMap.values()).reduce((a, b) => a + b.produk, 0);
    const totalNominal = Array.from(riderMap.values()).reduce((a, b) => a + b.nominal, 0);

    autoTable(doc, {
      startY: yPos,
      head: [['Rider', 'Total Produk Terjual', 'Total Nominal Penjualan']],
      body: riderRows,
      theme: 'grid',
      headStyles: {
        fillColor: [42, 157, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [240, 248, 248],
      },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(42, 157, 143);
    doc.text(`TOTAL KESELURUHAN: ${totalProduk} produk | Rp ${totalNominal.toLocaleString('id-ID')}`, 14, yPos);
    yPos += 10;

    // === DETAIL PENJUALAN PRODUK PER RIDER ===
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 157, 143);
    doc.text('DETAIL PENJUALAN PRODUK RIDER', 14, yPos);
    yPos += 6;
    // Tabel: Rider | Produk | Terjual | Kembali | Reject | Nominal | Cup Terjual
    // Cup hanya dihitung jika kategori produk 'product'
    const detailRows = [];
    const riderDetailMap = new Map();
    data.distributions.forEach(dist => {
      const rider = dist.rider?.name || 'Tanpa Nama';
      const product = dist.batch?.product?.name || '-';
      const sold = dist.sold_quantity || 0;
      const returned = dist.returned_quantity || 0;
      const rejected = dist.rejected_quantity || 0;
      const price = dist.batch?.product?.price || 0;
      const nominal = sold * price;
      const isCup = dist.batch?.product?.category === 'product';
      const cupTerjual = isCup ? sold : 0;
      if (!riderDetailMap.has(rider)) {
        riderDetailMap.set(rider, { totalNominal: 0, totalCup: 0 });
      }
      riderDetailMap.get(rider).totalNominal += nominal;
      riderDetailMap.get(rider).totalCup += cupTerjual;
      detailRows.push([
        rider,
        product,
        sold.toString(),
        returned.toString(),
        rejected.toString(),
        'Rp ' + nominal.toLocaleString('id-ID'),
        cupTerjual.toString(),
      ]);
    });
    // Sort by rider
    detailRows.sort((a, b) => a[0].localeCompare(b[0]));
    // Insert subtotal per rider
    let lastRider = null;
    for (let i = 0; i < detailRows.length; i++) {
      const rider = detailRows[i][0];
      if (lastRider !== null && lastRider !== rider) {
        // subtotal for lastRider
        const subtotal = riderDetailMap.get(lastRider);
        detailRows.splice(i, 0, [
          `SUBTOTAL: ${lastRider}`,
          '', '', '', '',
          'Rp ' + subtotal.totalNominal.toLocaleString('id-ID'),
          subtotal.totalCup.toString()
        ]);
        i++;
      }
      lastRider = rider;
    }
    // Add subtotal for last rider
    if (lastRider && riderDetailMap.has(lastRider)) {
      const subtotal = riderDetailMap.get(lastRider);
      detailRows.push([
        `SUBTOTAL: ${lastRider}`,
        '', '', '', '',
        'Rp ' + subtotal.totalNominal.toLocaleString('id-ID'),
        subtotal.totalCup.toString()
      ]);
    }
    autoTable(doc, {
      startY: yPos,
      head: [['Rider', 'Produk', 'Terjual', 'Kembali', 'Reject', 'Nominal', 'Cup Terjual']],
      body: detailRows,
      theme: 'grid',
      headStyles: {
        fillColor: [42, 157, 143],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [240, 248, 248],
      },
      didParseCell: (data) => {
        if (data.cell.text?.[0]?.includes('SUBTOTAL:')) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [220, 240, 240];
        }
      },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // PAGE 2: Production & Distribution
  doc.addPage();
  yPos = 20;
  addPageHeader();

  // Filter batches based on filter type - with safe date validation
  const filterBatches = data.batches.filter(b => {
    if (!b.production_date) return false;
    
    try {
      const batchDate = new Date(b.production_date);
      const startDate = new Date(data.dateRange.start);
      const endDate = new Date(data.dateRange.end);
      
      if (!isValid(batchDate) || !isValid(startDate) || !isValid(endDate)) {
        return false;
      }
      
      batchDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);
      
      return batchDate >= startDate && batchDate <= endDate;
    } catch (error) {
      return false;
    }
  });
  if (filterBatches.length > 0) {
    doc.addPage();
    yPos = 20;
    addPageHeader();
    const prodTitle = data.filterType === 'daily' ? 'PRODUKSI HARI INI' : 'PRODUKSI DALAM PERIODE';
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 157, 143);
    doc.text(prodTitle, 14, yPos);
    yPos += 6;

    const prodData = filterBatches.map(b => [
      b.product?.name || '-',
      b.initial_quantity.toString(),
      safeFormat(b.production_date, 'dd/MM/yyyy'),
      safeFormat(b.expiry_date, 'dd/MM/yyyy'),
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Produk', 'Qty', 'Produksi', 'Kadaluarsa']],
      body: prodData,
      theme: 'grid',
      headStyles: { 
        fillColor: [42, 157, 143],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [240, 248, 248],
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // === REJECT SUMMARY ===
  const riderRejected = data.distributions.reduce((acc, d) => acc + (d.rejected_quantity || 0), 0);
  if (riderRejected > 0) {
    doc.addPage();
    yPos = 20;
    addPageHeader();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 60, 60); // Red color for reject
    doc.text('❌ PRODUK DITOLAK/RUSAK (RIDER)', 14, yPos);
    yPos += 6;

    // Combine reject data: Rider | Produk | Qty Ditolak
    const rejectDetailData = data.distributions
      .filter(d => d.rejected_quantity > 0)
      .map(d => [
        d.rider?.name || 'Unknown',
        d.batch?.product?.name || 'Unknown',
        (d.rejected_quantity || 0).toString(),
      ]);

    if (rejectDetailData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Rider', 'Produk', 'Qty Ditolak']],
        body: rejectDetailData,
        theme: 'grid',
        headStyles: { 
          fillColor: [200, 60, 60],
          textColor: [255, 255, 255],
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: {
          textColor: [50, 50, 50],
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: [255, 240, 240],
        },
        columnStyles: {
          0: { cellWidth: 50 }, // Rider column
          1: { cellWidth: 80 }, // Produk column
          2: { halign: 'center', cellWidth: 30 }, // Qty Ditolak column centered
        },
        margin: { left: 14, right: 14 },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;
    }
  }

  // === INVENTORY DETAILS ===
  const batchData = data.batches.filter(b => b.current_quantity > 0)
    .map(b => [
      b.product?.name || '-',
      b.current_quantity.toString(),
      safeFormat(b.production_date, 'dd/MM/yyyy'),
      safeFormat(b.expiry_date, 'dd/MM/yyyy'),
      getSafeExpiryStatus(b.expiry_date),
    ]);
  if (batchData.length > 0) {
    doc.addPage();
    yPos = 20;
    addPageHeader();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 157, 143);
    doc.text('DETAIL BATCH INVENTORI', 14, yPos);
    yPos += 6;

    autoTable(doc, {
      startY: yPos,
      head: [['Produk', 'Stok', 'Produksi', 'Kadaluarsa', 'Sisa Hari']],
      body: batchData,
      theme: 'grid',
      headStyles: { 
        fillColor: [42, 157, 143],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [240, 248, 248],
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Expiry Warnings - with safe date validation
  const allBatches = data.batches;
  const almostExpired = allBatches.filter(b => {
    if (!b.expiry_date || b.current_quantity <= 0) return false;
    const daysUntil = safeDaysUntilExpiry(b.expiry_date);
    return daysUntil >= 0 && daysUntil <= 3;
  });

  const alreadyExpired = allBatches.filter(b => {
    if (!b.expiry_date || b.current_quantity <= 0 || (b.notes && b.notes.includes('REJECTED'))) return false;
    const daysUntil = safeDaysUntilExpiry(b.expiry_date);
    return daysUntil < 0;
  });

  // Section: Almost Expired (≤3 hari)
  if (almostExpired.length > 0) {
    checkAndAddPage(50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(245, 158, 11);
    doc.text('PRODUK AKAN EXPIRED (≤3 HARI)', 14, yPos);
    yPos += 6;

    const almostExpiredData = almostExpired.map(b => {
      const daysUntil = safeDaysUntilExpiry(b.expiry_date);
      const daysText = daysUntil === 0 ? 'Hari ini!' : daysUntil + ' hari';
      return [
        b.product?.name || '-',
        b.current_quantity.toString(),
        safeFormat(b.production_date, 'dd/MM/yyyy'),
        safeFormat(b.expiry_date, 'dd/MM/yyyy'),
        daysText,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Produk', 'Stok', 'Produksi', 'Kadaluarsa', 'Sisa Hari']],
      body: almostExpiredData,
      theme: 'grid',
      headStyles: { 
        fillColor: [245, 158, 11],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [255, 243, 224],
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Section: Already Expired
  if (alreadyExpired.length > 0) {
    checkAndAddPage(50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(239, 68, 68);
    doc.text('PRODUK SUDAH EXPIRED', 14, yPos);
    yPos += 6;

    const expiredData = alreadyExpired.map(b => {
      const daysUntil = safeDaysUntilExpiry(b.expiry_date);
      return [
        b.product?.name || '-',
        b.current_quantity.toString(),
        safeFormat(b.production_date, 'dd/MM/yyyy'),
        safeFormat(b.expiry_date, 'dd/MM/yyyy'),
        Math.abs(daysUntil) + ' hari lalu',
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Produk', 'Stok', 'Produksi', 'Kadaluarsa', 'Sudah Expired']],
      body: expiredData,
      theme: 'grid',
      headStyles: { 
        fillColor: [239, 68, 68],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [254, 226, 226],
      },
      margin: { left: 14, right: 14 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // Rejection Data
  const rejectedBatches = data.batches.filter(b => b.notes && b.notes.includes('REJECTED'));
  
  if (rejectedBatches.length > 0) {
    checkAndAddPage(50);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('PRODUK DIMUSNAHKAN', 14, yPos);
    yPos += 6;

    const rejectionData = rejectedBatches.map(b => {
      const notesMatch = b.notes?.match(/REJECTED: (.+?) at/);
      const reason = notesMatch ? notesMatch[1] : 'Expired';
      return [
        b.product?.name || '-',
        b.initial_quantity?.toString() || '0',
        safeFormat(b.production_date, 'dd/MM/yyyy'),
        safeFormat(b.expiry_date, 'dd/MM/yyyy'),
        reason,
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Produk', 'Jumlah', 'Produksi', 'Kadaluarsa', 'Alasan']],
      body: rejectionData,
      theme: 'grid',
      headStyles: { 
        fillColor: [220, 38, 38],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      bodyStyles: {
        textColor: [50, 50, 50],
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [255, 240, 240],
      },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.line(14, 285, 196, 285);
    doc.text('Halaman ' + i + ' dari ' + pageCount, 105, 290, { align: 'center' });
    doc.text('Dibuat: ' + safeFormat(new Date(), 'dd/MM/yyyy HH:mm'), 105, 296, { align: 'center' });
  }

  // Generate filename based on filter type and date range
  let filename = 'Laporan_Inventori_';
  if (data.filterType === 'daily') {
    filename += safeFormat(data.dateRange.start, 'yyyy-MM-dd') + '.pdf';
  } else if (data.filterType === 'weekly' || data.filterType === 'range') {
    filename += safeFormat(data.dateRange.start, 'yyyy-MM-dd') + '_to_' + 
               safeFormat(data.dateRange.end, 'yyyy-MM-dd') + '.pdf';
  } else if (data.filterType === 'monthly') {
    filename += safeFormat(data.dateRange.start, 'MM-yyyy') + '.pdf';
  } else if (data.filterType === 'yearly') {
    filename += safeFormat(data.dateRange.start, 'yyyy') + '.pdf';
  } else {
    filename += safeFormat(data.dateRange.start, 'yyyy-MM-dd') + '.pdf';
  }
  
  doc.save(filename);
}
