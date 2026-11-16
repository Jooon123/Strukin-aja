# StrukinAja 🩺
### Generator Struk & Kwitansi Resmi Praktik Bidan / Klinik Mandiri

Aplikasi web Single Page Application (SPA) yang modern, responsif (mobile-first), dan **100% berjalan di sisi klien (client-side tanpa backend/server)** menggunakan HTML, Tailwind CSS, dan Vanilla JavaScript.

Aplikasi ini dirancang khusus untuk mempermudah Bidan Praktik Mandiri (BPM), Klinik Bersalin, Poskesdes/Polindes, dan Klinik Pratama dalam membuat kwitansi dan bukti pembayaran medis yang sah, rapi, dan profesional.

---

## 🌟 Fitur Utama

1. **Penyimpanan Profil Otomatis (localStorage)**
   - Menyimpan otomatis Nama Praktik Bidan/Klinik, Nomor SIPB / Izin Praktik, Alamat, No. Telepon, Nama Bidan, dan Wilayah.
   - Logo klinik otomatis dikonversi ke Base64 dan disimpan di browser.
   - Pilihan warna stempel digital (Biru Medis, Ungu Medis Bidan, atau Merah).

2. **Form Transaksi Pasien Fleksibel**
   - Nomor Nota dibuat otomatis (`NOT-YYYYMMDD-XXXX`) dan dapat disesuaikan.
   - Tanggal pemeriksaan (default hari ini).
   - Nama pasien, usia, dan diagnosa / jenis layanan medis.
   - Tombol cepat diagnosa: ANC, Persalinan, KB 3 Bulan, Imunisasi, IUD/Implan, PNC.
   - **Dynamic Item List**: Tambah/hapus baris tindakan dan obat dengan perhitungan subtotal otomatis.
   - Template tarif cepat sekali klik (ANC, USG, Suntik KB, Imunisasi, Lab, Vitamin).

3. **Perhitungan Total & "Terbilang" Otomatis**
   - Menghitung grand total tagihan secara instan.
   - Mengubah angka total menjadi kalimat **Terbilang Bahasa Indonesia** yang benar secara tata bahasa (contoh: *"Dua Ratus Lima Puluh Ribu Rupiah"*).

4. **Tanda Tangan Layar Sentuh & Stempel SVG Resmi**
   - Canvas HTML5 untuk tanda tangan digital langsung di layar HP atau mouse.
   - Mendukung touch events yang halus tanpa memblokir scroll layar.
   - Opsi *"Simpan tanda tangan ini"* agar tidak perlu tanda tangan ulang setiap pasien.
   - Stempel otomatis berbentuk lingkaran resmi berbasis SVG dengan teks melengkung nama praktik, tulisan "LUNAS", bintang ornamen, dan nomor SIPB yang menimpa area tanda tangan secara realistis.

5. **Live Preview Struk Medis Vertikal Modern**
   - Desain struk vertikal proporsional (~390px - 400px) berstandar medis.
   - Kop klinik lengkap dengan logo dan izin praktik resmi.
   - Rincian tabel biaya yang rapi.
   - Catatan kaki: *"Kwitansi ini sah sebagai bukti pembayaran layanan kesehatan / klaim medis"*.
   - **Sistem Watermark**:
     - Status Trial: Watermark merah miring berulang *"CONTOH STRUK - BELUM AKTIF (Aktivasi Rp35.000 via WA 085176852680)"*.
     - Status PRO: Watermark hilang total, fitur logo dan stempel otomatis terbuka penuh.

6. **Export Gambar HD 3x (html2canvas)**
   - Mengunduh struk beresolusi tinggi (PNG HD scale: 3) yang sangat tajam dan tidak pecah saat dikirim lewat WhatsApp.
   - Fitur Cetak / Print langsung ke printer thermal Bluetooth (80mm) atau printer biasa.
   - Fitur kirim ringkasan teks kwitansi langsung ke WhatsApp pasien.

7. **Sistem Lisensi Client-Side (Hash Generator) & WhatsApp**
   - Algoritma deterministik `generateLicenseKey(clinicName)` berbasis FNV-1a dengan salt rahasia `"STRUKINAJA_SECRET_2026"`.
   - Menghasilkan 6 digit kode alfanumerik unik per nama klinik (contoh: `A7X92B`).
   - Tombol beli langsung terhubung ke WhatsApp Admin (`085176852680`) dengan pesan otomatis.

8. **Panel Rahasia Pemilik Web (Admin Generator)**
   - **Cara Membuka**: 
     - Cara 1: Klik teks judul / logo utama di header sebanyak **5 kali berturut-turut** secara senyap.
     - Cara 2: Tekan tombol pintas keyboard **`Ctrl + Shift + A`** atau **`Alt + A`**.
   - Masukkan PIN Admin: `210920`.
   - Ketik Nama Praktik Bidan pelanggan, dan sistem langsung menampilkan 6 digit Kode Aktivasi PRO yang valid dengan tombol Salin Kode dan Buat Pesan Balasan WhatsApp otomatis.

---

## 🚀 Cara Deploy ke GitHub Pages (Gratis & Cepat)

Karena aplikasi ini 100% client-side (tanpa build tools seperti node_modules atau webpack), Anda bisa langsung men-deploy-nya ke GitHub Pages dalam 1 menit:

1. Buat repository baru di GitHub (misal: `strukinaja`).
2. Upload semua file dalam project ini:
   - `index.html`
   - `app.js`
   - `style.css`
   - `README.md`
3. Buka tab **Settings** di repository GitHub Anda.
4. Masuk ke menu **Pages** (di sidebar kiri).
5. Pada bagian **Build and deployment** -> **Branch**, pilih branch `main` (atau `master`) dan folder `/ (root)`.
6. Klik **Save**.
7. Tunggu sekitar 30 detik, link web Anda akan aktif di:
   `https://<username-github>.github.io/<nama-repo>/`

---

## 🛠️ Struktur File

```text
├── index.html        # Single Page Application UI & layout responsif
├── app.js            # Logika aplikasi, state, canvas, lisensi, & export
├── style.css         # Styling kustom, watermark, & print stylesheet
└── README.md         # Panduan instalasi dan dokumentasi
```

---

## 🔐 Informasi Lisensi & Akses Admin

| Keterangan | Nilai |
|---|---|
| **Harga Lisensi PRO** | Rp 35.000 (Sekali bayar aktif selamanya) |
| **Nomor WhatsApp Admin** | `085176852680` |
| **PIN Panel Admin Rahasia** | `210920` |
| **Cara Buka Panel Admin** | Klik logo / judul di header 5x atau tekan `Ctrl+Shift+A` |
| **Secret Salt** | `STRUKINAJA_SECRET_2026` |

---

&copy; 2026 StrukinAja. Dibuat untuk Bidan Praktik Mandiri & Fasilitas Kesehatan Indonesia.
