# Fitur Status Rider (Aktif/Non-Aktif)

## Deskripsi
Fitur ini memungkinkan Anda untuk menandai rider sebagai aktif atau tidak aktif (resign) tanpa harus menghapus data rider. Rider yang ditandai tidak aktif tidak akan muncul di leaderboard penjualan.

## Alasan Penambahan Fitur
- Beberapa rider mungkin sudah resign tetapi masih memiliki penjualan di bulan sebelumnya
- Data rider tidak perlu dihapus, hanya ditandai sebagai tidak aktif untuk tracking historis
- Leaderboard akan lebih akurat hanya menampilkan rider yang masih aktif

## Fitur

### 1. Toggle Status di Halaman Distribusi
- Pada halaman Distribusi, di bagian "Daftar Rider" terdapat setiap rider card
- Setiap rider card memiliki dua button:
  - **Power Off Button** (kuning) - Untuk menandai rider sebagai tidak aktif
  - **Power Button** (hijau) - Untuk menandai rider kembali aktif
  - **Trash Button** (merah) - Untuk menghapus rider (fitur lama)

**Responsiveness:**
- **Desktop** (layar > 768px): Button hanya muncul saat di-hover
- **Mobile** (layar ≤ 768px): Button **selalu terlihat** (tidak perlu hover)

### 2. Visual Status
- Rider yang **aktif**: tampil normal dengan opacity penuh
- Rider yang **tidak aktif**: tampil dengan opacity 60% dan label "Tidak Aktif" berwarna merah
- Rider tidak aktif tidak bisa dipilih untuk distribusi

### 3. Leaderboard
- Hanya rider dengan status `is_active = true` yang muncul di leaderboard penjualan
- Rider yang resign (is_active = false) tidak akan tercatat di leaderboard

## 📱 Mobile Responsiveness

Fitur ini **fully responsive** dan dioptimalkan untuk mobile devices:

### Desktop (≥ 768px)
```
┌──────────────────────┐
│ [👤] Rider Name      │ ← Button hanya muncul saat hover
│      08xx            │
└──────────────────────┘
        ↓ hover
┌──────────────────────┐
│ [👤] Rider Name  🔘🗑️│ ← Power + Trash button muncul
│      08xx            │
└──────────────────────┘
```

### Mobile (< 768px)
```
┌──────────────────────┐
│ [👤] Rider Name  🔘🗑️│ ← Button SELALU terlihat
│      08xx            │   (tidak perlu hover)
└──────────────────────┘
```

**Keuntungan:**
- ✅ Tidak perlu scroll horizontal untuk akses button di mobile
- ✅ Button ukuran kecil tapi tetap mudah di-tap
- ✅ Layout tetap rapi dan tidak berantakan
- ✅ Fully touch-friendly

## Database Changes

### Migration File
File: `supabase/migrations/20260529_add_rider_status.sql`

```sql
-- Add is_active column to riders table for tracking active/inactive riders
ALTER TABLE public.riders
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add updated_at column if not exists
ALTER TABLE public.riders
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_riders_is_active ON public.riders(is_active);
```

### Langkah Setup
1. Buka Supabase Dashboard: https://app.supabase.com
2. Login ke project Inventory Master
3. Pilih **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy & paste SQL migration di atas
6. Klik **Run**
7. Tunggu sampai selesai

## Files yang Diubah

### Backend
- `src/types/database.ts` - Update Rider interface
- `src/integrations/supabase/types.ts` - Update Supabase types
- `src/hooks/useRiders.ts` - Tambah hook `useUpdateRiderStatus()`
- `src/hooks/useLeaderboard.ts` - Filter rider aktif di leaderboard

### Frontend
- `src/pages/DistributionPage.tsx` - Tambah UI toggle status rider

## Cara Menggunakan

### Menandai Rider Sebagai Tidak Aktif
1. Buka halaman **Distribusi**
2. Pada rider card yang ingin ditandai tidak aktif, hover over untuk menampilkan buttons
3. Klik button **Power Off** (kuning)
4. Rider akan langsung berubah status menjadi tidak aktif
5. Rider tidak akan muncul di leaderboard

### Menandai Rider Kembali Aktif
1. Buka halaman **Distribusi**
2. Pada rider card yang sudah tidak aktif (tampak lebih transparan), hover over
3. Klik button **Power** (hijau)
4. Rider akan langsung berubah status menjadi aktif
5. Rider akan kembali muncul di leaderboard jika memiliki penjualan

### Menghapus Rider (Tetap Ada)
- Jika ingin benar-benar menghapus rider dari database, gunakan button **Trash** (merah)
- Warning: Tindakan ini tidak dapat dibatalkan

## Field Database Baru

| Field | Type | Default | Deskripsi |
|-------|------|---------|-----------|
| is_active | BOOLEAN | true | Status rider (aktif/tidak aktif) |
| updated_at | TIMESTAMPTZ | now() | Waktu terakhir data rider diupdate |

## API Hooks

### useUpdateRiderStatus()
```typescript
const updateRiderStatus = useUpdateRiderStatus();

// Usage
updateRiderStatus.mutate({ 
  id: riderId, 
  is_active: false // atau true
});
```

Respons:
- Success: Toast "Rider berhasil diubah menjadi aktif/tidak aktif"
- Error: Toast "Gagal mengubah status rider: [error message]"
