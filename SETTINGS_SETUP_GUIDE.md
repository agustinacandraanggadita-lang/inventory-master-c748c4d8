# 📋 Pengaturan Distribusi & Produksi - Dokumentasi Lengkap

## 🎯 Fitur Baru yang Ditambahkan

### 1. **Halaman Pengaturan (Settings Page)**
Halaman baru untuk mengatur konfigurasi distribusi rider dan tanggal expired produk secara terpusat.

**Akses:** Menu navigasi → "Pengaturan" atau `/settings`

---

## 📊 Komponen & Database

### Tabel Database Baru

#### 1. `distribution_settings`
Menyimpan pengaturan distribusi **per rider per produk**.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `rider_id` | UUID | Reference ke riders |
| `product_id` | UUID | Reference ke products |
| `default_quantity` | INT | Jumlah default untuk distribusi |
| `created_at` | TIMESTAMPTZ | Waktu pembuatan |
| `updated_at` | TIMESTAMPTZ | Waktu update terakhir |

**Unique Constraint:** `(rider_id, product_id)` - Memastikan 1 rider tidak memiliki 2 setting untuk produk yang sama.

#### 2. `global_distribution_defaults`
Menyimpan pengaturan distribusi **global per produk** (berlaku untuk semua rider).

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `product_id` | UUID | Reference ke products |
| `default_quantity` | INT | Jumlah default untuk distribusi |
| `created_at` | TIMESTAMPTZ | Waktu pembuatan |
| `updated_at` | TIMESTAMPTZ | Waktu update terakhir |

#### 3. `product_expiry_settings`
Menyimpan pengaturan masa berlaku **per produk**.

| Kolom | Tipe | Keterangan |
|-------|------|-----------|
| `id` | UUID | Primary key |
| `product_id` | UUID | Reference ke products |
| `default_shelf_life_days` | INT | Jumlah hari masa berlaku |
| `created_at` | TIMESTAMPTZ | Waktu pembuatan |
| `updated_at` | TIMESTAMPTZ | Waktu update terakhir |

---

## 🔧 Fungsi & Hooks Baru

### File: `src/hooks/useSettings.ts`

#### Hooks untuk Rider Distribution Settings

```typescript
// Ambil settings untuk rider tertentu
useRiderDistributionSettings(riderId: string)

// Ambil semua settings untuk semua rider
useAllRiderDistributionSettings()

// Tambah/update setting rider
useUpsertRiderDistributionSetting()

// Hapus setting rider
useDeleteRiderDistributionSetting()
```

#### Hooks untuk Global Distribution Defaults

```typescript
// Ambil semua global defaults
useGlobalDistributionDefaults()

// Tambah/update global default
useUpsertGlobalDistributionDefault()
```

#### Hooks untuk Product Expiry Settings

```typescript
// Ambil semua product expiry settings
useProductExpirySettings()

// Tambah/update product expiry setting
useUpsertProductExpirySetting()

// Helper: ambil shelf life untuk produk
useGetDefaultShelfLife(productId: string)
```

---

## 📱 Halaman Pengaturan (SettingsPage)

### Tab 1: Global Defaults
**Tujuan:** Mengatur kuantitas default untuk setiap produk yang berlaku untuk **semua rider**.

**Fitur:**
- Form untuk tambah/update global default
- List produk dengan default quantity mereka saat ini
- Berguna ketika distribution default sama untuk semua rider

**Contoh Kasus:**
- Setiap rider selalu mendapat 25 unit Kopi Aren
- Setiap rider selalu mendapat 5 unit Syrup

### Tab 2: Rider Settings
**Tujuan:** Mengatur kuantitas default **per rider per produk**.

**Fitur:**
- Form untuk tambah/update setting rider
- List rider dengan product settings mereka
- Bisa override global default untuk rider tertentu
- Delete individual settings

**Contoh Kasus:**
- Rider A selalu mendapat 20 unit Kopi Aren (bukan 25)
- Rider B selalu mendapat 30 unit Kopi Aren
- Setting ini override global default

### Tab 3: Expired (Masa Berlaku Produk)
**Tujuan:** Mengatur berapa hari produk berlaku sejak tanggal produksi.

