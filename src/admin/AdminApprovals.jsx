import { useEffect, useState } from 'react';
import { formatPeso } from '../lib/pricing';
import { useCategories } from '../context/CategoryContext';
import { useProviderCatalog } from '../context/ProviderContext';
import AdminLayout from './AdminLayout';
import './AdminMetricPages.css';
import './AdminModeration.css';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function ReviewCard({ product, onReview }) {
  const [activeImage, setActiveImage] = useState(0);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { categories } = useCategories();
  const category = categories.find((item) => item.id === product.category);
  const images = product.images?.length ? product.images : [product.image].filter(Boolean);

  const submit = async (decision) => {
    if (decision === 'rejected' && !note.trim()) {
      setError('Add a short reason so the provider knows what to fix.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await onReview(product.id, decision, note.trim());
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <article className="card review-card">
      <div className="review-media">
        <div className="review-media-main">
          {images[activeImage] ? <img src={images[activeImage]} alt={product.name} /> : <span>No photo</span>}
        </div>
        {images.length > 1 && (
          <div className="review-media-thumbs">
            {images.map((src, index) => (
              <button type="button" key={`${index}-${src}`} className={index === activeImage ? 'active' : ''} onClick={() => setActiveImage(index)} aria-label={`Show photo ${index + 1}`}>
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="review-body">
        <div className="review-top">
          <span className="eyebrow">{category?.name || 'Gear'}</span>
          <strong>{formatPeso(Number(product.price) || 0)} <small>/ day</small></strong>
        </div>
        <h2>{product.name}</h2>
        <p className="review-meta mono">
          {product.providerName || 'Provider'} · {product.providerEmail || 'unknown email'} · submitted {formatDateTime(product.submittedAt)}
        </p>
        <p className="review-description">{product.description || 'No description provided.'}</p>
        <div className="review-specs">
          {Object.entries(product.specs || {}).map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}
        </div>

        {rejecting && (
          <label className="moderation-field">Reason for rejection (sent to the provider)
            <textarea rows="2" value={note} onChange={(event) => setNote(event.target.value)} placeholder="e.g. Photos don't show the actual item; add the serial-number plate." maxLength={500} autoFocus />
          </label>
        )}
        {error && <p className="moderation-status error" role="alert">{error}</p>}

        <div className="moderation-actions">
          {!rejecting ? (
            <>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => submit('approved')}>{busy ? 'Saving…' : 'Approve & publish'}</button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setRejecting(true)}>Reject…</button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-primary review-reject-btn" disabled={busy} onClick={() => submit('rejected')}>{busy ? 'Saving…' : 'Confirm rejection'}</button>
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => { setRejecting(false); setError(''); }}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

export default function AdminApprovals() {
  const { pendingProducts, reviewProduct, refreshPendingProducts } = useProviderCatalog();
  const [flash, setFlash] = useState('');

  useEffect(() => {
    refreshPendingProducts();
  }, [refreshPendingProducts]);

  const handleReview = async (productId, decision, note) => {
    const product = pendingProducts.find((item) => item.id === productId);
    const result = await reviewProduct(productId, decision, note);
    if (result.ok) {
      setFlash(decision === 'approved'
        ? `${product?.name || 'Listing'} approved. It is now live in the catalog.`
        : `${product?.name || 'Listing'} rejected. The provider has been notified.`);
    }
    return result;
  };

  return (
    <AdminLayout>
      <div className="metric-page-heading">
        <div>
          <span className="mono metric-page-kicker">Catalog moderation</span>
          <h1 className="admin-title">Listing <span className="accent">Approvals</span></h1>
          <p>Provider listings stay hidden from the catalog until an administrator approves them.</p>
        </div>
        <strong className="metric-page-total">{pendingProducts.length}</strong>
      </div>

      {flash && <p className="moderation-status success moderation-flash" role="status">{flash}</p>}

      <div className="review-toolbar">
        <span className="mono">{pendingProducts.length} awaiting review · oldest first</span>
        <button type="button" className="btn btn-outline moderation-refresh" onClick={refreshPendingProducts}>Refresh</button>
      </div>

      {pendingProducts.length === 0 ? (
        <div className="card review-empty">
          <strong>All caught up.</strong>
          <span>New provider listings will appear here for review.</span>
        </div>
      ) : (
        <div className="review-list">
          {pendingProducts.map((product) => (
            <ReviewCard key={product.id} product={product} onReview={handleReview} />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
