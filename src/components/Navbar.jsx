import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useCart } from '../CartContext';
import { useNotifications } from '../NotificationContext';
import './Navbar.css';

export default function Navbar() {
  const { count } = useCart();
  const { notifications, unreadCount, markAllRead, clearAllNotifications } = useNotifications();
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [isLightTheme, setIsLightTheme] = useState(() => window.localStorage.getItem('gearRentTheme') === 'light');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = isLightTheme ? 'light' : 'dark';
    window.localStorage.setItem('gearRentTheme', isLightTheme ? 'light' : 'dark');
  }, [isLightTheme]);

  const userName = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Member';
  const userInitials = userName
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // signOut() revokes every session of this account and redirects to the
  // sign-in screen itself.
  const handleSignOut = () => {
    setNotificationsOpen(false);
    signOut();
  };

  return (
    <header className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="navbar-logo">
          GEAR RENT
        </Link>

        <nav className="navbar-links">
          <NavLink to="/catalog" className={({ isActive }) => (isActive ? 'active' : '')}>
            Catalog
          </NavLink>
          <NavLink to="/memberships" className={({ isActive }) => (isActive ? 'active' : '')}>
            Memberships
          </NavLink>
          <NavLink to="/payment" className={({ isActive }) => (isActive ? 'active' : '')}>
            Payment
          </NavLink>
          <NavLink to="/support" className={({ isActive }) => (isActive ? 'active' : '')}>
            Support
          </NavLink>
        </nav>

        <div className="navbar-actions">
          <div className="navbar-notification-wrap">
            <button
              type="button"
              className="navbar-notification-toggle"
              aria-label={unreadCount ? `${unreadCount} unread notifications` : 'Notifications'}
              title="Notifications"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                markAllRead();
              }}
            >
              <span className="navbar-notification-glyph" aria-hidden="true" />
              {unreadCount > 0 && <span className="navbar-notification-ping" aria-hidden="true" />}
            </button>
            {notificationsOpen && (
              <div className="navbar-notification-panel" role="dialog" aria-label="Notifications">
                <div className="navbar-notification-heading">
                  <strong>Notifications</strong>
                  <span className="mono">{notifications.length}</span>
                  {notifications.length > 0 && (
                    <button type="button" className="navbar-notification-clear" onClick={clearAllNotifications}>
                      Remove all
                    </button>
                  )}
                </div>
                {notifications.length === 0 ? <p className="navbar-notification-empty">No notifications yet.</p> : (
                  <div className="navbar-notification-list">
                    {notifications.map((notification) => (
                      notification.link ? (
                        <button
                          type="button"
                          className="navbar-notification-item is-link"
                          key={notification.id}
                          onClick={() => { setNotificationsOpen(false); navigate(notification.link); }}
                        >
                          <span className={`navbar-notification-dot ${notification.type}`} /><p>{notification.message}</p>
                        </button>
                      ) : (
                        <div className="navbar-notification-item" key={notification.id}><span className={`navbar-notification-dot ${notification.type}`} /><p>{notification.message}</p></div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="navbar-theme-toggle"
            aria-label={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
            title={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={() => setIsLightTheme((lightTheme) => !lightTheme)}
          >
            <span aria-hidden="true">{isLightTheme ? '☾' : '☀'}</span>
          </button>
          {isAuthenticated && (
            <Link to="/profile" className="navbar-user" aria-label={`View ${userName}'s profile`}>
              {user?.picture ? <img className="navbar-user-avatar" src={user.picture} alt="" /> : <span className="navbar-user-avatar" aria-hidden="true">{userInitials}</span>}
              <span className="navbar-user-name">{userName}</span>
            </Link>
          )}
          <Link to="/cart" className="navbar-cart" aria-label={count > 0 ? `Cart with ${count} item${count === 1 ? '' : 's'}` : 'Cart'}>
            <span>Cart</span>
            {count > 0 && <span className="navbar-cart-badge" aria-label={`${count} item${count === 1 ? '' : 's'}`}>{count}</span>}
          </Link>
          {isAuthenticated ? (
            <button type="button" className="navbar-signout" onClick={handleSignOut}>
              Sign Out
            </button>
          ) : (
            <>
              <Link to="/signin" className="navbar-login">
                Log In
              </Link>
              <Link to="/signup" className="btn btn-primary">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
