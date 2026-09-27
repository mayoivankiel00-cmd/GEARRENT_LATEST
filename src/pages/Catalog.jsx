import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { categories } from '../mockData';
import { useProviderCatalog } from '../ProviderContext';
import ProductCard from '../components/ProductCard';
import AccountSidebar from '../components/AccountSidebar';
import './Catalog.css';

export default function Catalog() {
  const productsPerPage = 12;
  const { catalogProducts } = useProviderCatalog();
  const advertisingProducts = catalogProducts.slice(0, 8);
  const featuredTrackRef = useRef(null);
  const featuredPausedRef = useRef(false);
  const [advertisingSlide, setAdvertisingSlide] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get('category');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(1);

  const [checkedCategories, setCheckedCategories] = useState(
    activeCategory ? [activeCategory] : []
  );
  const [availableOnly, setAvailableOnly] = useState(true);

  const toggleCategory = (id) => {
    setCheckedCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const filtered = useMemo(() => {
    return catalogProducts.filter((p) => {
      if (checkedCategories.length && !checkedCategories.includes(p.category)) return false;
      if (availableOnly && p.status !== 'available') return false;
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const categoryName = categories.find((category) => category.id === p.category)?.name || '';
        const searchableText = `${p.name} ${p.category} ${categoryName} ${p.blurb} ${p.description}`.toLowerCase();
        if (!searchableText.includes(query)) return false;
      }
      return true;
    });
  }, [catalogProducts, checkedCategories, availableOnly, searchTerm]);

  const categoryCounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return categories.reduce((counts, category) => {
      counts[category.id] = catalogProducts.filter((product) => {
        if (product.category !== category.id) return false;
        if (availableOnly && product.status !== 'available') return false;
        if (!query) return true;
        const categoryName = category.name;
        return `${product.name} ${product.category} ${categoryName} ${product.blurb} ${product.description}`
          .toLowerCase()
          .includes(query);
      }).length;
      return counts;
    }, {});
  }, [catalogProducts, availableOnly, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / productsPerPage));
  const paginatedProducts = filtered.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );
  const firstVisibleProduct = filtered.length === 0 ? 0 : (currentPage - 1) * productsPerPage + 1;
  const lastVisibleProduct = Math.min(currentPage * productsPerPage, filtered.length);

  useEffect(() => {
    const featuredTrack = featuredTrackRef.current;
    if (!featuredTrack) return undefined;

    const autoSlideTimer = window.setInterval(() => {
      if (featuredPausedRef.current) return;
      const firstProduct = featuredTrack.querySelector('.product-card');
      if (!firstProduct) return;
      const gap = Number.parseFloat(window.getComputedStyle(featuredTrack).gap) || 0;
      const productStep = firstProduct.getBoundingClientRect().width + gap;
      const reachedEnd = featuredTrack.scrollLeft + featuredTrack.clientWidth >= featuredTrack.scrollWidth - 2;

      featuredTrack.scrollTo({
        left: reachedEnd ? 0 : featuredTrack.scrollLeft + productStep,
        behavior: reachedEnd ? 'auto' : 'smooth',
      });
    }, 3500);

    return () => window.clearInterval(autoSlideTimer);
  }, []);

  useEffect(() => {
    const advertisingTimer = window.setInterval(() => {
      setAdvertisingSlide((slide) => (slide + 1) % advertisingProducts.length);
    }, 5000);

    return () => window.clearInterval(advertisingTimer);
  }, [advertisingProducts.length]);

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setSearchTerm(value);
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) nextParams.set('search', value);
    else nextParams.delete('search');
    setSearchParams(nextParams);
  };

  return (
    <div className="container catalog-page">
      <div className="catalog-sidebar">
        <AccountSidebar />
        <div className="catalog-filters card">
        <div className="eyebrow">Filters</div>
        <div className="filter-group">
          <div className="filter-label mono">Category</div>
          {categories.map((cat) => (
            <label key={cat.id} className="filter-checkbox">
              <input
                type="checkbox"
                checked={checkedCategories.includes(cat.id)}
                onChange={() => {
                  toggleCategory(cat.id);
                  setCurrentPage(1);
                  setSearchParams(cat.id === activeCategory ? {} : { category: cat.id });
                }}
              />
              <span>{cat.name}</span>
              <span className="filter-count mono">{categoryCounts[cat.id]}</span>
            </label>
          ))}
        </div>

        <div className="filter-group">
          <div className="filter-label mono">Status</div>
          <label className="filter-checkbox">
            <input
              type="radio"
              name="status"
              checked={availableOnly}
              onChange={() => {
                setAvailableOnly(true);
                setCurrentPage(1);
              }}
            />
            <span>Available Now</span>
          </label>
          <label className="filter-checkbox">
            <input
              type="radio"
              name="status"
              checked={!availableOnly}
              onChange={() => {
                setAvailableOnly(false);
                setCurrentPage(1);
              }}
            />
            <span>Include Booked</span>
          </label>
        </div>
      </div>
      </div>

      <div className="catalog-results">
        <section className="catalog-ad" aria-label="Featured product promotion">
          <img
            className="catalog-ad-image"
            src={advertisingProducts[advertisingSlide].image}
            alt={advertisingProducts[advertisingSlide].name}
          />
          <div className="catalog-ad-overlay" />
          <div className="catalog-ad-copy">
            <div className="eyebrow">Available for rent</div>
            <h2>{advertisingProducts[advertisingSlide].name}</h2>
            <p>{advertisingProducts[advertisingSlide].blurb}</p>
            <Link to={`/product/${advertisingProducts[advertisingSlide].id}`} className="btn btn-primary">
              View Product
            </Link>
          </div>
          <div className="catalog-ad-controls">
            <button
              type="button"
              onClick={() => setAdvertisingSlide((slide) => (slide - 1 + advertisingProducts.length) % advertisingProducts.length)}
              aria-label="Previous advertised product"
            >
              ←
            </button>
            <div className="catalog-ad-dots" aria-label="Choose advertised product">
              {advertisingProducts.map((product, index) => (
                <button
                  type="button"
                  key={product.id}
                  className={index === advertisingSlide ? 'active' : ''}
                  onClick={() => setAdvertisingSlide(index)}
                  aria-label={`Show ${product.name}`}
                  aria-current={index === advertisingSlide ? 'true' : undefined}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAdvertisingSlide((slide) => (slide + 1) % advertisingProducts.length)}
              aria-label="Next advertised product"
            >
              →
            </button>
          </div>
        </section>

        <div className="catalog-results-header">
          <span className="mono">
            Showing {firstVisibleProduct}-{lastVisibleProduct} of {filtered.length} items
          </span>
          <label className="catalog-search">
            <span className="sr-only">Search products</span>
            <input
              type="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search products..."
              aria-label="Search products"
              className={searchTerm.trim() ? 'has-search-term' : ''}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="card catalog-empty">
            <p>No gear matches these filters yet.</p>
            <p className="mono small">Try a different category or include booked items.</p>
          </div>
        ) : (
          <div className="catalog-grid">
            {paginatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        {filtered.length > productsPerPage && (
          <nav className="catalog-pagination" aria-label="Product pages">
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
              <button
                type="button"
                className={`catalog-page-number ${currentPage === page ? 'active' : ''}`}
                key={page}
                onClick={() => setCurrentPage(page)}
                aria-label={`Go to product page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
          </nav>
        )}

        <section className="catalog-featured" aria-label="More products">
          <div
            className="catalog-featured-track"
            ref={featuredTrackRef}
            onMouseEnter={() => { featuredPausedRef.current = true; }}
            onMouseLeave={() => { featuredPausedRef.current = false; }}
          >
            {catalogProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} showActions={false} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
