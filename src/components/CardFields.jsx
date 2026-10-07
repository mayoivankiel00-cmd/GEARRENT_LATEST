import { CARD_NUMBER_LENGTH, formatCardNumber, formatCvv, formatExpiry } from '../lib/cardValidation';

// Reformat as the user types so letters never make it into the field.
const reformat = (format) => (event) => {
  event.target.value = format(event.target.value);
};

// Stop a typed non-digit before it is drawn. Longer inserts (pastes such as
// "4111-1111-...") are let through and cleaned up by reformat().
const digitsOnly = (event) => {
  if (event.data?.length === 1 && /\D/.test(event.data)) event.preventDefault();
};

// Cardholder, card number, expiry and CVV inputs shared by the payment forms.
// Check the submitted values with validateCard() from lib/cardValidation.
export default function CardFields() {
  return (
    <>
      <label>Cardholder name<input type="text" name="cardholder" placeholder="Full name" autoComplete="cc-name" maxLength="60" required /></label>
      <label>Card number
        <input
          type="text"
          name="cardNumber"
          inputMode="numeric"
          placeholder="0000 0000 0000 0000"
          autoComplete="cc-number"
          maxLength={CARD_NUMBER_LENGTH + 3}
          onBeforeInput={digitsOnly}
          onChange={reformat(formatCardNumber)}
          required
        />
      </label>
      <div className="payment-fields-row">
        <label>Expiry date
          <input type="text" name="expiry" inputMode="numeric" placeholder="MM / YY" autoComplete="cc-exp" maxLength="7" onBeforeInput={digitsOnly} onChange={reformat(formatExpiry)} required />
        </label>
        <label>Security code
          <input type="text" name="cvv" inputMode="numeric" placeholder="CVV" autoComplete="cc-csc" maxLength="4" onBeforeInput={digitsOnly} onChange={reformat(formatCvv)} required />
        </label>
      </div>
    </>
  );
}
