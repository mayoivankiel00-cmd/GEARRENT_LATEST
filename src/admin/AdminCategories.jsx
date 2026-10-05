import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoryContext';
import ImageDropzone from '../components/ImageDropzone';
import AdminLayout from './AdminLayout';
import './AdminMetricPages.css';
import './AdminModeration.css';

const EMPTY_FORM = { id: '', name: '', tagline: '', image: '', sortOrder: '' };

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Shared by "add" and "edit". The id is only editable when adding, because
// products refer to it.
function CategoryForm({ initial, isNew, onSave, onCancel }) {
  const { user } = useAuth();
  const [form, setForm] = useState(initial);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field, value) => setForm((current) => {
    const next = { ...current, [field]: value };
    if (field === 'name' && isNew && !idTouched) next.id = slugify(value);
    return next;
  });

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Give the category a name.');
      return;
    }
    if (isNew && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.id)) {
      setError('The id may only use lowercase letters, numbers and dashes.');
      return;
    }
    setBusy(true);
    setError('');
    const result = await onSave({ ...form, name: form.name.trim(), tagline: form.tagline.trim() });
    setBusy(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <form className="card moderation-panel" onSubmit={submit}>
      <div className="moderation-grid">
        <label className="moderation-field">Name
          <input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Drones" maxLength={60} required />
        </label>
        <label className="moderation-field">Id (used in links)
          <input
            value={form.id}
            onChange={(event) => { setIdTouched(true); update('id', event.target.value); }}
            placeholder="drones"
            disabled={!isNew}
            maxLength={40}
          />
        </label>
        <label className="moderation-field">Tagline
          <input value={form.tagline} onChange={(event) => update('tagline', event.target.value)} placeholder="Aerial cameras & controllers" maxLength={80} />
        </label>
        <label className="moderation-field">Sort order (lower shows first)
          <input type="number" step="1" value={form.sortOrder} onChange={(event) => update('sortOrder', event.target.value)} placeholder="0" />
        </label>
      </div>
      <div>
        <span className="moderation-field">Cover image</span>
        <ImageDropzone
          value={form.image ? [form.image] : []}
          onChange={(images) => update('image', images[0] || '')}
          folder={`products/${user?.id || 'admin'}`}
          maxFiles={1}
          label="Drag a cover photo here"
        />
      </div>
      {error && <p className="moderation-status error" role="alert">{error}</p>}
      <div className="moderation-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : isNew ? 'Add category' : 'Save changes'}</button>
        {onCancel && <button type="button" className="btn btn-outline" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

export default function AdminCategories() {
  const { categories, loading, saveCategory, deleteCategory } = useCategories();
  const [productCounts, setProductCounts] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [status, setStatus] = useState({ type: '', text: '' });

  // Admins can read every product (pending and rejected too), so these counts
  // match what the delete guard in the database checks.
  const refreshCounts = useCallback(async () => {
    const { data, error } = await supabase.from('products').select('category_id');
    if (error) {
      console.error('Failed to count products per category', error);
      return;
    }
    setProductCounts((data || []).reduce((counts, row) => {
      counts[row.category_id] = (counts[row.category_id] || 0) + 1;
      return counts;
    }, {}));
  }, []);

  useEffect(() => {
    refreshCounts();
  }, [refreshCounts]);

  const handleAdd = async (form) => {
    const result = await saveCategory(form, { isNew: true });
    if (result.ok) {
      setAdding(false);
      setStatus({ type: 'success', text: `${form.name} was added. It now shows on the home page, catalog filters and listing forms.` });
    }
    return result;
  };

  const handleEdit = async (form) => {
    const result = await saveCategory(form);
    if (result.ok) {
      setEditingId(null);
      setStatus({ type: 'success', text: `${form.name} was updated.` });
    }
    return result;
  };

  const handleDelete = async (category) => {
    if (confirmDelete !== category.id) {
      setConfirmDelete(category.id);
      return;
    }
    setConfirmDelete(null);
    const result = await deleteCategory(category.id);
    setStatus(result.ok
      ? { type: 'success', text: `${category.name} was deleted.` }
      : { type: 'error', text: result.error });
    refreshCounts();
  };

  return (
    <AdminLayout>
      <div className="metric-page-heading">
        <div>
          <span className="mono metric-page-kicker">Catalog structure</span>
          <h1 className="admin-title">Gear <span className="accent">Categories</span></h1>
          <p>Categories appear on the home page, in the catalog filters and in every listing form.</p>
        </div>
        <strong className="metric-page-total">{categories.length}</strong>
      </div>

      {status.text && <p className={`moderation-status ${status.type} moderation-flash`} role="status">{status.text}</p>}

      <div className="review-toolbar">
        <span className="mono">{categories.length} categories · sorted by sort order</span>
        {!adding && <button type="button" className="btn btn-primary moderation-refresh" onClick={() => { setAdding(true); setStatus({ type: '', text: '' }); }}>+ New category</button>}
      </div>

      {adding && (
        <div className="category-admin-new">
          <CategoryForm initial={EMPTY_FORM} isNew onSave={handleAdd} onCancel={() => setAdding(false)} />
        </div>
      )}

      {loading && categories.length === 0 ? (
        <div className="card review-empty"><span>Loading…</span></div>
      ) : categories.length === 0 ? (
        <div className="card review-empty">
          <strong>No categories yet.</strong>
          <span>Run gearrent_categories_update.sql, or add one above.</span>
        </div>
      ) : (
        <div className="review-list">
          {categories.map((category) => {
            const count = productCounts[category.id] || 0;
            if (editingId === category.id) {
              return (
                <CategoryForm
                  key={category.id}
                  initial={{ ...category, sortOrder: String(category.sortOrder) }}
                  isNew={false}
                  onSave={handleEdit}
                  onCancel={() => setEditingId(null)}
                />
              );
            }
            return (
              <article className="card category-admin-row" key={category.id}>
                <div className="category-admin-image">
                  {category.image ? <img src={category.image} alt="" /> : <span>No image</span>}
                </div>
                <div className="category-admin-copy">
                  <strong>{category.name}</strong>
                  <span className="mono">{category.id} · order {category.sortOrder}</span>
                  <p>{category.tagline || 'No tagline.'}</p>
                </div>
                <span className="mono category-admin-count">{count} product{count === 1 ? '' : 's'}</span>
                <div className="moderation-actions">
                  <button type="button" className="moderation-link-btn" onClick={() => { setEditingId(category.id); setStatus({ type: '', text: '' }); }}>Edit</button>
                  <button
                    type="button"
                    className={`moderation-link-btn ${confirmDelete === category.id ? 'danger' : ''}`}
                    disabled={count > 0}
                    title={count > 0 ? 'Move or remove its products first' : 'Delete category'}
                    onClick={() => handleDelete(category)}
                    onBlur={() => setConfirmDelete((current) => (current === category.id ? null : current))}
                  >
                    {confirmDelete === category.id ? 'Click again to delete' : 'Delete'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </AdminLayout>
  );
}
