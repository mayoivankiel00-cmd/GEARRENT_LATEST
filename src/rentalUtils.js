const DAY_IN_MILLISECONDS = 86400000;

function parseTimestamp(value) {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue) && numericValue > 0) return numericValue;
  if (typeof value === 'string' && value.trim()) {
    const parsedValue = Date.parse(value);
    if (Number.isFinite(parsedValue)) return parsedValue;
  }
  return null;
}

export function getRentalEndTime(rental, now) {
  const rentalDays = Number(rental?.days);
  const durationDays = Number.isFinite(rentalDays) && rentalDays > 0 ? rentalDays : 3;
  return parseTimestamp(rental?.returnAt) || now + durationDays * DAY_IN_MILLISECONDS;
}

export function getRentalTimeRemaining(rental, now) {
  return Math.max(0, getRentalEndTime(rental, now) - now);
}

export function formatRentalTimeRemaining(rental, now) {
  const totalSeconds = Math.floor(getRentalTimeRemaining(rental, now) / 1000);
  if (totalSeconds <= 0) return 'Rental ended';

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s left`;
}

export function getRentalHistoryId(rental, index = 0) {
  return rental.id
    || `finished-${rental.product?.id || rental.productId}-${rental.finishedAt || rental.rentedAt || index}`;
}
