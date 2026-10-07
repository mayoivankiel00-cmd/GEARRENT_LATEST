import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatPeso } from '../lib/pricing';
import { useCategories } from '../context/CategoryContext';
import { useProviderCatalog } from '../context/ProviderContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import AccountSidebar from '../components/AccountSidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import Icon from '../components/Icon';
import ImageDropzone from '../components/ImageDropzone';
import ReturnInspections from '../components/ReturnInspections';
import RentalHandovers from '../components/RentalHandovers';
import {
  blockInvalidNumberKeys, formatQuantity, formatWeight, MAX_QUANTITY, MAX_WEIGHT_KG, validateGearSpecs,
} from '../lib/gearSpecs';
import '../components/ProductCard.css';
import './ProviderGear.css';

const approvalLabels = {
  pending: { text: 'In review', cls: 'pending' },
  approved: { text: 'Live', cls: 'approved' },
  rejected: { text: 'Not approved', cls: 'rejected' },
};

// One listing, laid out like the catalog's product cards.
function ListingCard({ product, categoryName, onRemove }) {
  const approval = approvalLabels[product.approvalStatus] || approvalLabels.pending;
  const isLive = product.approvalStatus === 'approved';
  const specs = ['Quantity', 'Weight']
    .map((spec) => product.specs?.[spec])
    .filter((value) => value && value !== 'Not specified');
  const image = <img src={product.images[0]} alt={product.name} loading="lazy" />;

  return (
    <article className={`product-card provider-card ${isLive ? '' : 'is-unpublished'}`}>
      {isLive
        ? <Link to={`/product/${product.id}`} className="product-card-media">{image}</Link>
        : <div className="product-card-media">{image}</div>}
      <span className={`status-badge provider-card-status ${approval.cls}`}>{approval.text}</span>

      <div className="product-card-body">
        <div className="product-card-top">
          {isLive
            ? <Link to={`/product/${product.id}`} className="product-card-name">{product.name}</Link>
            : <span className="product-card-name">{product.name}</span>}
          <div className="product-card-price">
            {formatPeso(product.price)}
            <span className="unit">/day</span>
          </div>
        </div>
        <span className="provider-card-meta mono">{[categoryName, ...specs].filter(Boolean).join(' · ')}</span>
        <p className="product-card-blurb small">{product.description || 'No description added.'}</p>
        {product.approvalStatus === 'pending' && <p className="provider-review-note mono">Waiting for administrator approval. Not visible to renters yet.</p>}
        {product.approvalStatus === 'rejected' && <p className="provider-review-note rejected"><b>Reviewer note:</b> {product.reviewNote || 'No reason given.'} Remove this listing and submit a corrected one.</p>}
        <div className="provider-card-actions">
          {isLive
            ? <Link to={`/product/${product.id}`} className="btn btn-outline">View in catalog</Link>
            : <span className="provider-card-hidden mono">Not in the catalog yet</span>}
          <button type="button" className="provider-delete" onClick={() => onRemove(product)} aria-label={`Remove ${product.name}`} title="Remove listing">
            <Icon name="trash" />
          </button>
        </div>
      </div>
    </article>
  );
}

const initialForm = {
  name: '',
  category: '', // empty = first category in the list
  price: '',
  condition: 'Good',
  quantity: '',
  weight: '',
  images: [],
  description: '',
};

