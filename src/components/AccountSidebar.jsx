import { NavLink } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { isGearProvider } from '../providerAccess';
import './AccountSidebar.css';

const links = [
  { to: '/catalog', label: 'Home' },
  { to: '/cart', label: 'Your Cart' },
  { to: '/my-gears', label: 'My Gears' },
  { to: '/profile', label: 'My Profile' },
  { to: '/history', label: 'History' },
];

export default function AccountSidebar() {
  const { count, rentedItems } = useCart();
  const { user } = useAuth();
  const isProvider = isGearProvider(user);

  return (
    <aside className="account-sidebar">
      <div className="eyebrow sidebar-heading">Navigation</div>
      <nav className="sidebar-nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === '/catalog'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <span>{l.label}</span>
            {l.to === '/cart' && count > 0 && <span className="sidebar-cart-badge">{count}</span>}
            {l.to === '/my-gears' && rentedItems.length > 0 && <span className="sidebar-cart-badge">{rentedItems.length}</span>}
          </NavLink>
        ))}
        {isProvider && <NavLink to="/provider-gear" className={({ isActive }) => (isActive ? 'active' : '')}><span>Provider Gear</span></NavLink>}
      </nav>
    </aside>
  );
}
