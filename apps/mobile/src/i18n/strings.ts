/**
 * UI strings, English and Indonesian.
 *
 * `Strings` is derived from the English map, so adding a key there fails to
 * compile until Indonesian defines it too — the same trick the palettes use.
 * There is no runtime fallback to a missing key on purpose: a silent fallback
 * ships half-translated screens that nobody notices.
 *
 * Placeholders are `{name}` and substituted by `t()`. Anything genuinely
 * plural takes two keys (`_one`/`_other`) rather than being assembled from
 * fragments — Indonesian does not inflect plurals, and gluing a count onto a
 * noun works in neither language for long.
 */

export const en = {
  // tabs & chrome
  'tab.discover': 'Discover',
  'tab.myApps': 'My Apps',
  'tab.profile': 'Profile',
  'nav.appDetail': 'App Detail',

  // discover
  'discover.title': 'Internal apps',
  'discover.greeting': 'Hello, {name}',
  'discover.welcome': 'Welcome back, {name}',
  'track.internal': 'Development build',
  'track.beta': 'Test build',
  'track.note': 'You have this early because you are testing it. Others do not see it yet.',
  'profile.legal': 'Legal',
  'profile.terms': 'Terms of use',
  'profile.privacy': 'Privacy notice',
  'profile.legalUnset': 'Your organization has not published these yet.',
  'discover.subtitle': 'Company-approved builds for Android and iOS.',
  'discover.searchPlaceholder': 'Search apps, teams, keywords',
  'discover.allApps': 'All apps',
  'discover.categoryApps': '{category} apps',
  'discover.resultsFor': 'Results for “{query}”',
  'discover.count_one': '{count} app',
  'discover.count_other': '{count} apps',
  'discover.featured': 'Featured',
  'sort.name': 'A–Z',
  'sort.recent': 'Recently updated',
  'sort.rating': 'Top rated',
  'category.all': 'All',

  // my apps
  'myApps.empty.title': 'Nothing installed yet',
  'myApps.empty.body': 'Apps you install from Discover show up here, with update status.',
  'myApps.upToDate': 'Everything is up to date',
  'myApps.updates_one': '{count} update available',
  'myApps.updates_other': '{count} updates available',

  // app detail
  'detail.preview': 'Preview',
  'detail.about': 'About',
  'detail.whatsNew': 'What’s new',
  'detail.information': 'Information',
  'spec.version': 'VERSION',
  'spec.size': 'SIZE',
  'spec.category': 'CATEGORY',
  'spec.requires': 'REQUIRES',
  'info.publisher': 'Publisher',
  'info.platform': 'Platform',
  'info.updated': 'Updated',
  'info.minOs': 'Minimum OS',

  // install
  'install.install': 'Install',
  'install.open': 'Open',
  'install.update': 'Update',
  'install.downloading': 'Downloading',
  'install.installing': 'Installing',
  'install.upToDate': 'Installed and up to date.',
  'install.unavailable': 'Not available for your device.',
  'install.retry': 'Retry',
  'install.error.interrupted':
    'Download interrupted — the connection dropped. Tap Retry to continue from where it stopped.',
  'install.error.http': 'The server could not send the file. Tap Retry; if it persists, contact the app owner.',
  'install.error.link_expired': 'The download link expired. Tap Retry to get a new one.',
  'install.error.size_mismatch':
    'The download was incomplete and has been removed. Tap Retry to download it again.',
  'install.error.checksum_mismatch':
    'The downloaded file does not match the published build and has been removed. Tap Retry.',
  'install.error.invalid_apk':
    'The downloaded file is not a valid app package and has been removed. Tap Retry. If it keeps happening, the uploaded build is broken.',
  'install.error.storage_full': 'Not enough free storage. Free up space, then tap Retry.',
  'install.error.permission_required':
    'Allow MAYA to install apps (Settings › Install unknown apps), then tap Install again. The file is already downloaded.',
  'install.error.signature_conflict':
    'A copy of this app signed with a different key is installed. Uninstall it first, then tap Install again.',
  'install.error.install_failed': 'Android refused to install this app.',
  'install.error.unknown': 'Installation failed. Tap Retry.',
  'install.notify.readyTitle': '{app} is installed',
  'install.notify.readyBody': 'Version {version} is installed and ready to open.',
  'install.notify.failedTitle': '{app} could not be installed',
  'install.notify.pausedTitle': '{app} download paused',
  'install.notify.pausedBody': 'The connection dropped. Open MAYA to continue — it resumes automatically.',

  // states
  'state.loading': 'Loading…',
  'state.loadingApps': 'Loading your apps…',
  'state.loadingDetail': 'Loading app details…',
  'state.errorTitle': 'Something went wrong',
  'state.retry': 'Try again',
  'state.noMatches.title': 'No matches',
  'state.noMatches.body': 'Nothing matches “{query}”. Try a shorter term.',
  'state.emptyCatalog.title': 'Catalog is empty',
  'state.emptyCatalog.body':
    'No published apps yet. Publishers can upload builds from the web console.',

  // auth
  'auth.signIn.title': 'Sign in to MAYA',
  'auth.signIn.subtitle': 'Use your company account to reach the internal catalog.',
  'auth.signIn.action': 'Sign in',
  'auth.register.title': 'Create your account',
  'auth.register.subtitle': 'Join your organization’s private catalog.',
  'auth.register.action': 'Create account',
  'auth.noAccount': 'No account yet?',
  'auth.createOne': 'Create one',
  'auth.haveAccount': 'Already have an account?',
  'auth.signInInstead': 'Sign in',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.name': 'Name',
  'auth.fullName': 'Full name',
  'auth.workEmail': 'Work email',
  'auth.emailPlaceholder': 'you@company.com',
  'auth.passwordPlaceholder': 'Your password',
  'auth.namePlaceholder': 'Ada Lovelace',
  'auth.passwordHint': 'At least 8 characters, with a letter and a number',
  'auth.demo.title': 'Demo account',
  'auth.demo.mock': 'mock mode, so this account is local to this device.',
  'auth.demo.server': 'seeded on the server for this organization.',
  'auth.register.localOnly':
    'Accounts are stored on this device only until the API ships.',
  'auth.register.server':
    'New accounts start with no apps. An admin grants access to the ones you need.',

  // onboarding
  'onboarding.catalog.title': 'Your company’s apps',
  'onboarding.catalog.body':
    'Every internal Android and iOS build your team is approved to use, in one private catalog.',
  'onboarding.install.title': 'Install in a tap',
  'onboarding.install.body':
    'Pick a build and hand it straight to your device. No public store, no sideloading guesswork.',
  'onboarding.updates.title': 'Stay current',
  'onboarding.updates.body':
    'My Apps tracks what you installed and flags a new version the moment it is published.',
  'onboarding.skip': 'Skip',
  'onboarding.next': 'Next',
  'onboarding.start': 'Get started',

  // update gate
  'update.requiredTitle': 'Update required',
  'update.availableTitle': 'Update available',
  'update.requiredBody':
    'A new version of {app} is required to continue. Version {version} is ready to install.',
  'update.availableBody': '{app} {version} is ready to install.',
  'update.whatsNew': 'What’s new',
  'update.action': 'Update now',
  'update.later': 'Later',
  'update.thisApp': 'this app',
  'update.downloading': 'Downloading… {percent}%',
  'update.downloadingUnknown': 'Downloading…',
  'update.install': 'Install',
  'update.retry': 'Try again',
  'update.readyHint': 'Downloaded. Tap Install to finish updating.',
  'update.failed': 'The download did not finish. Check your connection and try again.',

  // profile
  'profile.intro':
    'MAYA is a private catalog for company-built Android and iOS apps. Everything is served from internal infrastructure — nothing here is published to a public store.',
  'profile.account': 'Account',
  'discover.topApps': 'Top apps',
  'discover.recommended': 'Recommended for you',
  'discover.recentlyUpdated': 'Recently updated',
  'profile.preferences': 'Preferences',
  'profile.notifications': 'Notifications',
  'profile.about': 'About',
  'profile.appearance': 'Appearance',
  'profile.language': 'Language',
  'profile.name': 'Name',
  'profile.email': 'Email',
  'profile.memberSince': 'Member since',
  'profile.signOut': 'Sign out',
  'profile.signOutTitle': 'Sign out?',
  'profile.signOutBody': 'You will need your email and password to get back in.',
  'dialog.ok': 'OK',
  'dialog.cancel': 'Cancel',
  'profile.edit': 'Edit profile',
  'profile.changePhoto': 'Change photo',
  'profile.removePhoto': 'Remove photo',
  'profile.save': 'Save',
  'profile.saved': 'Saved',
  'profile.nameRequired': 'Enter your name',
  'profile.password': 'Password',
  'profile.currentPassword': 'Current password',
  'profile.newPassword': 'New password',
  'profile.confirmPassword': 'Confirm new password',
  'profile.changePassword': 'Change password',
  'profile.passwordHint':
    'At least 8 characters, with a letter and a number. Changing it signs you out on every device.',
  'profile.passwordMismatch': 'The new passwords do not match',
  'profile.passwordChanged': 'Password changed',
  'profile.passwordChangedBody': 'Sign in again with your new password.',
  'profile.version': 'MAYA {version}',
  'profile.footer': 'Need an app published? Contact your platform team.',

  // appearance / language options
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'language.en': 'English',
  'language.id': 'Bahasa Indonesia',
} as const;

