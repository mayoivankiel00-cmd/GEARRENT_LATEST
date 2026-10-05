// Rules for the Quantity and Weight fields on listing forms (Provider Gear
// and Admin → Add Equipment). Both are optional, but when filled in they
// must be a sensible number: quantity is how many units come with one
// rental (e.g. a pair of lights = 2), weight is in kilograms.

export const MAX_QUANTITY = 100;
export const MAX_WEIGHT_KG = 50;

// Keys that a number field would otherwise accept but that make no sense
// here ("1e5", "-3", "+2"). Quantity also refuses decimals.
export function blockInvalidNumberKeys(event, { allowDecimal = true } = {}) {
  const blocked = ['e', 'E', '+', '-'];
  if (!allowDecimal) blocked.push('.', ',');
  if (blocked.includes(event.key)) event.preventDefault();
}

// Returns an error message, or null when both values are fine.
export function validateGearSpecs({ quantity, weight }) {
  const quantityText = String(quantity ?? '').trim();
  const weightText = String(weight ?? '').trim();

  if (quantityText) {
    if (!/^\d+$/.test(quantityText)) return 'Quantity must be a whole number of units, like 2.';
    const value = Number(quantityText);
    if (value < 1 || value > MAX_QUANTITY) return `Quantity must be between 1 and ${MAX_QUANTITY} units.`;
  }

  if (weightText) {
    if (!/^\d+(\.\d{1,2})?$/.test(weightText)) return 'Weight must be a number in kilograms with up to 2 decimals, like 2.5.';
    const value = Number(weightText);
    if (value <= 0 || value > MAX_WEIGHT_KG) return `Weight must be more than 0 and at most ${MAX_WEIGHT_KG} kg.`;
  }

  return null;
}

export function formatQuantity(quantity) {
  const text = String(quantity ?? '').trim();
  if (!text) return '';
  const value = Number(text);
  return `${value} ${value === 1 ? 'unit' : 'units'}`;
}

export function formatWeight(weight) {
  const text = String(weight ?? '').trim();
  return text ? `${Number(text)} kg` : '';
}
