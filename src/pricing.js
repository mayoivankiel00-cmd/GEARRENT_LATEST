// Pricing rules, peso formatting and membership tier content. Categories and
// products live in Supabase (public.categories / public.products), not here.
//
// The amounts below are display copies only. The database decides what is
// actually charged, so keep each one in sync with the SQL function named
// beside it.

export const SERVICE_FEE = 500; // gearrent_service_fee()
export const PROVIDER_MEMBERSHIP_FEE = 499; // gearrent_provider_membership_fee()

// gearrent_security_deposit(): 2% of the daily price, rounded up to the next
// ₱100, minimum ₱100. A missing price counts as 0, as it does in the database.
export function calculateSecurityDeposit(price) {
  const value = Number(price) || 0;
  return Math.max(100, Math.ceil((value * 0.02) / 100) * 100);
}

export const membershipTiers = [
  {
    id: 'basic',
    name: 'Gear Renter',
    price: 0,
    description: 'For creators who need reliable equipment for shoots, events, and adventures.',
    perks: ['Refundable security deposits', 'Access to the full gear catalog', 'Member rental history'],
    cta: 'Rent Gear',
    featured: false,
  },
  {
    id: 'provider',
    name: 'Gear Provider',
    price: PROVIDER_MEMBERSHIP_FEE,
    description: 'For owners who want to list their equipment and earn by renting it to other creators.',
    perks: ['List your own equipment', 'Set your rates and availability', 'Manage rental requests and earnings'],
    cta: 'Become a Provider',
    featured: true,
  },
];

// Whole amounts drop the decimals (₱12,000); anything else shows centavos
// (₱1,234.50). Negatives render as -₱500.
const pesoWhole = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
});
const pesoCentavos = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Missing amounts (null/undefined) show as ₱0 instead of crashing the page.
export function formatPeso(amount) {
  const value = Number(amount);
  if (!Number.isFinite(value)) return pesoWhole.format(0);
  return (Number.isInteger(value) ? pesoWhole : pesoCentavos).format(value);
}
