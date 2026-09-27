export function isGearProvider(user) {
  const providerValue = user?.tier || user?.role || user?.accountType || '';
  return typeof providerValue === 'string' && providerValue.toLowerCase().includes('provider');
}