**Fitur:**
- Form untuk set shelf life per produk
- List semua produk dengan shelf life mereka
- Default: 7 hari (products) / 3 hari (addons)

**Contoh Kasus:**
- Kopi Aren berlaku 10 hari
- Syrup berlaku 5 hari
- Add-ons berlaku 3 hari

---

## 🚀 Integrasi dengan Fitur Lain

### 1. Auto-Distribution (Distribusi Otomatis)

**File:** `src/pages/DistributionPage.tsx`

**Perubahan:**
- Import `useRiderDistributionSettings`, `useAllRiderDistributionSettings`, `useGlobalDistributionDefaults`
- Fungsi `getDistributionQuantity()` mencari kuantitas dengan prioritas:
  1. **Rider-specific setting** (tertinggi)
  2. **Global default** (menengah)
  3. **Fallback config** (terendah)

**Flow:**
```
Auto-distribute klik
  ↓
getDistributionQuantity(riderId, productId)
  ↓
Check rider-specific setting? → Gunakan ✓
Check global default? → Gunakan ✓
Gunakan fallback config → Gunakan ✓
```

**Contoh:**
```
Klik Auto-Distribution untuk Rider A

Produk: Kopi Aren
- Setting rider A untuk Kopi Aren? → 20 unit ✓

Produk: Matcha
- Setting rider A untuk Matcha? → Tidak
- Global default Matcha? → 5 unit ✓

Produk: Produk Baru (belum di settings)
- Setting rider A? → Tidak
- Global default? → Tidak
- Fallback? → 5 unit ✓
```

### 2. Production Page (Halaman Produksi)

**File:** `src/pages/ProductionPage.tsx`

**Perubahan:**
- Import `useProductExpirySettings`
- Fungsi `getDefaultExpiryDays()` mencari shelf life dengan prioritas:
  1. **Custom setting** di product expiry settings
  2. **Category-based** (product: 7 hari, addon: 3 hari)

**Flow Otomatis:**
```
Input Produk
  ↓
Pilih produk di dropdown
  ↓
Ambil custom shelf life dari settings
  ↓
Hitung: expiry_date = production_date + shelf_life_days
  ↓
Auto-fill tanggal expired ✓
```

**Contoh:**
```
Pilih produk: "Kopi Aren" (setting: 10 hari)
Tanggal produksi: 2026-06-11
  ↓
Tanggal expired auto-fill: 2026-06-21 ✓

Ubah tanggal produksi ke: 2026-06-12
  ↓
Tanggal expired auto-update: 2026-06-22 ✓
```

---

## 📝 Tipe Data Baru

### File: `src/types/database.ts`

```typescript
interface DistributionSetting {
  id: string;
  rider_id: string;
  product_id: string;
  default_quantity: number;
  created_at: string;
  updated_at: string;
  rider?: Rider;
  product?: Product;
}

interface GlobalDistributionDefault {
  id: string;
  product_id: string;
  default_quantity: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

interface ProductExpirySetting {
  id: string;
  product_id: string;
  default_shelf_life_days: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}
```

---

## 🗺️ Routing & Navigation

### Update Routes
**File:** `src/App.tsx`

```typescript
<Route path="/settings" element={<SettingsPage />} />
```

### Update Navigation
**File:** `src/components/MobileNav.tsx`

Ditambahkan Settings icon dengan route `/settings`

---

## 🔄 Workflow Lengkap

### Workflow 1: Setup Distribusi Per Rider

```
1. Buka Pengaturan → Tab "Rider"
2. Form: Pilih Rider → Pilih Produk → Masukkan Quantity → Simpan
3. Repeat untuk setiap rider + produk kombinasi yang diinginkan

HASIL:
- Rider A, Kopi Aren: 20 unit
- Rider A, Matcha: 3 unit
- Rider B, Kopi Aren: 25 unit
- dst...
```

### Workflow 2: Setup Distribusi Global

