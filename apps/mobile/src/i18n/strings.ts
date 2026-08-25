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

  // profile
  'profile.intro':
    'MAYA is a private catalog for company-built Android and iOS apps. Everything is served from internal infrastructure — nothing here is published to a public store.',
  'profile.account': 'Account',
  'profile.environment': 'Environment',
  'profile.preferences': 'Preferences',
  'profile.appearance': 'Appearance',
  'profile.language': 'Language',
  'profile.name': 'Name',
  'profile.email': 'Email',
  'profile.memberSince': 'Member since',
  'profile.appVersion': 'App version',
  'profile.dataSource': 'Data source',
  'profile.apiBaseUrl': 'API base URL',
  'profile.apiPrefix': 'API prefix',
  'profile.signOut': 'Sign out',
  'profile.footer': 'Need an app published? Contact your platform team.',
  'profile.mockTitle': 'Mock data is active',

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

  'profile.intro':
    'MAYA adalah katalog privat untuk aplikasi Android dan iOS buatan perusahaan. Semuanya dilayani dari infrastruktur internal — tidak ada yang diterbitkan ke toko publik.',
  'profile.account': 'Akun',
  'profile.environment': 'Lingkungan',
  'profile.preferences': 'Preferensi',
  'profile.appearance': 'Tampilan',
  'profile.language': 'Bahasa',
  'profile.name': 'Nama',
  'profile.email': 'Email',
  'profile.memberSince': 'Anggota sejak',
  'profile.appVersion': 'Versi aplikasi',
  'profile.dataSource': 'Sumber data',
  'profile.apiBaseUrl': 'URL dasar API',
  'profile.apiPrefix': 'Prefiks API',
  'profile.signOut': 'Keluar',
  'profile.footer': 'Perlu menerbitkan aplikasi? Hubungi tim platform-mu.',
  'profile.mockTitle': 'Data tiruan sedang aktif',

  'theme.system': 'Sistem',
  'theme.light': 'Terang',
  'theme.dark': 'Gelap',
  'language.en': 'English',
  'language.id': 'Bahasa Indonesia',
};

export type Language = 'en' | 'id';

export const catalogs: Record<Language, Strings> = { en, id };
