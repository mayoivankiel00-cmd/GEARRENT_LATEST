import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { calculateSecurityDeposit } from './mockData';
import { getRentalHistoryId } from './rentalUtils';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);
const DEFAULT_DAYS = 3;
export const MIN_RENTAL_DAYS = 1;
export const MAX_RENTAL_DAYS = 90; // matches the cart_items_days_range constraint
// Display only — the database (checkout_cart) computes the amount charged.
export const SERVICE_FEE = 500;

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
  };
}

export function CartProvider({ children }) {
  const { user, isAuthenticated, refreshProfile } = useAuth();
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
    const { data, error } = await supabase
      .from('rentals')
      .select(
        `id, days, status, rented_at, paid_at, return_at, finished_at, rental_amount, security_deposit,
         deposit_status, deposit_held_at, deposit_refunded_at, refundable_amount, hidden_at,
         products (${PRODUCT_SELECT})`
      )
      .eq('user_id', user.id)
      .order('rented_at', { ascending: false });
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

  const addItem = useCallback(async (product, days = DEFAULT_DAYS) => {
    if (!user) return;
    const existing = items.find((i) => i.product.id === product.id);
    const nextDays = clampDays(existing ? existing.days + days : days);
    const { error } = await supabase
      .from('cart_items')
      .upsert({ user_id: user.id, product_id: product.id, days: nextDays }, { onConflict: 'user_id,product_id' });
    if (error) {
      console.error('addItem failed', error);
      return;
    }
    await refreshCart();
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

  // Returns { ok, rental, error }. The refund (unused days + deposit) is
  // calculated and credited by the `return_rental` database function.
  const returnRental = useCallback(async (rentalIndex) => {
    const rental = rentedItems[rentalIndex] || null;
    if (!rental) return { ok: false, rental: null, error: 'Rental not found.' };

    const { data, error } = await supabase.rpc('return_rental', { p_rental_id: String(rental.id) });
    if (error) {
      console.error('returnRental failed', error);
      await refreshRentals();
      return { ok: false, rental, error: describeMoneyError(error, 'The return could not be processed. Please try again.') };
    }

    await Promise.all([refreshRentals(), refreshProfile()]);
    return {
      ok: true,
      error: null,
      rental: {
        ...rental,
        refundableAmount: Number(data.refund) || 0,
        refundedSecurityDeposit: Number(data.deposit_refund) || 0,
        depositStatus: 'refunded',
        unusedDays: Number(data.unused_days) || 0,
      },
    };
  }, [rentedItems, refreshRentals, refreshProfile]);

  // Returns { ok, rental, error }. Refunds the security deposit server-side.
  const finishRental = useCallback(async (rentalIndex) => {
    const rental = rentedItems[rentalIndex] || null;
    if (!rental) return { ok: false, rental: null, error: 'Rental not found.' };

    const { data, error } = await supabase.rpc('finish_rental', { p_rental_id: String(rental.id) });
    if (error) {
      console.error('finishRental failed', error);
      await refreshRentals();
      return { ok: false, rental, error: describeMoneyError(error, 'The rental could not be closed. Please try again.') };
    }

    await Promise.all([refreshRentals(), refreshProfile()]);
    return { ok: true, error: null, rental: { ...rental, refundedSecurityDeposit: Number(data.deposit_refund) || 0 } };
  }, [rentedItems, refreshRentals, refreshProfile]);

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
      returnRental,
      finishRental,
      removeRentalHistory,
      refreshCart,
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
    returnRental,
    finishRental,
    removeRentalHistory,
    refreshCart,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
