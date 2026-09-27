import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { removeStoredImages } from './imageStorage';

const ProviderContext = createContext(null);

const PRODUCT_SELECT =
  'id, name, price, status, blurb, description, specs, features, images, category_id, provider_id, '
  + 'approval_status, review_note, reviewed_at, submitted_at, provider:profiles(email, name)';

// Supabase / Postgres error → short message a person can act on.
export function describeProductError(error) {
  if (!error) return '';
  const text = `${error.message || ''} ${error.hint || ''}`;
  if (/rate_limited|too many/i.test(text)) return 'You are publishing too quickly. Please wait a few minutes and try again.';
  if (error.code === '42501') return error.message || 'You do not have permission to do that.';
  // Validation messages raised by the database (e.g. photo rules) are
  // written for people, so show them as-is.
  if (error.code === '22023') return error.message;
  return 'Something went wrong. Please try again.';
}

function mapProductRow(row) {
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
    image: row.images?.[0] || '',
    category: row.category_id,
    providerListed: Boolean(row.provider_id),
    providerId: row.provider_id,
    // 'pending' | 'approved' | 'rejected' — only approved listings reach the catalog.
    approvalStatus: row.approval_status || 'approved',
    reviewNote: row.review_note || '',
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).getTime() : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).getTime() : null,
    providerEmail: row.provider?.email || '',
    providerName: row.provider?.name || '',
  };
}

export function ProviderProvider({ children }) {
  const { user } = useAuth();
  const [providerProducts, setProviderProducts] = useState([]);
  // The full public catalog — mockData's static products plus every
  // provider's listings all now live in the same `products` table, so
  // there's no more "merge static + provider arrays" step.
  const [catalogProducts, setCatalogProducts] = useState([]);
  // Admin-only review queue.
  const [pendingProducts, setPendingProducts] = useState([]);
  const isAdmin = user?.role === 'admin';

  const refreshProviderProducts = useCallback(async () => {
    if (!user) {
      setProviderProducts([]);
      return;
    }
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('provider_id', user.id)
      .order('submitted_at', { ascending: false });
    if (error) {
      console.error('Failed to load provider products', error);
      return;
    }
    setProviderProducts((data || []).map(mapProductRow));
  }, [user]);

  const refreshCatalog = useCallback(async () => {
    // Explicit filter as well as RLS: admins and providers can *read* pending
    // rows, but the catalog must only ever show approved ones.
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('approval_status', 'approved');
    if (error) {
      console.error('Failed to load catalog', error);
      return;
    }
    setCatalogProducts((data || []).map(mapProductRow));
  }, []);

  const refreshPendingProducts = useCallback(async () => {
    if (!isAdmin) {
      setPendingProducts([]);
      return;
    }
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_SELECT)
      .eq('approval_status', 'pending')
      .order('submitted_at', { ascending: true });
    if (error) {
      console.error('Failed to load review queue', error);
      return;
    }
    setPendingProducts((data || []).map(mapProductRow));
  }, [isAdmin]);

  useEffect(() => {
    refreshProviderProducts();
    refreshCatalog();
    refreshPendingProducts();
  }, [refreshProviderProducts, refreshCatalog, refreshPendingProducts]);

  // Keep the admin's pending badge current.
  useEffect(() => {
    if (!isAdmin) return undefined;
    const timer = window.setInterval(refreshPendingProducts, 30000);
    return () => window.clearInterval(timer);
  }, [isAdmin, refreshPendingProducts]);

  // Returns { product, error }. Listings from non-admins are stored as
  // 'pending' by the database and stay out of the catalog until approved;
  // listings created by an admin are approved immediately.
  const addProviderProduct = useCallback(async (productDetails) => {
    if (!user) return { product: null, error: 'You need to be signed in.' };
    const row = {
      provider_id: user.id,
      category_id: productDetails.category,
      name: productDetails.name,
      price: Number(productDetails.price) || 0,
      status: 'available',
      approval_status: isAdmin ? 'approved' : 'pending', // enforced server-side regardless
      blurb: 'Provider listed gear',
      description: productDetails.description || 'Provider listed gear available for your next project.',
      images: productDetails.images?.length ? productDetails.images : [productDetails.image].filter(Boolean),
      specs: {
        Capacity: productDetails.capacity || 'Not specified',
        Weight: productDetails.weight || 'Not specified',
        Sensor: productDetails.sensor || 'Not specified',
        Condition: productDetails.condition || 'Good',
      },
      features: ['Provider listed', 'Available for rental'],
    };
    const { data, error } = await supabase.from('products').insert(row).select(PRODUCT_SELECT).single();
    if (error) {
      console.error('addProviderProduct failed', error);
      return { product: null, error: describeProductError(error) };
    }
    await Promise.all([refreshProviderProducts(), refreshCatalog(), refreshPendingProducts()]);
    return { product: mapProductRow(data), error: null };
  }, [user, isAdmin, refreshProviderProducts, refreshCatalog, refreshPendingProducts]);

  // Admin decision on a pending listing. Returns { ok, error }.
  const reviewProduct = useCallback(async (productId, decision, note = '') => {
    const { error } = await supabase.rpc('admin_review_product', {
      p_product_id: String(productId),
      p_decision: decision,
      p_note: note || null,
    });
    if (error) {
      console.error('reviewProduct failed', error);
      return { ok: false, error: error.message || 'Could not save the review.' };
    }
    await Promise.all([refreshPendingProducts(), refreshCatalog()]);
    return { ok: true, error: null };
  }, [refreshPendingProducts, refreshCatalog]);

  const removeProviderProduct = useCallback(async (productId) => {
    if (!user) return;
    const listing = providerProducts.find((product) => product.id === productId);
    const { error } = await supabase.from('products').delete().eq('id', productId).eq('provider_id', user.id);
    if (error) {
      console.error('removeProviderProduct failed', error);
      return;
    }
    // Remove the listing's photos from Storage too (only files in the
    // provider's own folder).
    if (listing?.images?.length) await removeStoredImages(listing.images, `products/${user.id}`);
    await Promise.all([refreshProviderProducts(), refreshCatalog(), refreshPendingProducts()]);
  }, [user, providerProducts, refreshProviderProducts, refreshCatalog, refreshPendingProducts]);

  const value = useMemo(() => ({
    providerProducts,
    catalogProducts,
    pendingProducts,
    addProviderProduct,
    removeProviderProduct,
    reviewProduct,
    refreshPendingProducts,
    refreshProviderProducts,
  }), [
    providerProducts,
    catalogProducts,
    pendingProducts,
    addProviderProduct,
    removeProviderProduct,
    reviewProduct,
    refreshPendingProducts,
    refreshProviderProducts,
  ]);

  return <ProviderContext.Provider value={value}>{children}</ProviderContext.Provider>;
}

export function useProviderCatalog() {
  const context = useContext(ProviderContext);
  if (!context) throw new Error('useProviderCatalog must be used within ProviderProvider');
  return context;
}
