import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { SERVICE_FEE, calculateSecurityDeposit } from './pricing';
import { getRentalHistoryId } from './rentalUtils';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const DEFAULT_DAYS = 3;
export const MIN_RENTAL_DAYS = 1;
export const MAX_RENTAL_DAYS = 90; // matches the cart_items_days_range constraint

function clampDays(days) {
  const value = Math.round(Number(days) || DEFAULT_DAYS);
  return Math.min(MAX_RENTAL_DAYS, Math.max(MIN_RENTAL_DAYS, value));
}

// Supabase error → message the renter can act on. Messages raised by the
// payment functions are already written for people, so they pass through.
function describeMoneyError(error, fallback) {
  if (!error) return fallback;
  const text = `${error.message || ''} ${error.hint || ''}`;
  if (/rate_limited|too many|rate limit/i.test(text)) return 'Too many attempts. Please wait a few minutes and try again.';
  if (error.code === 'P0001' || error.code === 'P0002' || error.code === '22023') return error.message;
  return fallback;
}

// Every read joins the owning provider's profile so `providerEmail`/
// `providerName` keep working exactly like they did against mockData.js.
const PRODUCT_SELECT =
  'id, name, price, status, blurb, description, specs, features, images, category_id, provider_id, provider:profiles(email, name)';

// Added by gearrent_returns_update.sql.
const RETURN_COLUMNS = 'return_requested_at, late_days, late_fee, damage_charge, return_note, ';

function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    status: row.status,
    blurb: row.blurb,
    description: row.description,
    specs: row.specs || {},
    features: row.features || [],
    images: row.images || [],
    category: row.category_id,
    providerListed: Boolean(row.provider_id),
    providerEmail: row.provider?.email || '',
    providerName: row.provider?.name || '',
  };
}

function toMillis(value) {
  return value ? new Date(value).getTime() : null;
}

function mapRentalRow(row) {
  return {
    id: row.id,
    product: mapProductRow(row.products),
    days: row.days,
    status: row.status,
    statusLabel:
      row.status === 'returned' ? 'Returned' : row.status === 'finished' ? 'Finished renting' : 'Current possession',
    rentedAt: toMillis(row.rented_at),
    paidAt: toMillis(row.paid_at),
    returnAt: toMillis(row.return_at),
    finishedAt: toMillis(row.finished_at),
    rentalAmount: row.rental_amount != null ? Number(row.rental_amount) : null,
    securityDeposit: row.security_deposit != null ? Number(row.security_deposit) : null,
    depositStatus: row.deposit_status,
    depositHeldAt: toMillis(row.deposit_held_at),
    depositRefundedAt: toMillis(row.deposit_refunded_at),
    refundableAmount: row.refundable_amount != null ? Number(row.refundable_amount) : null,
    // Set when the renter hands the gear back; the rental stays active until
    // the owner (or an admin) confirms the return.
    returnRequestedAt: toMillis(row.return_requested_at),
    lateDays: Number(row.late_days) || 0,
    lateFee: Number(row.late_fee) || 0,
    damageCharge: Number(row.damage_charge) || 0,
    returnNote: row.return_note || '',
  };
}

