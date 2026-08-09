# Riset Fitur & User Flow — Internal Enterprise App Store

> Konteks: membangun **app store internal enterprise** (self-hosted, Tailscale, SQLite).
> Android APK + iOS IPA. Web (React/Vite/TS) + mobile (Expo/RN). Auth email/password JWT + opsional SSO.
> Hanya admin/dev yang upload; ada alur **approval admin** sebelum app live. User browse/search/download.
> Referensi diambil dari F-Droid, Aptoide, MDM (Jamf/Intune), Google Play Console, Apple App Store Connect.

---

## 1. Fitur User-Facing (untuk pengguna akhir / karyawan)

**Browse & Discover**
- Daftar app (grid/list) dengan ikon, nama, versi, rating.
- Kategori: Android, iOS, atau by fungsi (HR, Sales, Internal Tools).
- Fitur "Featured / Recommended" / highlighted (Intune "featured apps", Aptoide "editorial collections").
- Filter + sort (oleh nama, terbaru, kategori, platform).
- "Explore by category" vs "search by title" (Aptoide gamer model).

**Search**
- Pencarian nama app.
- Pencarian deskripsi / kata kunci (F-Droid: "searchable descriptions").
- Filter hasil oleh platform (Android/iOS) + kompatibilitas perangkat.

