import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { useCategories } from '../context/CategoryContext';
import { useProviderCatalog } from '../context/ProviderContext';
import ProductCard from '../components/ProductCard';
import Icon from '../components/Icon';
import AccountSidebar from '../components/AccountSidebar';
import useLoopingScroll from '../hooks/useLoopingScroll';
import { transitionName, withViewTransition } from '../lib/viewTransition';

const animateGrid = (update) => withViewTransition(update, { rootClass: 'catalog-filtering' });
import './Catalog.css';

export default function Catalog() {
  const productsPerPage = 12;
  const { catalogProducts } = useProviderCatalog();
  const { categories } = useCategories();
  const advertisingProducts = catalogProducts.slice(0, 8);
  const featuredProducts = advertisingProducts;
  const {
    trackRef: featuredTrackRef,
    loops: featuredLoops,
    loopStyle: featuredLoopStyle,
  } = useLoopingScroll(featuredProducts.length);
  const [advertisingSlide, setAdvertisingSlide] = useState(0);
  // The catalog can be empty (still loading, failed, or nothing approved) or
  // shrink below the current slide, so never index past the end.
  const adIndex = advertisingProducts.length ? advertisingSlide % advertisingProducts.length : 0;
  const adProduct = advertisingProducts[adIndex] || null;
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
  }, [catalogProducts, categories, checkedCategories, availableOnly, searchTerm]);

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
  }, [catalogProducts, categories, availableOnly, searchTerm]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / productsPerPage));
  const paginatedProducts = filtered.slice(
    (currentPage - 1) * productsPerPage,
    currentPage * productsPerPage
  );
  const firstVisibleProduct = filtered.length === 0 ? 0 : (currentPage - 1) * productsPerPage + 1;
  const lastVisibleProduct = Math.min(currentPage * productsPerPage, filtered.length);

  useEffect(() => {
    if (advertisingProducts.length === 0) return undefined;
    const advertisingTimer = window.setInterval(() => {
      setAdvertisingSlide((slide) => (slide + 1) % advertisingProducts.length);
    }, 5000);

    return () => window.clearInterval(advertisingTimer);
  }, [advertisingProducts.length]);

  const hasFilters = checkedCategories.length > 0 || !availableOnly || searchTerm.trim() !== '';

  // Filter and page changes animate the grid: cards that stay glide to their
  // new spot, others fade out or in (see .catalog-grid in Catalog.css).
  // Typing in search updates instantly so it never lags behind the keyboard.
  const clearFilters = () => animateGrid(() => {
    setCheckedCategories([]);
    setAvailableOnly(true);
    setSearchTerm('');
    setCurrentPage(1);
    setSearchParams({});
  });

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
        <div className="catalog-filters-header">
          <div className="eyebrow">Filters</div>
          {hasFilters && (
            <button type="button" className="catalog-clear-filters mono" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
        <div className="filter-group">
          <div className="filter-label mono">Category</div>
          {categories.map((cat) => (
            <label key={cat.id} className="filter-checkbox">
              <input
                type="checkbox"
                checked={checkedCategories.includes(cat.id)}
                onChange={() => animateGrid(() => {
                  toggleCategory(cat.id);
                  setCurrentPage(1);
                  setSearchParams(cat.id === activeCategory ? {} : { category: cat.id });
                })}
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
              onChange={() => animateGrid(() => {
                setAvailableOnly(true);
                setCurrentPage(1);
              })}
            />
            <span>Available Now</span>
          </label>
          <label className="filter-checkbox">
            <input
              type="radio"
              name="status"
              checked={!availableOnly}
              onChange={() => animateGrid(() => {
                setAvailableOnly(false);
                setCurrentPage(1);
              })}
            />
            <span>Include Booked</span>
          </label>
        </div>
      </div>
      </div>

      <div className="catalog-results">
        {adProduct && (
        <section className="catalog-ad" aria-label="Featured product promotion">
          {/* Every slide image stays mounted so switching slides can crossfade. */}
          {advertisingProducts.map((product, index) => (
            <img
              key={product.id}
              className={`catalog-ad-image ${index === adIndex ? 'active' : ''}`}
              src={product.image}
              alt={index === adIndex ? product.name : ''}
              aria-hidden={index === adIndex ? undefined : 'true'}
            />
          ))}
          <div className="catalog-ad-overlay" />
          <div className="catalog-ad-copy" key={adProduct.id}>
            <div className="eyebrow">Available for rent</div>
            <h2 title={adProduct.name}>{adProduct.name}</h2>
            <p>{adProduct.blurb}</p>
            <Link to={`/product/${adProduct.id}`} className="btn btn-primary">
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
                  className={index === adIndex ? 'active' : ''}
                  onClick={() => setAdvertisingSlide(index)}
                  aria-label={`Show ${product.name}`}
                  aria-current={index === adIndex ? 'true' : undefined}
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
        )}

        <div className="catalog-results-header">
          <span className="mono">
            Showing {firstVisibleProduct}-{lastVisibleProduct} of {filtered.length} items
          </span>
          <label className="catalog-search">
            <span className="sr-only">Search products</span>
            <Icon name="search" className="catalog-search-icon" />
            <input
              type="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search gear by name or category..."
              aria-label="Search products"
              className={searchTerm.trim() ? 'has-search-term' : ''}
            />
          </label>
        </div>

        {filtered.length === 0 ? (
          <div className="card catalog-empty">
            <p>No gear matches these filters yet.</p>
            <p className="mono small">Try a different category or include booked items.</p>
            {hasFilters && (
              <button type="button" className="btn btn-outline" onClick={clearFilters}>Clear all filters</button>
            )}
          </div>
        ) : (
          <div className="catalog-grid">
            {paginatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} style={{ viewTransitionName: transitionName('catalog-card', p.id) }} />
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
                onClick={() => animateGrid(() => setCurrentPage(page))}
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
            className={`catalog-featured-track ${featuredLoops ? 'is-looping' : ''}`}
            ref={featuredTrackRef}
          >
            <div className="catalog-featured-rail" style={featuredLoopStyle}>
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} showActions={false} />
              ))}
              {/* Copy for the seamless loop, hidden from screen readers and tabbing. */}
              {featuredLoops && (
                <div className="catalog-featured-copy" aria-hidden="true" inert>
                  {featuredProducts.map((product) => (
                    <ProductCard key={product.id} product={product} showActions={false} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
