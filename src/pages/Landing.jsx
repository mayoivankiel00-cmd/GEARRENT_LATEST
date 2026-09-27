import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { categories } from '../mockData';
import { useProviderCatalog } from '../ProviderContext';
import ProductCard from '../components/ProductCard';
import './Landing.css';

const heroSlides = [
  {
    image: 'https://www.adobe.com/in/creativecloud/photography/discover/media_10283a3764253f184668acd8a9807540c9746fe22.png?width=2000&format=webply&optimize=medium',
    alt: 'Photographer holding a camera at sunset',
    label: 'Capture the moment',
  },
  {
    image: categories[0].image,
    alt: 'Professional camera equipment',
    label: 'Cameras for every shoot',
  },
  {
    image: categories[1].image,
    alt: 'Studio lighting equipment',
    label: 'Shape the light',
  },
  {
    image: categories[2].image,
    alt: 'Audio recording equipment',
    label: 'Make it sound right',
  },
];

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const { catalogProducts } = useProviderCatalog();
  const [activeSlide, setActiveSlide] = useState(0);
  const productsTrackRef = useRef(null);
  const productsPausedRef = useRef(false);

  useEffect(() => {
    const slideTimer = window.setInterval(() => {
      setActiveSlide((currentSlide) => (currentSlide + 1) % heroSlides.length);
    }, 5000);

    return () => window.clearInterval(slideTimer);
  }, []);

  useEffect(() => {
    const productsTrack = productsTrackRef.current;
    if (!productsTrack) return undefined;

    const autoSlideTimer = window.setInterval(() => {
      if (productsPausedRef.current) return;

      const firstProduct = productsTrack.querySelector('.product-card');
      if (!firstProduct) return;

      const gap = Number.parseFloat(window.getComputedStyle(productsTrack).gap) || 0;
      const productStep = firstProduct.getBoundingClientRect().width + gap;
      const reachedEnd = productsTrack.scrollLeft + productsTrack.clientWidth >= productsTrack.scrollWidth - 2;

      productsTrack.scrollTo({
        left: reachedEnd ? 0 : productsTrack.scrollLeft + productStep,
        behavior: reachedEnd ? 'auto' : 'smooth',
      });
    }, 3000);

    return () => window.clearInterval(autoSlideTimer);
  }, []);

  const showSlide = (slideIndex) => {
    setActiveSlide((slideIndex + heroSlides.length) % heroSlides.length);
  };

  return (
    <div className="landing">
      <section className="container hero">
        <div className="hero-copy">
          <span className="hero-tag">Available Now</span>
          <h1>
            Rent Pro Gear.
            <br />
            <span className="accent">Build Anything.</span>
          </h1>
          <p>
            Cavite's one-stop online catalog for cameras, camping gear, event supplies,
            lighting, and full production packages — basic to pro, with crew on request.
          </p>
          <Link to="/signup" className="btn btn-primary hero-cta">
            Browse Catalog →
          </Link>
        </div>
        <div className="hero-media" aria-label="Featured equipment photos">
          <div className="hero-slides" style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
            {heroSlides.map((slide) => (
              <img key={slide.image} src={slide.image} alt={slide.alt} />
            ))}
          </div>
          <div className="hero-slide-caption">{heroSlides[activeSlide].label}</div>
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
        <div className="categories-header">
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
              className={`category-card ${i === 0 ? 'span-2-rows' : ''}`}
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

      <section className="container products-section">
        <div className="categories-header">
          <h2>Product Equipment</h2>
          <Link to="/signup" className="mono view-all">
            Browse Catalog
          </Link>
        </div>

        <div
          className="home-products-grid"
          ref={productsTrackRef}
          onMouseEnter={() => { productsPausedRef.current = true; }}
          onMouseLeave={() => { productsPausedRef.current = false; }}
        >
          {catalogProducts.map((product) => (
            <ProductCard key={product.id} product={product} showActions={false} showStatus={false} />
          ))}
        </div>
      </section>
    </div>
  );
}
