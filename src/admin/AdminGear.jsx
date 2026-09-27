import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { categories, formatPeso } from '../mockData';
import { useProviderCatalog } from '../ProviderContext';
import AdminLayout from './AdminLayout';
import './AdminGear.css';

export default function AdminGear() {
  const { catalogProducts } = useProviderCatalog();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const availableGear = useMemo(() => catalogProducts.filter((product) => product.status === 'available'), [catalogProducts]);
  const filteredGear = useMemo(() => availableGear.filter((product) => {
    const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query || `${product.name} ${product.description} ${product.blurb}`.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  }), [availableGear, categoryFilter, searchTerm]);

  return (
    <AdminLayout>
      <div className="admin-gear-heading">
        <div>
          <Link to="/admin" className="mono admin-gear-back">← Dashboard</Link>
          <h1 className="admin-title">Gear <span className="accent">Inventory</span></h1>
          <p className="admin-gear-subtitle">Available products currently visible to Gear Rent customers.</p>
        </div>
        <div className="admin-gear-count mono">{availableGear.length} available item{availableGear.length === 1 ? '' : 's'}</div>
      </div>

      <div className="card admin-gear-toolbar">
        <label>
          <span className="mono">Search inventory</span>
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Product name or description" />
        </label>
        <label>
          <span className="mono">Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="all">All categories</option>
            {categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
          </select>
        </label>
      </div>

      <div className="admin-gear-grid">
        {filteredGear.map((product) => {
          const category = categories.find((item) => item.id === product.category);
          return (
            <article className="card admin-gear-card" key={product.id}>
              <div className="admin-gear-image-wrap">
                <img src={product.images?.[0] || product.image} alt={product.name} loading="lazy" />
                <span className="admin-gear-status">Available</span>
              </div>
              <div className="admin-gear-content">
                <div className="admin-gear-card-top">
                  <span className="eyebrow">{category?.name || 'Gear'}</span>
                  <strong>{formatPeso(Number(product.price) || 0)} <small>/ day</small></strong>
                </div>
                <h2>{product.name}</h2>
                <p>{product.description || product.blurb}</p>
                <div className="admin-gear-specs">
                  {Object.entries(product.specs || {}).slice(0, 3).map(([label, value]) => <span key={label}><b>{label}</b>{value}</span>)}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {filteredGear.length === 0 && <div className="card admin-gear-empty">No available gear matches these filters.</div>}
    </AdminLayout>
  );
}