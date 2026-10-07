import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCategories } from '../context/CategoryContext';
import { useProviderCatalog } from '../context/ProviderContext';
import ProductCard from '../components/ProductCard';
import useLoopingScroll from '../hooks/useLoopingScroll';
import useReveal from '../hooks/useReveal';
import './Landing.css';

const heroSlides = [
  {
    image: 'https://www.adobe.com/in/creativecloud/photography/discover/media_10283a3764253f184668acd8a9807540c9746fe22.png?width=2000&format=webply&optimize=medium',
    alt: 'Photographer holding a camera at sunset',
    label: 'Capture the moment',
  },
  {
    image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=1200&q=85',
    alt: 'Professional camera equipment',
    label: 'Cameras for every shoot',
  },
  {
    image: 'https://waldo.pro/wp-content/uploads/2024/03/Lighting-Equipment-1-564x317.jpg',
    alt: 'Studio lighting equipment',
    label: 'Shape the light',
  },
  {
    image: 'https://images.unsplash.com/photo-1524678606370-a47ad25cb82a?auto=format&fit=crop&w=1200&q=85',
    alt: 'Audio recording equipment',
    label: 'Make it sound right',
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { categories } = useCategories();
  const { catalogProducts } = useProviderCatalog();
  const [activeSlide, setActiveSlide] = useState(0);
  const { trackRef: productsTrackRef, loops: productsLoop, loopStyle: productsLoopStyle } =
    useLoopingScroll(catalogProducts.length);
  const revealRef = useReveal([categories.length, catalogProducts.length > 0]);

  useEffect(() => {
    const slideTimer = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % heroSlides.length);
    }, 5000);

    return () => window.clearInterval(slideTimer);
  }, []);

  const showSlide = (slideIndex) => {
    setActiveSlide((slideIndex + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="landing" ref={revealRef}>
      <section className="container hero">
        <div className="hero-copy">
          <span className="hero-tag">Available Now</span>
          <h1>
            <span className="hero-line">Rent Pro Gear.</span>
            <span className="hero-line accent">Build Anything.</span>
          </h1>
          <p>
            Cavite's one-stop online catalog for cameras, camping gear, event supplies,
            lighting, and full production packages, from basic to pro, with crew on request.
          </p>
          <Link to="/signup" className="btn btn-primary hero-cta">
            Browse Catalog →
          </Link>
        </div>
        <div className="hero-media" aria-label="Featured equipment photos">
          <div className="hero-slides">
            {heroSlides.map((slide, index) => (
              <img
                key={slide.image}
                src={slide.image}
                alt={index === activeSlide ? slide.alt : ''}
                aria-hidden={index === activeSlide ? undefined : 'true'}
                className={index === activeSlide ? 'active' : ''}
              />
            ))}
          </div>
          <div className="hero-slide-caption" key={activeSlide}>{heroSlides[activeSlide].label}</div>
          <div className="hero-slide-controls">
            <button type="button" onClick={() => showSlide(activeSlide - 1)} aria-label="Previous photo">
              ←
            </button>
            <div className="hero-slide-dots" aria-label="Choose featured photo">
              {heroSlides.map((slide, index) => (
                <button
                  type="button"
                  key={slide.image}
                  className={index === activeSlide ? 'active' : ''}
                  onClick={() => showSlide(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-current={index === activeSlide ? 'true' : undefined}
                />
              ))}
            </div>
            <button type="button" onClick={() => showSlide(activeSlide + 1)} aria-label="Next photo">
              →
            </button>
          </div>
        </div>
      </section>

      <section className="container categories-section">
        <div className="categories-header reveal">
          <h2>Equipment Categories</h2>
          <Link to="/signup" className="mono view-all">
            View All Categories
          </Link>
        </div>

        <div className="categories-grid">
          {categories.map((cat, i) => (
            <Link
              to={isAuthenticated ? `/catalog?category=${cat.id}` : '/signup'}
              key={cat.id}
              className={`category-card reveal ${i === 0 ? 'span-2-rows' : ''}`}
              style={{ '--reveal-delay': `${Math.min(i, 6) * 70}ms` }}
            >
              <div className="category-card-media">
                <img src={cat.image} alt={`${cat.name} equipment`} loading="lazy" />
              </div>
              <div className="category-card-info">
                <h3>{cat.name}</h3>
                <p>{cat.tagline}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container products-section reveal">
        <div className="categories-header">
          <h2>Product Equipment</h2>
          <Link to="/signup" className="mono view-all">
            Browse Catalog
          </Link>
        </div>

        <div
          className={`home-products-grid ${productsLoop ? 'is-looping' : ''}`}
          ref={productsTrackRef}
        >
          <div className="home-products-rail" style={productsLoopStyle}>
            {catalogProducts.map((product) => (
              <ProductCard key={product.id} product={product} showActions={false} showStatus={false} />
            ))}
            {/* Copy for the seamless loop, hidden from screen readers and tabbing. */}
            {productsLoop && (
              <div className="home-products-copy" aria-hidden="true" inert>
                {catalogProducts.map((product) => (
                  <ProductCard key={product.id} product={product} showActions={false} showStatus={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
