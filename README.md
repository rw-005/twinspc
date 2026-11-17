# TWINS POS untuk Windows (EXE)

Membungkus `app/index.html` (POS yang sama dengan web/APK) menjadi aplikasi Windows.
Cetak berjalan seperti di APK: tanpa dialog cetak, langsung ke printer.

## Cara membuat EXE (tanpa memasang apa pun di PC)
1. Buat repo GitHub baru (mis. `twinsposexe`) dan unggah SEMUA isi folder ini (termasuk folder `.github`).
2. Buka tab **Actions** > **Build EXE (Windows)** > **Run workflow**.
3. Tunggu sekitar 3-5 menit, lalu buka run yang selesai > **Artifacts** > unduh `TWINS-POS-Setup`.
4. Di dalamnya ada `TWINS POS Setup x.x.x.exe`. Jalankan di PC kasir.

## Memperbarui POS
Ganti `app/index.html` dengan versi terbaru, commit, lalu build lagi (langkah 2-4) dan pasang di atas yang lama.
Data kasir tersimpan di PC dan tidak hilang selama alamat aplikasi (`app://pos`) tetap sama.
`app/config.js` dan `app/pelanggan.js` adalah salinan dari APK; ganti kalau di repo web kamu isinya berbeda.

## Printer
- **LAN / WiFi (IP:port)**: Pengaturan > Perangkat, pilih LAN, isi IP dan port 9100. Langsung dari aplikasi, tanpa relay.
- **USB / printer thermal terpasang di Windows**: di Pengaturan > Perangkat pilih mode **Bluetooth**,
  lalu pilih printer dari daftar (daftar ini = printer Windows). Cetak berupa ESC/POS mentah, sama seperti APK
  (termasuk potong kertas). Pasang driver printernya di Windows dulu (driver bawaan pabrik, atau "Generic / Text Only").
- **Cetak biasa (mode Browser)**: tidak ada dialog; langsung ke printer yang dipilih di menu **Printer** (atau default Windows).
- Bluetooth sungguhan dan mode Pelayan (hub WiFi) tidak ada di versi PC.

## Menjalankan untuk uji (opsional, perlu Node.js)
`npm install` lalu `npm start`.
