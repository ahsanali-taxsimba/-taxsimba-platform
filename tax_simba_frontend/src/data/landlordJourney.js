/** One intent map shared by the hub, service pages and guide return links. */
export const LANDLORD_PATHS = { hub: '/landlords', sa: '/rental-income-service', mtd: '/rental-income-tax' };
export const LANDLORD_GROUPS = [
  { id: 'start', title: 'Start with the right filing route', description: 'Annual return, digital updates, or both? Keep the two jobs clear.', guides: [
    ['self-assessment-for-landlords-2025-26', 'Prepare your annual landlord return', 'SA'],
    ['mtd-for-landlords-2026-27', 'Understand MTD for your rental income', 'MTD'],
    ['mtd-employed-landlord-salary', 'Check how employment and rent fit together', 'MTD'],
    ['mtd-sole-trader-and-landlord-separate-updates', 'Keep trade and property updates straight', 'MTD'],
  ]},
  { id: 'records', title: 'Get your rental records ready', description: 'Turn statements and receipts into a useful preparation pack.', guides: [
    ['mtd-letting-agent-gross-rent-net-payment', 'Reconcile agent statements and gross rent', 'MTD'],
    ['landlord-mortgage-interest-tax-relief', 'Separate mortgage interest from repayments', 'SA'],
    ['landlord-repairs-vs-improvements', 'Distinguish repairs from improvements', 'SA'],
    ['landlord-replacement-domestic-items-relief', 'Prepare furniture and appliance costs', 'SA'],
    ['landlord-expenses-empty-property-void-period', 'Keep evidence during empty periods', 'SA'],
  ]},
  { id: 'ownership', title: 'Check ownership and special circumstances', description: 'Tell us about the whole situation before choosing a package.', guides: [
    ['joint-rental-property-tax-return', 'Work out what each joint owner reports', 'SA'],
    ['mtd-jointly-owned-rental-property', 'Check MTD separately for each owner', 'MTD'],
    ['airbnb-holiday-let-tax-2025-26', 'Check holiday-let and Airbnb changes', 'SA'],
    ['rent-a-room-relief-lodger-tax', 'Understand lodger income and Rent a Room', 'SA'],
    ['non-resident-landlord-uk-tax-return', 'Prepare UK rental income while abroad', 'SA'],
    ['mtd-new-business-new-rental-income', 'Add a new rental source while in MTD', 'MTD'],
  ]},
  { id: 'urgent', title: 'Deal with a sale or earlier undeclared rent', description: 'These can need a separate service and a different timetable.', guides: [
    ['sold-rental-property-60-day-tax', 'Check the property-sale reporting deadline', 'SPECIALIST'],
    ['undeclared-rental-income-hmrc', 'Put earlier undeclared rental income in order', 'SPECIALIST'],
  ]},
];
export const LANDLORD_GUIDES = LANDLORD_GROUPS.flatMap(g => g.guides);
export function getLandlordJourney(slug) {
  const guide = LANDLORD_GUIDES.find(g => g[0] === slug);
  if (!guide) return null;
  const kind = guide[2];
  return { kind, href: kind === 'MTD' ? LANDLORD_PATHS.mtd : kind === 'SA' ? LANDLORD_PATHS.sa : '/contact-us', label: kind === 'MTD' ? 'Explore landlord MTD support' : kind === 'SA' ? 'Explore landlord tax-return support' : 'Ask about specialist property work' };
}