export function CartProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [items, setItems] = useState([]);
  const [rentedItems, setRentedItems] = useState([]);
  const [rentalHistory, setRentalHistory] = useState([]);
  const [deletedRentalHistoryIds, setDeletedRentalHistoryIds] = useState([]);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setItems([]);
      return;
    }
    const { data, error } = await supabase
      .from('cart_items')
      .select(`days, products (${PRODUCT_SELECT})`)
      .eq('user_id', user.id);
    if (error) {
      console.error('Failed to load cart', error);
      return;
    }
    setItems((data || []).map((row) => ({ product: mapProductRow(row.products), days: row.days })).filter((i) => i.product));
  }, [isAuthenticated, user]);

  const refreshRentals = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setRentedItems([]);
      setRentalHistory([]);
      setDeletedRentalHistoryIds([]);
      return;
    }
    const loadRentals = (returnColumns) => supabase
      .from('rentals')
      .select(
        `id, days, status, rented_at, paid_at, return_at, finished_at, rental_amount, security_deposit,
         deposit_status, deposit_held_at, deposit_refunded_at, refundable_amount, hidden_at,
         ${returnColumns}products (${PRODUCT_SELECT})`
      )
      .eq('user_id', user.id)
      .order('rented_at', { ascending: false });

    let { data, error } = await loadRentals(RETURN_COLUMNS);
    if (error?.code === '42703') {
      // Undefined column: gearrent_returns_update.sql hasn't been run yet.
      // Still show the rentals instead of an empty page.
      console.warn('Return columns missing on rentals — run gearrent_returns_update.sql.', error);
      ({ data, error } = await loadRentals(''));
    }
    if (error) {
      console.error('Failed to load rentals', error);
      return;
    }
    const rows = (data || []).filter((row) => row.products).map(mapRentalRow);
    setRentedItems(rows.filter((r) => r.status === 'active'));
    setRentalHistory(rows.filter((r) => r.status !== 'active'));
    setDeletedRentalHistoryIds((data || []).filter((row) => row.hidden_at).map((row) => row.id));
  }, [isAuthenticated, user]);

  useEffect(() => {
    refreshCart();
    refreshRentals();
  }, [refreshCart, refreshRentals]);

  // Returns { ok, error }. Guests are refused by the database
  // (gearrent_require_renter_tier), not just by the page.
  const addItem = useCallback(async (product, days = DEFAULT_DAYS) => {
    if (!user) return { ok: false, error: 'Please sign in to rent gear.' };
    const existing = items.find((i) => i.product.id === product.id);
    const nextDays = clampDays(existing ? existing.days + days : days);
    const { error } = await supabase
      .from('cart_items')
      .upsert({ user_id: user.id, product_id: product.id, days: nextDays }, { onConflict: 'user_id,product_id' });
    if (error) {
      console.error('addItem failed', error);
      return {
        ok: false,
        error: error.hint === 'membership_required'
          ? error.message
          : describeMoneyError(error, 'This item could not be added to your cart.'),
      };
    }
    await refreshCart();
    return { ok: true, error: null };
  }, [items, user, refreshCart]);

  const removeItem = useCallback(async (productId) => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('user_id', user.id).eq('product_id', productId);
    await refreshCart();
  }, [user, refreshCart]);

  const updateItemDays = useCallback(async (productId, days) => {
    if (!user) return;
    await supabase.from('cart_items').update({ days: clampDays(days) }).eq('user_id', user.id).eq('product_id', productId);
    await refreshCart();
  }, [user, refreshCart]);

  const clearCart = useCallback(async () => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('user_id', user.id);
    setItems([]);
  }, [user]);

  // Pays for everything in the cart. Prices, deposits, the service fee and
  // provider payouts are all worked out by the `checkout_cart` database
  // function from the products table — nothing the browser sends is trusted.
  // Returns { ok, receipt, error }.
  const checkout = useCallback(async () => {
    if (!user) return { ok: false, receipt: null, error: 'Please sign in to check out.' };
    const { data, error } = await supabase.rpc('checkout_cart');
    if (error) {
      console.error('checkout failed', error);
      await refreshCart(); // e.g. an item became unavailable
      return { ok: false, receipt: null, error: describeMoneyError(error, 'Payment could not be completed. Please try again.') };
    }
    const receipt = {
      checkoutId: data.checkout_id,
      items: (data.items || []).map((item) => ({
        rentalId: item.rental_id,
        productId: item.product_id,
        name: item.name,
        days: Number(item.days),
        amount: Number(item.amount),
        deposit: Number(item.deposit),
      })),
      subtotal: Number(data.subtotal),
      securityDeposit: Number(data.security_deposit),
      serviceFee: Number(data.service_fee),
      total: Number(data.total),
    };
    setItems([]);
    await refreshRentals();
    return { ok: true, receipt, error: null };
  }, [user, refreshCart, refreshRentals]);

  // The renter hands the gear back. The rental stays active until the owner
  // (or an admin) checks the gear and confirms, which is when refunds and
  // any late fee / damage charge are settled by `confirm_rental_return`.
  // Returns { ok, rental, error, lateDays, lateFee }.
  const requestReturn = useCallback(async (rentalIndex) => {
    const rental = rentedItems[rentalIndex] || null;
    if (!rental) return { ok: false, rental: null, error: 'Rental not found.' };

    const { data, error } = await supabase.rpc('request_rental_return', { p_rental_id: String(rental.id) });
    if (error) {
      console.error('requestReturn failed', error);
      await refreshRentals();
      return { ok: false, rental, error: describeMoneyError(error, 'The return could not be requested. Please try again.') };
    }

    await refreshRentals();
    return {
      ok: true,
      error: null,
      rental,
      lateDays: Number(data?.late_days) || 0,
      lateFee: Number(data?.late_fee) || 0,
    };
  }, [rentedItems, refreshRentals]);

  // Soft-delete only — keeps the underlying financial record intact and
  // just hides it from the user's history view, same as the old
  // "deleted rental history ids" list did in localStorage.
  const removeRentalHistory = useCallback(async (rentalId) => {
    setRentalHistory((prev) => prev.filter((rental, index) => getRentalHistoryId(rental, index) !== rentalId));
    setDeletedRentalHistoryIds((prev) => (prev.includes(rentalId) ? prev : [...prev, rentalId]));
    const { error } = await supabase.from('rentals').update({ hidden_at: new Date().toISOString() }).eq('id', rentalId);
    if (error) console.error('removeRentalHistory failed', error);
  }, []);

  const value = useMemo(() => {
    const subtotal = items.reduce((sum, i) => sum + i.product.price * i.days, 0);
    const securityDeposit = items.reduce((sum, item) => sum + calculateSecurityDeposit(item.product.price), 0);
    const serviceFee = items.length ? SERVICE_FEE : 0;
    return {
      items,
      addItem,
      removeItem,
      updateItemDays,
      clearCart,
      rentedItems,
      rentalHistory,
      deletedRentalHistoryIds,
      checkout,
      requestReturn,
      removeRentalHistory,
      refreshCart,
      refreshRentals,
      count: items.length,
      subtotal,
      securityDeposit,
      serviceFee,
      total: subtotal + securityDeposit + serviceFee,
    };
  }, [
    items,
    addItem,
    removeItem,
    updateItemDays,
    clearCart,
    rentedItems,
    rentalHistory,
    deletedRentalHistoryIds,
    checkout,
    requestReturn,
    removeRentalHistory,
    refreshCart,
    refreshRentals,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
