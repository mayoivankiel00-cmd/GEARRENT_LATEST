import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <div className="footer-logo">GEAR RENT</div>
          <p className="footer-copy">© 2026 Gear Rent Industrial. All rights reserved.</p>
        </div>
        <div className="footer-links">
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/rental-agreement">Rental Agreement</Link>
          <Link to="/contact">Contact Us</Link>
          <Link to="/locations">Locations</Link>
        </div>
      </div>
    </footer>
  );
}
