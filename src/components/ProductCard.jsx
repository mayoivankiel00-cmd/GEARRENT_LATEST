import { Link, useNavigate } from 'react-router-dom';
import { formatPeso } from '../lib/pricing';
import './ProductCard.css';

export default function ProductCard({ product, featured = false, showActions = true, showStatus = true, style }) {
  const navigate = useNavigate();
  const isAvailable = product.status === 'available';

  return (
    <div className={`product-card ${featured ? 'featured' : ''}`} style={style}>
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
    </div>
  );
}
