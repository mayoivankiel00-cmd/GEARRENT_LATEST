// Mirrors gearrent_tier_level() in gearrent_membership_tiers_update.sql:
// 0 = Gear Rent Guest, 1 = Gear Rent Renter, 2 = Gear Rent Provider.
// Unknown or legacy values ('Gear Renter' was the old free tier) count as Guest,
// except anything containing "provider".
export function getTierLevel(userOrTier) {
  const value = typeof userOrTier === 'string'
    ? userOrTier
    : userOrTier?.tier || userOrTier?.role || userOrTier?.accountType || '';
  if (typeof value !== 'string') return 0;
  const tier = value.trim().toLowerCase();
  if (tier.includes('provider')) return 2;
  if (tier === 'gear rent renter') return 1;
  return 0;
}

export function isGearProvider(user) {
  return getTierLevel(user) >= 2;
}

// Renting needs a Renter or Provider membership. Admins are exempt, as they
// are in the database.
export function canRentGear(user) {
  return Boolean(user) && (user.role === 'admin' || getTierLevel(user) >= 1);
}
