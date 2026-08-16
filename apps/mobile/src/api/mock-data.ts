import type { App } from '../types';

/**
 * Realistic internal-company catalog used by MockAppProvider.
 *
 * Screenshot URLs are stable synthetic identifiers (`mock://<slug>/<n>`), not
 * network images — the Screenshot component renders a deterministic gradient
 * placeholder for any non-http URL so the UI works fully offline. Once the API
 * serves real assets these become https URLs and render as images unchanged.
 */

const shots = (slug: string, count: number): string[] =>
  Array.from({ length: count }, (_, i) => `mock://${slug}/${i + 1}`);

export const MOCK_APPS: App[] = [
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000001',
    slug: 'hr-portal',
    name: 'HR Portal',
    category: 'HR',
    version: '3.2.1',
    size: 42_318_233,
    screenshotUrls: shots('hr-portal', 4),
    tagline: 'Leave, payslips, and org chart in one place',
    description:
      'HR Portal is the employee self-service app for everything people-related. Submit and track leave requests, view payslips and tax documents, browse the org chart, and update your personal details without filing a ticket. Approvals arrive as push notifications so managers can clear a queue from their phone.',
    releaseNotes:
      '• Leave balance now reflects carry-over from the previous year\n• Payslip PDFs open in-app instead of the browser\n• Fixed org chart crash on profiles without a manager\n• Indonesian localization for all approval screens',
    minOs: 'Android 9.0',
    rating: 4.6,
    ratingCount: 218,
    featured: true,
    platform: 'android',
    publisher: 'People Ops Engineering',
    updatedAt: '2026-07-28',
    accessStatus: 'available',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000002',
    slug: 'expense-tracker',
    name: 'Expense Tracker',
    category: 'Finance',
    version: '1.4.0',
    size: 28_904_112,
    screenshotUrls: shots('expense-tracker', 3),
    tagline: 'Snap a receipt, get reimbursed',
    description:
      'Capture receipts with the camera, let OCR fill in the merchant and amount, and submit an expense report in under a minute. Supports multi-currency trips, per-diem rules, and direct routing to your cost-center approver. Offline capture syncs when you are back on the tailnet.',
    releaseNotes:
      '• Multi-currency trips with daily FX snapshot\n• OCR accuracy improvements for thermal receipts\n• Draft reports now survive app restarts',
    minOs: 'Android 8.0',
    rating: 4.2,
    ratingCount: 143,
    featured: true,
    platform: 'android',
    publisher: 'Finance Systems',
    updatedAt: '2026-08-05',
    accessStatus: 'available',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000003',
    slug: 'field-scanner',
    name: 'Field Scanner',
    category: 'Tools',
    version: '2.1.0',
    size: 61_205_990,
    screenshotUrls: shots('field-scanner', 5),
    tagline: 'Barcode and asset scanning for site teams',
    description:
      'Field Scanner turns a phone into a rugged asset scanner. Scan barcodes and QR labels, attach photos and GPS, and reconcile inventory against the warehouse system. Built for spotty connectivity: everything queues locally and syncs when a network appears.',
    releaseNotes:
      '• Batch scan mode — 50 codes without leaving the camera\n• Offline queue now shows per-item sync status\n• Reduced APK size by 18%',
    minOs: 'Android 10.0',
    rating: 4.8,
    ratingCount: 96,
    featured: true,
    platform: 'android',
    publisher: 'Platform Tools',
    updatedAt: '2026-08-11',
    accessStatus: 'available',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000004',
    slug: 'sales-crm-companion',
    name: 'Sales CRM Companion',
    category: 'Sales',
    version: '5.0.3',
    size: 74_812_004,
    screenshotUrls: shots('sales-crm-companion', 4),
    tagline: 'Your pipeline, offline-first',
    description:
      'The mobile companion to the internal CRM. Review your pipeline, log call notes by voice, and prep for meetings with an account brief generated from the last 90 days of activity. Deal stages sync both ways with the desktop CRM.',
    releaseNotes:
      '• Voice-to-text call notes\n• Account brief on the meeting screen\n• Fixed duplicate contacts after a conflicted sync',
    minOs: 'Android 9.0',
    rating: 4.1,
    ratingCount: 187,
    featured: false,
    platform: 'android',
    publisher: 'Revenue Engineering',
    updatedAt: '2026-06-30',
    accessStatus: 'available',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000005',
    slug: 'shift-planner',
    name: 'Shift Planner',
    category: 'Ops',
    version: '2.7.4',
    size: 33_442_180,
    screenshotUrls: shots('shift-planner', 3),
    tagline: 'Rosters, swaps, and clock-in',
    description:
      'Shift Planner publishes rosters to frontline teams and handles the messy parts: shift swaps with manager approval, geofenced clock-in, and overtime warnings before they become payroll problems. Supervisors get a live coverage view per site.',
    releaseNotes:
      '• Geofenced clock-in with configurable radius\n• Swap requests expire automatically after 24h\n• Coverage view groups by site instead of by team',
    minOs: 'Android 8.1',
    rating: 3.9,
    ratingCount: 74,
    featured: false,
    platform: 'android',
    publisher: 'Workforce Ops',
    updatedAt: '2026-07-14',
    accessStatus: 'available',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000006',
    slug: 'vendor-approvals',
    name: 'Vendor Approvals',
    category: 'Finance',
    version: '1.1.2',
    size: 19_774_336,
    screenshotUrls: shots('vendor-approvals', 2),
    tagline: 'Clear the purchase-order queue anywhere',
    description:
      'A focused approvals inbox for purchase orders and vendor onboarding. Every request shows budget impact, prior spend with the vendor, and the policy rule that triggered your approval. One-tap approve or send back with a reason.',
    releaseNotes:
      '• Budget impact shown inline on each request\n• Send-back now requires a reason\n• Biometric confirmation for approvals above the threshold',
    minOs: 'Android 9.0',
    rating: 4.4,
    ratingCount: 52,
    featured: false,
    platform: 'android',
    publisher: 'Finance Systems',
    updatedAt: '2026-08-02',
    accessStatus: 'restricted',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000007',
    slug: 'onboarding-buddy',
    name: 'Onboarding Buddy',
    category: 'HR',
    version: '0.9.2',
    size: 24_118_720,
    screenshotUrls: shots('onboarding-buddy', 3),
    tagline: 'Day-one checklist for new joiners',
    description:
      'Walks new hires through their first two weeks: equipment pickup, account setup, mandatory training, and intro meetings. Buddies and managers see progress so nobody is stuck waiting on a form they did not know existed.',
    releaseNotes:
      '• Beta release for the People Ops pilot group\n• Checklist templates per department\n• Known issue: push reminders are not yet scheduled',
    minOs: 'Android 10.0',
    rating: 4.0,
    ratingCount: 18,
    featured: false,
    platform: 'android',
    publisher: 'People Ops Engineering',
    updatedAt: '2026-08-09',
    accessStatus: 'available',
  },
  {
    id: 'a1f3c0d2-1111-4a10-8b01-000000000008',
    slug: 'site-inspector-ios',
    name: 'Site Inspector',
    category: 'Tools',
    version: '4.3.0',
    size: 88_650_112,
    screenshotUrls: shots('site-inspector-ios', 4),
    tagline: 'Guided safety inspections on iPad',
    description:
      'Structured safety and quality inspections with photo evidence, signature capture, and PDF report generation. Templates are versioned so an audit always shows the checklist that was in force on the day. iPad-optimized layout with split view.',
    releaseNotes:
      '• Split-view layout for iPad\n• Signature capture with Apple Pencil\n• Report PDFs embed geotagged photos',
    minOs: 'iOS 16.0',
    rating: 4.5,
    ratingCount: 61,
    featured: false,
    platform: 'ios',
    publisher: 'Platform Tools',
    updatedAt: '2026-05-22',
    accessStatus: 'unsupported',
  },
];
