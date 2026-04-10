import { useRef, useState, useMemo } from 'react';
import { useRiderLeaderboard } from '@/hooks/useLeaderboard';
import { Trophy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfToday, startOfWeek, startOfMonth, endOfToday, endOfWeek, endOfMonth } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import html2canvas from 'html2canvas';

export function Leaderboard() {
  const leaderboardRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'today' | 'week' | 'month'>('today');

  // Calculate date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (activeFilter) {
      case 'today':
        const tStart = startOfToday();
        const tEnd = endOfToday();
        return {
          start: format(tStart, 'yyyy-MM-dd'),
          end: format(tEnd, 'yyyy-MM-dd'),
        };
      case 'week':
        const wStart = startOfWeek(now, { weekStartsOn: 1 });
        const wEnd = endOfWeek(now, { weekStartsOn: 1 });
        return {
          start: format(wStart, 'yyyy-MM-dd'),
          end: format(wEnd, 'yyyy-MM-dd'),
        };
      case 'month':
        const mStart = startOfMonth(now);
        const mEnd = endOfMonth(now);
        return {
          start: format(mStart, 'yyyy-MM-dd'),
          end: format(mEnd, 'yyyy-MM-dd'),
        };
      default:
        const today = startOfToday();
        return {
          start: format(today, 'yyyy-MM-dd'),
          end: format(today, 'yyyy-MM-dd'),
        };
    }
  }, [activeFilter]);

  const { leaderboard, totalCupsSold } = useRiderLeaderboard(dateRange);

  const downloadAsImage = async () => {
    if (!leaderboardRef.current) return;

    try {
      setIsDownloading(true);

      const canvas = await html2canvas(leaderboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      });

      const link = document.createElement('a');
      const timestamp = format(new Date(), 'yyyy-MM-dd-HH-mm-ss', { locale: localeId });
      link.download = `leaderboard-rider-${timestamp}.png`;
      link.href = canvas.toDataURL();
      link.click();

      toast.success('Leaderboard berhasil diunduh');
    } catch (error) {
      console.error('Error downloading leaderboard:', error);
      toast.error('Gagal mengunduh leaderboard');
    } finally {
      setIsDownloading(false);
    }
  };

  const getFilterLabel = () => {
    switch (activeFilter) {
      case 'today':
        return 'Hari Ini';
      case 'week':
        return 'Minggu Ini';
      case 'month':
        return 'Bulan Ini';
      default:
        return 'Periode';
    }
  };

  if (!leaderboard || leaderboard.length === 0) {
    return (
      <div className="table-container mt-6">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Leaderboard Rider CUP
          </h3>
        </div>
        <div className="p-8 text-center text-muted-foreground">
          <Trophy className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Belum ada penjualan dalam periode ini</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container mt-6">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            Leaderboard Rider CUP
          </h3>
          <button
            onClick={downloadAsImage}
            disabled={isDownloading}
            className="btn-outline flex items-center gap-2 text-sm h-9"
          >
            <Download className="w-4 h-4" />
            {isDownloading ? 'Mengunduh...' : 'Unduh Gambar'}
          </button>
        </div>

        {/* Quick Access Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveFilter('today')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeFilter === 'today'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Hari Ini
          </button>
          <button
            onClick={() => setActiveFilter('week')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeFilter === 'week'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Minggu Ini
          </button>
          <button
            onClick={() => setActiveFilter('month')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeFilter === 'month'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Bulan Ini
          </button>
        </div>
      </div>

      <div
        ref={leaderboardRef}
        className="bg-white p-6"
      >
        {/* Header untuk export */}
        <div className="mb-6 pb-4 border-b-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Leaderboard Rider CUP</h2>
          <p className="text-sm text-gray-600 mt-1">
            {getFilterLabel()} • {activeFilter === 'today' ? format(new Date(), 'dd MMMM yyyy', { locale: localeId }) : `${dateRange.start} s/d ${dateRange.end}`}
          </p>
          <p className="text-lg font-semibold text-primary mt-2">
            Total: {totalCupsSold} cup terjual
          </p>
        </div>

        {/* Leaderboard Content */}
        <div className="divide-y divide-gray-200">
          {leaderboard.map((entry, index) => {
            const medalIcon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;

            return (
              <div
                key={entry.rider_id}
                className={`py-4 flex items-center gap-4 ${
                  index < 3 ? 'bg-gray-50' : ''
                }`}
              >
                {/* Ranking */}
                <div className="flex-shrink-0 w-12 text-center">
                  {medalIcon ? (
                    <span className="text-2xl">{medalIcon}</span>
                  ) : (
                    <span className="text-lg font-bold text-gray-600">
                      {entry.rank}
                    </span>
                  )}
                </div>

                {/* Rider Info */}
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">
                    {entry.rider_name}
                  </p>
                </div>

                {/* Total Cups */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xl font-bold text-primary">
                    {entry.total_cups}
                  </p>
                  <p className="text-xs text-gray-500">cup</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t-2 border-gray-200 text-center text-xs text-gray-500">
          Generated {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
        </div>
      </div>
    </div>
  );
}
