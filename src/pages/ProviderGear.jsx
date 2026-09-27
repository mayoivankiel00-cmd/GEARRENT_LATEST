import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { categories, formatPeso } from '../mockData';
import { useProviderCatalog } from '../ProviderContext';
import { useNotifications } from '../NotificationContext';
import { useAuth } from '../AuthContext';
import AccountSidebar from '../components/AccountSidebar';
import ImageDropzone from '../components/ImageDropzone';
import './ProviderGear.css';

const approvalLabels = {
  pending: { text: 'In review', cls: 'pending' },
  approved: { text: 'Live', cls: 'approved' },
  rejected: { text: 'Not approved', cls: 'rejected' },
};

const initialForm = {
  name: '',
  category: categories[0].id,
  price: '',
  condition: 'Good',
  capacity: '',
  weight: '',
  sensor: '',
  images: [],
  description: '',
};

export default function ProviderGear() {
  const navigate = useNavigate();
  const { providerProducts, addProviderProduct, removeProviderProduct } = useProviderCatalog();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
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
    setSubmitting(true);
    const { product, error } = await addProviderProduct({
      ...form,
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

        <form className="card provider-listing-form" onSubmit={handleSubmit}>
          <div className="provider-form-heading">
            <div><div className="eyebrow">New listing</div><h2>Add your gear</h2></div>
            <span className="provider-form-step mono">01 / 01</span>
          </div>
          <div className="provider-form-layout">
            <div className="provider-form-fields">
              <div className="provider-form-grid">
                <div className="provider-form-section-label">Identity</div>
                <label className="field">Product name<input name="name" value={form.name} onChange={handleChange} placeholder="Sony FX3 Cinema Camera" required /></label>
                <label className="field">Category
                  <select name="category" value={form.category} onChange={handleChange}>
                    {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="provider-form-section-label">Rental terms</div>
                <label className="field">Daily rate<input name="price" value={form.price} onChange={handleChange} type="number" min="1" step="1" placeholder="2500" required /></label>
                <label className="field">Condition
                  <select name="condition" value={form.condition} onChange={handleChange}>
                    <option>Excellent</option><option>Good</option><option>Fair</option>
                  </select>
                </label>
                <div className="provider-form-section-label">Technical profile</div>
                <label className="field">Capacity<input name="capacity" value={form.capacity} onChange={handleChange} placeholder="1 operator" /></label>
                <label className="field">Weight<input name="weight" value={form.weight} onChange={handleChange} placeholder="2.1 lbs" /></label>
                <label className="field provider-form-wide">Sensor<input name="sensor" value={form.sensor} onChange={handleChange} placeholder="Full-frame CMOS" /></label>
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
                <label className="field provider-form-wide">Description<textarea name="description" value={form.description} onChange={handleChange} rows="3" placeholder="Tell renters what makes this gear useful." /></label>
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
                <span><b>Capacity</b>{form.capacity || '—'}</span>
                <span><b>Weight</b>{form.weight || '—'}</span>
                <span><b>Sensor</b>{form.sensor || '—'}</span>
              </div>
            </aside>
          </div>
          <div className="provider-form-actions"><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit for review'}</button><span className="mono">An administrator reviews every listing before it appears in the public catalog.</span></div>
          {message && <p className="provider-message" role="status">{message}</p>}
        </form>

        <section className="provider-listings" aria-labelledby="provider-listings-heading">
          <div className="provider-section-heading"><div><span className="eyebrow">Your inventory</span><h2 id="provider-listings-heading">Your listings</h2></div><span className="mono">{providerProducts.length} listings</span></div>
          {providerProducts.length === 0 ? <p className="empty-state">No provider gear listed yet.</p> : (
            <div className="provider-listing-list">
              {providerProducts.map((product) => {
                const approval = approvalLabels[product.approvalStatus] || approvalLabels.pending;
                const isLive = product.approvalStatus === 'approved';
                const openListing = () => { if (isLive) navigate(`/product/${product.id}`); };
                return (
                <article
                  className={`card provider-listing-row ${isLive ? '' : 'is-unpublished'}`}
                  key={product.id}
                  role={isLive ? 'link' : undefined}
                  tabIndex={isLive ? 0 : undefined}
                  onClick={openListing}
                  onKeyDown={(event) => {
                    if (isLive && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      openListing();
                    }
                  }}
                >
                  <div className="provider-listing-image"><img src={product.images[0]} alt={product.name} /><span className={`provider-approval ${approval.cls}`}>{approval.text}</span></div>
                  <div className="provider-listing-copy">
                    <div className="provider-listing-head"><h3>{product.name}</h3><span className="provider-listing-category">{categories.find((category) => category.id === product.category)?.name || 'Gear'}</span></div>
                    <strong className="provider-listing-price">{formatPeso(product.price)} <span>/ day</span></strong>
                    <div className="provider-listing-specs">
                      {['capacity', 'weight', 'sensor'].map((spec) => product.specs?.[spec[0].toUpperCase() + spec.slice(1)] && (
                        <span key={spec}>{product.specs[spec[0].toUpperCase() + spec.slice(1)]}</span>
                      ))}
                    </div>
                    <p>{product.description || 'No description added.'}</p>
                    {product.approvalStatus === 'pending' && <p className="provider-review-note mono">Waiting for administrator approval — not visible to renters yet.</p>}
                    {product.approvalStatus === 'rejected' && <p className="provider-review-note rejected"><b>Reviewer note:</b> {product.reviewNote || 'No reason given.'} Remove this listing and submit a corrected one.</p>}
                  </div>
                  <button type="button" className="provider-delete" onClick={(event) => { event.stopPropagation(); removeProviderProduct(product.id); }} aria-label={`Remove ${product.name}`} title="Remove listing">🗑</button>
                </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