export type StringKey = keyof typeof en;
export type Strings = Record<StringKey, string>;

export const id: Strings = {
  'tab.discover': 'Jelajah',
  'tab.myApps': 'Aplikasi Saya',
  'tab.profile': 'Profil',
  'nav.appDetail': 'Detail Aplikasi',

  'discover.title': 'Aplikasi internal',
  'discover.greeting': 'Halo, {name}',
  'discover.welcome': 'Selamat datang kembali, {name}',
  'track.internal': 'Build pengembangan',
  'track.beta': 'Build pengujian',
  'track.note': 'Anda mendapatkannya lebih awal karena sedang mengujinya. Orang lain belum melihatnya.',
  'profile.legal': 'Legal',
  'profile.terms': 'Ketentuan penggunaan',
  'profile.privacy': 'Pemberitahuan privasi',
  'profile.legalUnset': 'Organisasi Anda belum menerbitkannya.',
  'discover.subtitle': 'Build resmi perusahaan untuk Android dan iOS.',
  'discover.searchPlaceholder': 'Cari aplikasi, tim, kata kunci',
  'discover.allApps': 'Semua aplikasi',
  'discover.categoryApps': 'Aplikasi {category}',
  'discover.resultsFor': 'Hasil untuk “{query}”',
  'discover.count_one': '{count} aplikasi',
  'discover.count_other': '{count} aplikasi',
  'discover.featured': 'Unggulan',
  'sort.name': 'A–Z',
  'sort.recent': 'Terbaru diperbarui',
  'sort.rating': 'Rating tertinggi',
  'category.all': 'Semua',

  'myApps.empty.title': 'Belum ada yang terpasang',
  'myApps.empty.body':
    'Aplikasi yang kamu pasang dari Jelajah muncul di sini, lengkap dengan status pembaruan.',
  'myApps.upToDate': 'Semuanya sudah versi terbaru',
  'myApps.updates_one': '{count} pembaruan tersedia',
  'myApps.updates_other': '{count} pembaruan tersedia',

  'detail.preview': 'Pratinjau',
  'detail.about': 'Tentang',
  'detail.whatsNew': 'Yang baru',
  'detail.information': 'Informasi',
  'spec.version': 'VERSI',
  'spec.size': 'UKURAN',
  'spec.category': 'KATEGORI',
  'spec.requires': 'MINIMAL',
  'info.publisher': 'Penerbit',
  'info.platform': 'Platform',
  'info.updated': 'Diperbarui',
  'info.minOs': 'OS minimum',

  'install.install': 'Pasang',
  'install.open': 'Buka',
  'install.update': 'Perbarui',
  'install.downloading': 'Mengunduh',
  'install.installing': 'Memasang',
  'install.upToDate': 'Terpasang dan sudah terbaru.',
  'install.unavailable': 'Tidak tersedia untuk perangkatmu.',
  'install.retry': 'Coba lagi',
  'install.error.interrupted':
    'Unduhan terputus karena koneksi terhenti. Ketuk Coba lagi untuk melanjutkan dari posisi terakhir.',
  'install.error.http': 'Server gagal mengirim file. Ketuk Coba lagi; jika masih gagal, hubungi pemilik aplikasi.',
  'install.error.link_expired': 'Tautan unduhan sudah kedaluwarsa. Ketuk Coba lagi untuk meminta tautan baru.',
  'install.error.size_mismatch':
    'Unduhan tidak lengkap dan sudah dihapus. Ketuk Coba lagi untuk mengunduh ulang.',
  'install.error.checksum_mismatch':
    'File yang terunduh tidak sama dengan build yang dirilis dan sudah dihapus. Ketuk Coba lagi.',
  'install.error.invalid_apk':
    'File yang terunduh bukan paket aplikasi yang valid dan sudah dihapus. Ketuk Coba lagi. Jika terus terjadi, build yang diunggah rusak.',
  'install.error.storage_full': 'Ruang penyimpanan tidak cukup. Kosongkan ruang, lalu ketuk Coba lagi.',
  'install.error.permission_required':
    'Izinkan MAYA memasang aplikasi (Setelan › Instal aplikasi tidak dikenal), lalu ketuk Pasang lagi. File sudah terunduh, tidak perlu unduh ulang.',
  'install.error.signature_conflict':
    'Aplikasi ini sudah terpasang dengan tanda tangan berbeda. Copot dulu aplikasi lamanya, lalu ketuk Pasang lagi.',
  'install.error.install_failed': 'Android menolak memasang aplikasi ini.',
  'install.error.unknown': 'Pemasangan gagal. Ketuk Coba lagi.',
  'install.notify.readyTitle': '{app} sudah terpasang',
  'install.notify.readyBody': 'Versi {version} sudah terpasang dan siap dibuka.',
  'install.notify.failedTitle': '{app} gagal dipasang',
  'install.notify.pausedTitle': 'Unduhan {app} terjeda',
  'install.notify.pausedBody': 'Koneksi terputus. Buka MAYA untuk melanjutkan — unduhan dilanjutkan otomatis.',

  'state.loading': 'Memuat…',
  'state.loadingApps': 'Memuat aplikasimu…',
  'state.loadingDetail': 'Memuat detail aplikasi…',
  'state.errorTitle': 'Ada yang tidak beres',
  'state.retry': 'Coba lagi',
  'state.noMatches.title': 'Tidak ada hasil',
  'state.noMatches.body': 'Tidak ada yang cocok dengan “{query}”. Coba kata yang lebih pendek.',
  'state.emptyCatalog.title': 'Katalog masih kosong',
  'state.emptyCatalog.body':
    'Belum ada aplikasi yang diterbitkan. Penerbit bisa mengunggah build lewat konsol web.',

  'auth.signIn.title': 'Masuk ke MAYA',
  'auth.signIn.subtitle': 'Gunakan akun perusahaanmu untuk membuka katalog internal.',
  'auth.signIn.action': 'Masuk',
  'auth.register.title': 'Buat akunmu',
  'auth.register.subtitle': 'Gabung ke katalog privat organisasimu.',
  'auth.register.action': 'Buat akun',
  'auth.noAccount': 'Belum punya akun?',
  'auth.createOne': 'Buat sekarang',
  'auth.haveAccount': 'Sudah punya akun?',
  'auth.signInInstead': 'Masuk',
  'auth.email': 'Email',
  'auth.password': 'Kata sandi',
  'auth.name': 'Nama',
  'auth.fullName': 'Nama lengkap',
  'auth.workEmail': 'Email kerja',
  'auth.emailPlaceholder': 'kamu@perusahaan.com',
  'auth.passwordPlaceholder': 'Kata sandimu',
  'auth.namePlaceholder': 'Ada Lovelace',
  'auth.passwordHint': 'Minimal 8 karakter, ada huruf dan angka',
  'auth.demo.title': 'Akun demo',
  'auth.demo.mock': 'mode tiruan, jadi akun ini hanya ada di perangkat ini.',
  'auth.demo.server': 'sudah disemai di server untuk organisasi ini.',
  'auth.register.localOnly':
    'Akun disimpan hanya di perangkat ini sampai API-nya siap.',
  'auth.register.server':
    'Akun baru belum punya aplikasi. Admin akan memberi akses ke aplikasi yang kamu butuhkan.',

  'onboarding.catalog.title': 'Aplikasi perusahaanmu',
  'onboarding.catalog.body':
    'Semua build Android dan iOS internal yang boleh dipakai timmu, dalam satu katalog privat.',
  'onboarding.install.title': 'Pasang sekali ketuk',
  'onboarding.install.body':
    'Pilih build dan serahkan langsung ke perangkatmu. Tanpa toko publik, tanpa tebak-tebakan sideload.',
  'onboarding.updates.title': 'Selalu terbaru',
  'onboarding.updates.body':
    'Aplikasi Saya mencatat apa yang kamu pasang dan menandai versi baru begitu diterbitkan.',
  'onboarding.skip': 'Lewati',
  'onboarding.next': 'Lanjut',
  'onboarding.start': 'Mulai',

  'update.requiredTitle': 'Perlu diperbarui',
  'update.availableTitle': 'Pembaruan tersedia',
  'update.requiredBody':
    'Versi baru {app} wajib dipasang untuk melanjutkan. Versi {version} siap dipasang.',
  'update.availableBody': '{app} {version} siap dipasang.',
  'update.whatsNew': 'Yang baru',
  'update.action': 'Perbarui sekarang',
  'update.later': 'Nanti',
  'update.thisApp': 'aplikasi ini',
  'update.downloading': 'Mengunduh… {percent}%',
  'update.downloadingUnknown': 'Mengunduh…',
  'update.install': 'Pasang',
  'update.retry': 'Coba lagi',
  'update.readyHint': 'Sudah diunduh. Ketuk Pasang untuk menyelesaikan pembaruan.',
  'update.failed': 'Unduhan tidak selesai. Periksa koneksi Anda lalu coba lagi.',

  'profile.intro':
    'MAYA adalah katalog privat untuk aplikasi Android dan iOS buatan perusahaan. Semuanya dilayani dari infrastruktur internal — tidak ada yang diterbitkan ke toko publik.',
  'profile.account': 'Akun',
  'discover.topApps': 'Aplikasi teratas',
  'discover.recommended': 'Rekomendasi untukmu',
  'discover.recentlyUpdated': 'Baru diperbarui',
  'profile.preferences': 'Preferensi',
  'profile.notifications': 'Notifikasi',
  'profile.about': 'Tentang',
  'profile.appearance': 'Tampilan',
  'profile.language': 'Bahasa',
  'profile.name': 'Nama',
  'profile.email': 'Email',
  'profile.memberSince': 'Anggota sejak',
  'profile.signOut': 'Keluar',
  'profile.signOutTitle': 'Keluar?',
  'profile.signOutBody': 'Anda perlu email dan kata sandi untuk masuk lagi.',
  'dialog.ok': 'Oke',
  'dialog.cancel': 'Batal',
  'profile.edit': 'Ubah profil',
  'profile.changePhoto': 'Ganti foto',
  'profile.removePhoto': 'Hapus foto',
  'profile.save': 'Simpan',
  'profile.saved': 'Tersimpan',
  'profile.nameRequired': 'Masukkan nama Anda',
  'profile.password': 'Kata sandi',
  'profile.currentPassword': 'Kata sandi saat ini',
  'profile.newPassword': 'Kata sandi baru',
  'profile.confirmPassword': 'Ulangi kata sandi baru',
  'profile.changePassword': 'Ganti kata sandi',
  'profile.passwordHint':
    'Minimal 8 karakter, dengan huruf dan angka. Menggantinya membuat Anda keluar dari semua perangkat.',
  'profile.passwordMismatch': 'Kata sandi baru tidak sama',
  'profile.passwordChanged': 'Kata sandi diganti',
  'profile.passwordChangedBody': 'Masuk lagi dengan kata sandi baru Anda.',
  'profile.version': 'MAYA {version}',
  'profile.footer': 'Perlu menerbitkan aplikasi? Hubungi tim platform-mu.',

  'theme.system': 'Sistem',
  'theme.light': 'Terang',
  'theme.dark': 'Gelap',
  'language.en': 'English',
  'language.id': 'Bahasa Indonesia',
};

export type Language = 'en' | 'id';

export const catalogs: Record<Language, Strings> = { en, id };