```
1. Buka Pengaturan → Tab "Global Defaults"
2. Form: Pilih Produk → Masukkan Default Quantity → Simpan
3. Repeat untuk setiap produk

HASIL:
- Kopi Aren: 25 unit (untuk semua rider tanpa setting khusus)
- Matcha: 5 unit
- dst...

CATATAN: Rider-specific setting akan override setting ini
```

### Workflow 3: Setup Masa Expired Produk

```
1. Buka Pengaturan → Tab "Expired"
2. Form: Pilih Produk → Masukkan Shelf Life Days → Simpan

HASIL:
- Kopi Aren: 10 hari
- Syrup: 5 hari
- Add-ons: 3 hari
```

### Workflow 4: Auto-Distribution dengan Settings

```
1. Buka Distribusi
2. Klik Auto-Distribution (tombol di bawah rider)
3. Pilih "Default Mode"

SISTEM OTOMATIS:
- Ambil semua setting untuk rider ini
- Untuk setiap produk:
  - Cek setting rider-specific
  - Jika tidak ada, cek global default
  - Jika tidak ada, gunakan fallback
  - Distribusikan ke rider dengan jumlah yang didapat

HASIL:
- Produk didistribusikan sesuai setting ✓
```

### Workflow 5: Input Produksi dengan Auto-Expiry

```
1. Buka Produksi
2. Pilih Produk (misal: Kopi Aren dengan setting 10 hari)
3. Masukkan Quantity
4. Tanggal Produksi otomatis hari ini

SISTEM OTOMATIS:
- Ambil shelf life dari settings (10 hari)
- Hitung: expiry = today + 10 hari
- Auto-fill tanggal expired ✓

HASIL:
- Tanggal Expired terisi otomatis
- Produksi hanya perlu input quantity & pilih produk
```

---

## ✨ Keuntungan Fitur Baru

| Aspek | Sebelum | Sesudah |
|-------|---------|--------|
| **Setup Distribusi** | Hardcoded di code | Bisa diatur UI ✓ |
| **Per Rider Settings** | Tidak ada | Ada, bisa override ✓ |
| **Global Default** | Hardcoded | Bisa diatur UI ✓ |
| **Produk Expired** | Kategori-based | Custom per produk ✓ |
| **Auto-Fill Expired** | Manual input | Otomatis hitung ✓ |
| **Auto-Distribution** | Hardcoded quantity | Pakai settings ✓ |
| **Fleksibilitas** | Rendah | Tinggi ✓ |

---

## 🛠️ Maintenance & Troubleshooting

### Q: Auto-distribution tidak menggunakan setting baru?
**A:** Pastikan sudah:
1. Migrate database (`supabase/migrations/20260611_add_settings.sql`)
2. Refresh page browser (Ctrl+Shift+R)
3. Check browser console untuk logs

### Q: Tanggal expired tidak auto-fill?
**A:** Pastikan:
1. Ada setting di product expiry settings untuk produk tersebut
2. Atau gunakan default kategori (7/3 hari)
3. Refresh page jika baru ditambah setting

### Q: Setting rider tidak override global?
**A:** Prioritas yang benar:
1. Rider-specific (tertinggi)
2. Global default
3. Fallback (terendah)

Jika masih tidak work, check `getDistributionQuantity()` di DistributionPage.tsx

---

## 📚 File yang Berubah

```
BARU:
├── supabase/migrations/20260611_add_settings.sql
├── src/pages/SettingsPage.tsx
├── src/hooks/useSettings.ts

UPDATE:
├── src/App.tsx (+ route /settings)
├── src/components/MobileNav.tsx (+ settings icon)
├── src/pages/ProductionPage.tsx (integrate product expiry settings)
├── src/pages/DistributionPage.tsx (integrate rider + global settings)
├── src/types/database.ts (+ 3 interface baru)

UNCHANGED:
└── (semua file lain tetap sama)
```

---

## 🚀 Next Steps

1. **Apply Migration:** Jalankan SQL migration ke database
2. **Test Setup:** Buka halaman Settings dan setup distribusi default
3. **Test Auto-Distribution:** Buka Distribusi dan coba auto-distribution
4. **Test Production:** Input produk di Production dan verifikasi expiry date

Selamat! Sistem distribusi & produksi sudah lebih fleksibel! 🎉
