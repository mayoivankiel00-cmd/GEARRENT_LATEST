import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatPeso } from '../mockData';
import './ProductCard.css';

export default function ProductCard({ product, featured = false, showActions = true, showStatus = true }) {
  const navigate = useNavigate();
  const isAvailable = product.status === 'available';
  const productImages = product.images?.length ? product.images : [product.image];
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState(0);
  const [pointerPosition, setPointerPosition] = useState({ x: 0, y: 0 });
  const hoverTimer = useRef(null);

  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    if (!previewOpen || productImages.length < 2) return undefined;
    const carouselTimer = window.setInterval(() => {
      setPreviewImage((current) => (current + 1) % productImages.length);
    }, 2200);
    return () => window.clearInterval(carouselTimer);
  }, [previewOpen, productImages.length]);

  const handleMouseEnter = () => {
    window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setPreviewOpen(true), 1500);
  };

  const handleMouseMove = (event) => {
    const previewWidth = 320;
    const previewHeight = 280;
    const gap = 16;
    setPointerPosition({
      x: Math.min(event.clientX + gap, window.innerWidth - previewWidth - gap),
      y: Math.min(event.clientY + gap, window.innerHeight - previewHeight - gap),
    });
  };

  const handleMouseLeave = () => {
    window.clearTimeout(hoverTimer.current);
    setPreviewOpen(false);
    setPreviewImage(0);
  };

  return (
    <div
      className={`product-card ${featured ? 'featured' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <Link to={`/product/${product.id}`} className="product-card-media">
        <img src={product.image} alt={product.name} loading="lazy" />
        {showStatus && (
          <span className={`status-badge ${isAvailable ? 'status-available' : 'status-booked'}`}>
            {isAvailable ? 'Available' : 'Booked'}
          </span>
        )}
      </Link>

      <div className="product-card-body">
        <div className="product-card-top">
          <Link to={`/product/${product.id}`} className="product-card-name">
            {product.name}
          </Link>
          <div className="product-card-price">
            {formatPeso(product.price)}
            <span className="unit">/day</span>
          </div>
        </div>

        {featured && <p className="product-card-blurb">{product.blurb}</p>}
        {!featured && <p className="product-card-blurb small">{product.blurb}</p>}

        {showActions && isAvailable ? (
          <button
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/product/${product.id}`)}
          >
            Add to Cart
          </button>
        ) : showActions ? (
          <>
            {product.availableNext && (
              <p className="product-card-next">Available next: {product.availableNext}</p>
            )}
            <button className="btn btn-outline btn-block" disabled>
              Unavailable
            </button>
          </>
        ) : null}
      </div>

      {previewOpen && (
        <div
          className="product-hover-preview"
          role="dialog"
          aria-label={`${product.name} photo preview`}
          style={{ left: pointerPosition.x, top: pointerPosition.y }}
        >
          <div className="product-hover-preview-header">
            <span className="eyebrow">Photo preview</span>
            <span className="product-hover-preview-count mono">{previewImage + 1} / {productImages.length}</span>
          </div>
          <div className="product-hover-preview-image">
            <img src={productImages[previewImage]} alt={`${product.name} photo ${previewImage + 1}`} />
          </div>
          <div className="product-hover-preview-dots">
            {productImages.map((image, index) => (
              <button
                type="button"
                key={image}
                className={index === previewImage ? 'active' : ''}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setPreviewImage(index);
                }}
                aria-label={`View photo ${index + 1}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
