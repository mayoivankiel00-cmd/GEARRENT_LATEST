import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPeso } from '../lib/pricing';
import { useCategories } from '../context/CategoryContext';
import { useProviderCatalog } from '../context/ProviderContext';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import ImageDropzone from '../components/ImageDropzone';
import {
  blockInvalidNumberKeys, formatQuantity, formatWeight, MAX_QUANTITY, MAX_WEIGHT_KG, validateGearSpecs,
} from '../lib/gearSpecs';
import AdminLayout from './AdminLayout';
import './AdminAddEquipment.css';

const initialForm = {
  name: '', category: '', price: '', condition: 'Good', // empty category = first in the list
  quantity: '', weight: '', sensor: '', images: [], description: '',
};

export default function AdminAddEquipment() {
  const navigate = useNavigate();
  const { addProviderProduct } = useProviderCatalog();
  const { addNotification } = useNotifications();
  const { user } = useAuth();
  const { categories, getCategoryName } = useCategories();
  const [form, setForm] = useState(initialForm);
  const selectedCategory = form.category || categories[0]?.id || '';
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateField = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  const updateImages = (images) => setForm((current) => ({ ...current, images }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.images.length) {
      setMessage('Drag in at least one product photo before publishing.');
      return;
    }
    if (submitting) return;
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
      setMessage(error || 'Something went wrong publishing this listing. Please try again.');
      return;
    }
    addNotification(`${product.name} was added to the public catalog.`, 'success');
    setMessage('Equipment added. It is now visible in Gear Inventory and the catalog.');
    setForm(initialForm);
  };

  return (
    <AdminLayout>
      <Link to="/admin/gear" className="mono admin-add-equipment-back">← Back to Gear Inventory</Link>
      <div className="admin-add-equipment-heading">
        <div><span className="mono admin-page-kicker">Inventory control</span><h1 className="admin-title">Add <span className="accent">Equipment</span></h1><p>Create a new product listing for the Gear Rent catalog.</p></div>
      </div>

      <form className="card admin-equipment-form" onSubmit={handleSubmit}>
        <div className="admin-equipment-workspace">
          <div className="admin-equipment-fields">
            <div className="admin-equipment-form-section"><span className="mono">01 / Identity</span><div className="admin-equipment-grid"><label>Product name<input name="name" value={form.name} onChange={updateField} required /></label><label>Category<select name="category" value={selectedCategory} onChange={updateField} required>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label></div></div>
            <div className="admin-equipment-form-section"><span className="mono">02 / Rental terms</span><div className="admin-equipment-grid"><label>Daily rate<input name="price" type="number" min="1" step="1" value={form.price} onChange={updateField} required /></label><label>Condition<select name="condition" value={form.condition} onChange={updateField}><option>Excellent</option><option>Good</option><option>Fair</option></select></label></div></div>
            <div className="admin-equipment-form-section"><span className="mono">03 / Equipment details</span><div className="admin-equipment-grid"><label>Quantity (units)<input name="quantity" type="number" inputMode="numeric" min="1" max={MAX_QUANTITY} step="1" value={form.quantity} onChange={updateField} onKeyDown={(event) => blockInvalidNumberKeys(event, { allowDecimal: false })} /></label><label>Weight (kg)<input name="weight" type="number" inputMode="decimal" min="0.01" max={MAX_WEIGHT_KG} step="0.01" value={form.weight} onChange={updateField} onKeyDown={blockInvalidNumberKeys} /></label><label>Sensor / output<input name="sensor" value={form.sensor} onChange={updateField} /></label></div></div>
            <div className="admin-equipment-form-section"><span className="mono">04 / Presentation</span><div className="admin-equipment-grid"><div className="admin-equipment-wide"><span className="admin-equipment-image-label">Product photos</span><ImageDropzone value={form.images} onChange={updateImages} folder={`products/${user?.id || 'admin'}`} maxFiles={8} label="Drag photos here to upload" /></div><label className="admin-equipment-wide">Description<textarea name="description" rows="5" value={form.description} onChange={updateField} required /></label></div></div>
          </div>
          <aside className="admin-add-equipment-preview" aria-label="Live equipment preview">
            <div className="admin-preview-heading"><span className="eyebrow">Live preview</span><span className="admin-preview-status">Available</span></div>
            <div className="admin-preview-image">{form.images[0] ? <img src={form.images[0]} alt="Equipment preview" /> : <span>Product image preview</span>}</div>
            <span className="admin-preview-category">{getCategoryName(selectedCategory)}</span>
            <strong>{form.name || 'Equipment name'}</strong>
            <span className="mono admin-preview-price">{form.price ? `${formatPeso(Number(form.price))} / day` : 'Set daily rate'}</span>
            <p>{form.description || 'Your equipment description will appear here.'}</p>
            <div className="admin-preview-specs"><span><b>Quantity</b>{formatQuantity(form.quantity) || '—'}</span><span><b>Weight</b>{formatWeight(form.weight) || '—'}</span><span><b>Condition</b>{form.condition || '—'}</span></div>
          </aside>
        </div>
        <div className="admin-equipment-actions"><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Publishing…' : 'Publish Equipment'}</button><button type="button" className="btn btn-outline" onClick={() => navigate('/admin/gear')}>Cancel</button>{message && <span className="admin-equipment-message" role="status">{message}</span>}</div>
      </form>
    </AdminLayout>
  );
}