**App Detail Page (konten)**
- Ikon, nama, versi, size, kategori, platform.
- Deskripsi lengkap.
- Screenshots (multi) + optional preview/video.
- Release notes / changelog (what's new).
- Min OS version / kompatibilitas perangkat.
- Pengembang/publisher + tanggal rilis.
- Rating & review (bintang + komentar).
- Tombol install/download + versi alternatif.

**Download & Install**
- Download APK (browser → langsung / scan QR).
- Download IPA (iOS: install via MDM profile / ad-hoc / link).
- Auto-update detection: notifikasi "update tersedia" (F-Droid); optional auto-install.
- Histori versi lama + beta (F-Droid: track older & beta versions).
- Filter app yang tidak kompatibel dengan device (F-Droid: "filter out apps incompatible with the device").

**Ratings & Reviews**
- Bintang 1–5 (F-Droid/G-Droid, Aptoide).
- Komentar/ulasan user (F-Droid standar tidak ada; G-Droid & Aptoide punya).
- Rating bisa dihitung dari metrik (G-Droid) atau manual dari user.

**Favorites / Personalisasi**
- Tandai favorit / simpan.
- Aptoide: curated channels, follow store, rekomendasi personal.
- "Similar apps" & "apps of same category/author" (G-Droid).

**Notifikasi**
- Update tersedia (F-Droid).
- App baru di kategori yang difollow.
- Approval status (jika user adalah dev).

---

## 2. Fitur Admin / Developer

**Upload App (binari + metadata)**
- Upload APK / IPA file.
- Upload ikon, screenshots, preview.
- Isi metadata: nama, kategori, deskripsi, release notes, min OS.
- (Play Console: upload AAB/APK; ASC: upload build via Xcode/Transporter.)

**Version Management**
- Multi-versi per app; rilis per versi.
- Set versi aktif (promote) vs historis/beta.
- Rollback ke versi sebelumnya.
- (Play Console: release = kumpulan satu+ versi; tracks internal/closed/open/production.)
- (ASC: build diorganisir per nomor versi; banyak build per versi.)

**Approval / Review Flow**
- Dev submit → status "pending review" → admin approve/tolak → live.
- Alasan penolakan + notifikasi ke dev.
- (Play Console: review oleh Google; ASC: Apple review.)

**Publish / Unpublish**
- Kunci publish (simpan draft) vs publish (live).
- Unpublish / disable app (Jamf: "Enable" checkbox untuk enable/disable).
- Scope/hide per grup user (Jamf scope, Intune assignment).

**Edit Metadata**
- Ubah nama, deskripsi, kategori, screenshots, ikon, release notes.
- Edit tidak butuh binary ulang (metadata terpisah dari binary).
- Localization opsional (Play Console multi-locale; ASC localized metadata).

**Screenshots & Icons**
- Upload/update ikon.
- Upload/manage multiple screenshots (phone/tablet).
- Preview poster frame (ASC).

**Release Notes**
- Per-versi changelog.
- (Play Console: "enter release notes"; fastlane per-locale changelog files per version code.)

**Lainnya**
- Manage app record (ASC: buat app record sebelum upload build).
- Akses peran (Admin/App Manager/Developer — ASC role model).
- Privacy/izin declarations (Play/ASC modern).
- Kategori & age rating (ASC).

---

## 3. User Flows (step-by-step)

### A. Alur User Biasa (karyawan)
1. Login (email/password JWT) atau SSO.
2. Land di halaman Home — lihat "featured apps" + notifikasi (update tersedia).
3. Browse kategori OS (Android/iOS) atau search app.
4. Filter/sort hasil (platform, kategori, terbaru).
5. Klik app → detail page (ikon, versi, size, deskripsi, screenshots, release notes, min OS, rating).
6. Klik **Download / Install**.
7. Android: unduh APK → install. iOS: install via link/IPA + MDM profile.
8. (Opsional) beri rating & review.
9. Tandai favorit.
10. Nanti: dapat notif update → download versi baru → update.

### B. Alur Admin/Dev (upload + approval)
1. Login sebagai peran admin/dev.
2. Masuk panel admin → "Upload App".
3. Isi metadata (nama, package/bundle id, kategori, deskripsi, min OS) + upload binary (APK/IPA) + ikon + screenshots + release notes.
4. **Simpan Draft** (belum live) atau **Submit untuk Review**.
5. Status → "Pending Approval".
6. Admin lain mereview → **Approve** (publish/live) atau **Tolak** (isi alasan).
7. Dev dapat notif hasil review.
8. Live app muncul untuk semua user.
9. Update versi: upload binary baru + release notes → ulangi alur review.
10. **Unpublish** kapan saja (hide dari user; binary tetap tersimpan).

---

## 4. Metadata Fields pada App Listing

| Field | Ket | Wajib |
|---|---|---|
| **Nama** | Display name | ✔ |
| **Package / Bundle ID** | `com.company.app` (unik, identitas) | ✔ |
| **Versi** | `1.2.3` + version code | ✔ |
| **Platform** | Android / iOS | ✔ |
| **OS Availability / Min OS Version** | minSdk / iOS min version | ✔ |
| **Size** | ukuran binary (auto-hitung) | ✔ (auto) |
| **Ikon** | gambar app icon | ✔ |
| **Screenshots** | 1–n gambar (multi platform/resolusi) | ✔ (idealnya) |
| **Deskripsi** | deskripsi pendek + full | ✔ |
| **Release Notes** | changelog per versi | ✔ |
| **Kategori** | HR, Sales, Tools, dll. | ✔ |
| **Developer / Publisher** | nama + kontak | opsional |
| **Rating & Reviews** | dihitung dari user | opsional |
| **Tanggal rilis** | auto | auto |
| **Dokumen/privacy** | link policy (opsional) | opsional |

---

## 5. Catatan Implementasi (untuk stack kita)

- **Multi-versi**: simpan semua versi; field `is_active`/`is_beta`; versi lama tetap bisa di-download.
- **Approval**: tabel `app_versions.status` = `draft | pending | approved | rejected | live | unpublished`.
- **Metadata ≠ binary**: simpan metadata & file terpisah, edit metadata tidak perlu re-upload binary.
- **Updates**: bandingkan versi client vs versi live → notif "update tersedia"; dukung auto-update opsional.
- **iOS**: IPA butuh mekanisme instal (MDM profile / ad-hoc / device enroll) — tandai platform di metadata.
- **Peran**: `viewer` (browse/download), `developer` (upload), `admin` (approve/publish).
- **Scope opsional**: sembunyikan app per grup (model Jamf scope / Intune assignment) — bisa tahap 2.