export default function ProviderGear() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Tabs live in the address (?tab=listings) so links and Back work.
  const activeTab = searchParams.get('tab') === 'listings' ? 'listings' : 'add';
  const showTab = (tab) => setSearchParams(tab === 'listings' ? { tab: 'listings' } : {});
  const [removing, setRemoving] = useState(null);
  const { providerProducts, addProviderProduct, removeProviderProduct } = useProviderCatalog();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { categories, getCategoryName } = useCategories();
  const [form, setForm] = useState(initialForm);
  const selectedCategory = form.category || categories[0]?.id || '';
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const liveCount = providerProducts.filter((product) => product.approvalStatus === 'approved').length;
  const pendingCount = providerProducts.filter((product) => product.approvalStatus === 'pending').length;
  const rejectedCount = providerProducts.filter((product) => product.approvalStatus === 'rejected').length;

  const handleChange = (event) => {
    setForm((currentForm) => ({ ...currentForm, [event.target.name]: event.target.value }));
  };

  const handleImagesChange = (images) => {
    setForm((currentForm) => ({ ...currentForm, images }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    if (!form.images.length) {
      setMessage('Drag in a photo from your device before publishing.');
      return;
    }
    const specError = validateGearSpecs(form);
    if (specError) {
      setMessage(specError);
      return;
    }
    setSubmitting(true);
    const { product, error } = await addProviderProduct({
      ...form,
      category: selectedCategory,
      price: Number(form.price),
      image: form.images[0],
      images: form.images,
    });
    setSubmitting(false);
    if (!product) {
      setMessage(error || 'Something went wrong submitting this listing. Please try again.');
      return;
    }
    const isLive = product.approvalStatus === 'approved';
    addNotification(
      isLive
        ? `${product.name} was published to the public catalog.`
        : `${product.name} was submitted for review. You'll be notified once an admin approves it.`,
      isLive ? 'success' : 'info',
    );
    setForm(initialForm);
    setMessage(isLive
      ? 'Gear listed. It is now visible in the catalog.'
      : 'Submitted for review. An administrator will check your listing before it appears in the catalog.');
  };

  return (
    <div className="container account-page provider-page">
      <AccountSidebar />
      <main className="account-main">
        <div className="breadcrumb mono"><Link to="/profile">My Profile</Link> &gt; <span>Provider Gear</span></div>
        <header className="provider-page-header">
          <div><span className="eyebrow">Provider workspace</span><h1>Provider Gear</h1><p className="provider-intro">Turn the equipment you own into a living catalog listing.</p></div>
          <div className="provider-live-status"><span className="provider-live-dot" /> Admin-reviewed catalog</div>
        </header>
        <div className="provider-metrics" aria-label="Provider inventory summary">
          <div><span className="mono">Live in catalog</span><strong>{String(liveCount).padStart(2, '0')}</strong></div>
          <div><span className="mono">In review</span><strong>{String(pendingCount).padStart(2, '0')}</strong></div>
          <div><span className="mono">Not approved</span><strong>{String(rejectedCount).padStart(2, '0')}</strong></div>
        </div>

        {/* Only shows up when a renter has paid and is waiting to receive the gear. */}
        <RentalHandovers hideWhenEmpty title="Gear to hand over" />

        {/* Only shows up when a renter has handed back this provider's gear. */}
        <ReturnInspections hideWhenEmpty title="Returned gear to check" />

        <div className="provider-tabs" role="tablist" aria-label="Provider workspace">
          <button
            type="button"
            role="tab"
            id="provider-tab-add"
            aria-selected={activeTab === 'add'}
            aria-controls="provider-panel-add"
            className={activeTab === 'add' ? 'active' : ''}
            onClick={() => showTab('add')}
          >
            Add gear
          </button>
          <button
            type="button"
            role="tab"
            id="provider-tab-listings"
            aria-selected={activeTab === 'listings'}
            aria-controls="provider-panel-listings"
            className={activeTab === 'listings' ? 'active' : ''}
            onClick={() => showTab('listings')}
          >
            Your listings <span className="provider-tab-count">{providerProducts.length}</span>
          </button>
        </div>

        {activeTab === 'add' && (
        <form className="card provider-listing-form provider-tab-panel" id="provider-panel-add" role="tabpanel" aria-labelledby="provider-tab-add" onSubmit={handleSubmit}>
          <div className="provider-form-heading">
            <div><div className="eyebrow">New listing</div><h2>Add your gear</h2></div>
            <span className="provider-form-step mono">01 / 01</span>
          </div>
          <div className="provider-form-layout">
            <div className="provider-form-fields">
              <div className="provider-form-grid">
                <div className="provider-form-section-label">Identity</div>
                <label className="field">Product name<input name="name" value={form.name} onChange={handleChange} required /></label>
                <label className="field">Category
                  <select name="category" value={selectedCategory} onChange={handleChange} required>
                    {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="provider-form-section-label">Rental terms</div>
                <label className="field">Daily rate<input name="price" value={form.price} onChange={handleChange} type="number" min="1" step="1" required /></label>
                <label className="field">Condition
                  <select name="condition" value={form.condition} onChange={handleChange}>
                    <option>Excellent</option><option>Good</option><option>Fair</option>
                  </select>
                </label>
                <div className="provider-form-section-label">Technical profile</div>
                <label className="field">Quantity (units)
                  <input
                    name="quantity"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max={MAX_QUANTITY}
                    step="1"
                    value={form.quantity}
                    onChange={handleChange}
                    onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })}
                   
                  />
                </label>
                <label className="field">Weight (kg)
                  <span className="provider-unit-input">
                    <input
                      name="weight"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max={MAX_WEIGHT_KG}
                      step="0.01"
                      value={form.weight}
                      onChange={handleChange}
                      onKeyDown={blockInvalidNumberKeys}
                     
                    />
                    <span className="mono" aria-hidden="true">kg</span>
                  </span>
                </label>
                <div className="provider-form-section-label">Presentation</div>
                <div className="provider-image-source provider-form-wide">
                  <div className="field provider-photo-copy">
                    <span>Product photo</span>
                    <small className="provider-field-hint">Drag a clear photo of the actual gear here, or click to browse.</small>
                  </div>
                  <ImageDropzone
                    value={form.images}
                    onChange={handleImagesChange}
                    folder={`products/${user?.id || 'provider'}`}
                    maxFiles={6}
                    label="Drag photos here to upload"
                  />
                </div>
                <label className="field provider-form-wide">Description<textarea name="description" value={form.description} onChange={handleChange} rows="3" /></label>
              </div>
            </div>
            <aside className="provider-preview" aria-label="Listing preview">
              <div className="provider-preview-heading"><span className="eyebrow">Listing preview</span><span className="provider-preview-status">Draft</span></div>
              <div className="provider-preview-image">
                {form.images[0] ? <img src={form.images[0]} alt="" /> : <span>Image preview</span>}
                <span className="provider-preview-badge">Available</span>
              </div>
              <strong>{form.name || 'Your gear name'}</strong>
              <span className="mono">{form.price ? `${formatPeso(Number(form.price))} / day` : 'Set a daily rate'}</span>
              <p className="provider-preview-description">{form.description || 'Your gear description will appear here.'}</p>
              <div className="provider-preview-specs">
                <span><b>Quantity</b>{formatQuantity(form.quantity) || '—'}</span>
                <span><b>Weight</b>{formatWeight(form.weight) || '—'}</span>
                <span><b>Condition</b>{form.condition || '—'}</span>
              </div>
            </aside>
          </div>
          <div className="provider-form-actions"><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for review'}</button><span className="mono">An administrator reviews every listing before it appears in the public catalog.</span></div>
          {message && <p className="provider-message" role="status">{message}</p>}
        </form>
        )}

        {activeTab === 'listings' && (
        <section className="provider-listings provider-tab-panel" id="provider-panel-listings" role="tabpanel" aria-labelledby="provider-tab-listings">
          <div className="provider-section-heading"><div><span className="eyebrow">Your inventory</span><h2>Your listings</h2></div><span className="mono">{providerProducts.length} listing{providerProducts.length === 1 ? '' : 's'}</span></div>
          {providerProducts.length === 0 ? (
            <div className="card provider-listings-empty">
              <strong>No gear listed yet.</strong>
              <span>Add your first piece of gear and it will show up here.</span>
              <button type="button" className="btn btn-primary" onClick={() => showTab('add')}>Add gear</button>
            </div>
          ) : (
            <div className="provider-card-grid">
              {providerProducts.map((product) => (
                <ListingCard key={product.id} product={product} categoryName={getCategoryName(product.category)} onRemove={setRemoving} />
              ))}
            </div>
          )}
        </section>
        )}

        <ConfirmDialog
          open={Boolean(removing)}
          title="Remove this listing?"
          message={removing ? `"${removing.name}" will be taken off Gear Rent. This can't be undone.` : ''}
          confirmLabel="Remove"
          onConfirm={() => { removeProviderProduct(removing.id); setRemoving(null); }}
          onCancel={() => setRemoving(null)}
        />
      </main>
    </div>
  );
}
