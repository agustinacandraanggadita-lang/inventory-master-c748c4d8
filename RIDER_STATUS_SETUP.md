# Setup Rider Status Feature

## 🚀 Quick Setup Guide

### Step 1: Jalankan SQL Migration

Buka Supabase Dashboard dan jalankan SQL query berikut:

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

**Langkah di Supabase:**
1. Buka https://app.supabase.com
2. Login ke project **Inventory Master**
3. Klik **SQL Editor** di sidebar kiri
4. Klik **New Query**
5. Copy & paste SQL di atas
6. Klik **Run**
7. Tunggu sampai selesai (Anda akan melihat "Query completed successfully")

### Step 2: Verifikasi Migration

Setelah SQL selesai, verifikasi dengan query berikut:

```sql
-- Lihat struktur tabel riders
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'riders' 
ORDER BY ordinal_position;
```

Expected output akan menampilkan kolom baru:
- `is_active` - `boolean` - `not null`
- `updated_at` - `timestamp with time zone` - `nullable`

### Step 3: Verifikasi di Aplikasi

1. Refresh browser untuk clear cache
2. Buka halaman **Distribusi**
3. Lihat rider cards - sekarang harus memiliki power button baru di hover
4. Test toggle status - klik power button dan lihat apakah status berubah

## 🔄 Migration Details

### Kolom Baru Ditambahkan:

```
Tabel: riders

1. is_active (BOOLEAN)
   - Default: true
   - Constraint: NOT NULL
   - Deskripsi: Menandai apakah rider masih aktif atau tidak

2. updated_at (TIMESTAMPTZ)
   - Default: now()
   - Constraint: NULL (optional)
   - Deskripsi: Waktu terakhir data rider diupdate
```

### Index Dibuat:
- `idx_riders_is_active` - Untuk query cepat filter active riders

## 📊 Data Existing

Semua rider existing secara otomatis akan memiliki:
- `is_active = true` (aktif)
- `updated_at = NULL` (atau waktu sekarang)

Tidak ada data yang hilang atau dihapus.

## ✅ Fitur Setelah Setup

1. **Di Halaman Distribusi:**
   - Hover rider card → power button muncul
   - Klik power button → toggle status aktif/tidak aktif
   - Rider tidak aktif tampil lebih transparan

2. **Di Leaderboard:**
   - Hanya rider aktif yang ditampilkan
   - Rider tidak aktif tidak muncul meski punya penjualan sebelumnya

## 🆘 Troubleshooting

### Q: Power button tidak muncul
**A:** 
- Refresh halaman browser (Ctrl+F5 atau Cmd+Shift+R)
- Clear browser cache
- Check browser console untuk error

### Q: Toggle tidak bekerja
**A:**
- Check apakah SQL migration sudah berhasil dijalankan
- Buka browser DevTools → Network tab → saat klik power button, lihat apakah ada error response

### Q: Leaderboard masih menampilkan rider tidak aktif
**A:**
- Pastikan rider memiliki penjualan sebelum ditandai tidak aktif
- Leaderboard hanya menampilkan rider dengan penjualan, jadi jika rider tidak punya penjualan, dia tidak akan muncul
- Refresh leaderboard atau buka halaman lain lalu kembali

## 📝 Database State Verification

Jalankan query berikut untuk verifikasi:

```sql
-- Lihat data riders dengan status
SELECT id, name, phone, is_active, updated_at 
FROM public.riders 
ORDER BY name;

-- Count rider aktif vs tidak aktif
SELECT 
  is_active,
  COUNT(*) as count 
FROM public.riders 
GROUP BY is_active;
```
