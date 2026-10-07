// Checks for the simulated card forms (rental checkout and memberships).
// Nothing is charged, but the fields should still only accept input that
// looks like a real card.

export const CARD_NUMBER_LENGTH = 16;

const onlyDigits = (value) => String(value || '').replace(/\D/g, '');

// "4111111111111111" -> "4111 1111 1111 1111"
export function formatCardNumber(value) {
  return onlyDigits(value).slice(0, CARD_NUMBER_LENGTH).replace(/(\d{4})(?=\d)/g, '$1 ');
}

// "1228" -> "12 / 28". A first digit above 1 can only be a single-digit month.
export function formatExpiry(value) {
  let digits = onlyDigits(value);
  if (digits.length === 1 && digits > '1') digits = `0${digits}`;
  digits = digits.slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)} / ${digits.slice(2)}` : digits;
}

export function formatCvv(value) {
  return onlyDigits(value).slice(0, 4);
}

// Returns an error message, or '' when the card details look valid.
export function validateCard(formData, now = new Date()) {
  const name = String(formData.get('cardholder') || '').trim();
  if (!/^[\p{L}][\p{L} .'-]{1,}$/u.test(name)) return 'Enter the cardholder name as it appears on the card.';

  if (onlyDigits(formData.get('cardNumber')).length !== CARD_NUMBER_LENGTH) {
    return `Enter the full ${CARD_NUMBER_LENGTH}-digit card number.`;
  }

  const expiry = onlyDigits(formData.get('expiry'));
  const month = Number(expiry.slice(0, 2));
  const year = 2000 + Number(expiry.slice(2));
  if (expiry.length !== 4 || month < 1 || month > 12) return 'Enter the expiry date as MM / YY.';
  // A card stays valid until the last day of its expiry month.
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const expiryMonth = year * 12 + (month - 1);
  if (expiryMonth < thisMonth) return 'This card has expired.';
  if (expiryMonth > thisMonth + 20 * 12) return 'Enter a valid expiry date.';

  if (!/^\d{3,4}$/.test(onlyDigits(formData.get('cvv')))) return 'Enter the 3 or 4 digit security code.';

  return '';
}

export function cardLast4(formData) {
  return onlyDigits(formData.get('cardNumber')).slice(-4);
}
