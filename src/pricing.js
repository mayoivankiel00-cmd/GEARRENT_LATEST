// Pricing rules, peso formatting and membership tier content. Categories and
// products live in Supabase (public.categories / public.products), not here.
//
// The amounts below are display copies only. The database decides what is
// actually charged, so keep each one in sync with the SQL function named
// beside it.

export const SERVICE_FEE = 500; // gearrent_service_fee()
export const RENTER_MEMBERSHIP_FEE = 499; // gearrent_membership_fee('renter', ...)
export const PROVIDER_MEMBERSHIP_FEE = 699; // gearrent_membership_fee('provider', ...)
export const PROVIDER_UPGRADE_FEE = 199; // gearrent_membership_fee('provider', <a Renter>)

// profiles.tier values (the profiles_tier_check constraint allows only these).
export const TIER_GUEST = 'Gear Rent Guest';
export const TIER_RENTER = 'Gear Rent Renter';
export const TIER_PROVIDER = 'Gear Rent Provider';

// gearrent_security_deposit(): 2% of the daily price, rounded up to the next
// ₱100, minimum ₱100. A missing price counts as 0, as it does in the database.
export function calculateSecurityDeposit(price) {
  const value = Number(price) || 0;
  return Math.max(100, Math.ceil((value * 0.02) / 100) * 100);
}

// `level` matches gearrent_tier_level(): each tier includes the ones below it.
export const membershipTiers = [
  {
    id: 'guest',
    level: 0,
    name: TIER_GUEST,
    price: 0,
    description: 'Look around the Gear Rent community and see what equipment is out there.',
    perks: ['Browse the full gear catalog', 'View gear details and availability'],
    cta: 'Continue as Guest',
    featured: false,
  },
  {
    id: 'renter',
    level: 1,
    name: TIER_RENTER,
    price: RENTER_MEMBERSHIP_FEE,
    description: 'For creators who need reliable equipment for shoots, events, and adventures.',
    perks: ['Refundable security deposits', 'Access to the full gear catalog and rent gear', 'Member rental history'],
    cta: 'Become a Renter',
    featured: false,
  },
  {
    id: 'provider',
    level: 2,
    name: TIER_PROVIDER,
    price: PROVIDER_MEMBERSHIP_FEE,
    upgradePrice: PROVIDER_UPGRADE_FEE, // when upgrading from Renter
    description: 'For owners who want to list their equipment and earn by renting it to other creators.',
    perks: [
      'Everything in Gear Rent Renter',
      'List your own equipment',
      'Set your rates and availability',
      'Manage rental requests and earnings',
    ],
    cta: 'Become a Provider',
    featured: true,
  },
];

// What `currentLevel` pays to move up to `tier` (0 = nothing to pay).
export function getMembershipPrice(tier, currentLevel = 0) {
  if (tier.level <= currentLevel) return 0;
  if (tier.upgradePrice != null && currentLevel === 1) return tier.upgradePrice;
  return tier.price;
}

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
