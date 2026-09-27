import { Navigate } from 'react-router-dom';

// Legacy route. It used to clear the cart and show "Rental confirmed"
// without taking payment; checkout now happens only on the Payment page.
export default function Checkout() {
  return <Navigate to="/payment" replace />;
}
