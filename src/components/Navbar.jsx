import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useNotifications } from '../context/NotificationContext';
import { membershipTiers } from '../lib/pricing';
import { getTierLevel, isGearProvider } from '../lib/providerAccess';
import useTheme from '../hooks/useTheme';
import ConfirmDialog from './ConfirmDialog';
import Icon from './Icon';
import './Navbar.css';

export default function Navbar() {
  const { count } = useCart();
  const { notifications, unreadCount, markAllRead, clearAllNotifications } = useNotifications();
  const { isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const { isLightTheme, toggleTheme } = useTheme();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);

  const userName = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Member';
  const userInitials = userName
    .split(' ')
    .map((namePart) => namePart[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const membership = membershipTiers[getTierLevel(user)];

  // signOut() revokes every session of this account and redirects to the
  // sign-in screen itself.
  const handleSignOut = () => {
    setConfirmingSignOut(false);
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
          {isAuthenticated && isGearProvider(user) && (
            <NavLink to="/provider-gear" className={({ isActive }) => (isActive ? 'active' : '')}>
              Provider Gear
            </NavLink>
          )}
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
          <div className="navbar-icons">
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
            <NavLink
              to="/cart"
              className={({ isActive }) => `navbar-cart ${isActive ? 'active' : ''}`}
              aria-label={count > 0 ? `Cart with ${count} item${count === 1 ? '' : 's'}` : 'Cart'}
              title="Cart"
            >
              <Icon name="cart" />
              {count > 0 && <span className="navbar-cart-badge" key={count} aria-hidden="true">{count > 99 ? '99+' : count}</span>}
            </NavLink>
            <button
              type="button"
              className="navbar-theme-toggle"
              aria-label={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
              title={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
              onClick={toggleTheme}
            >
              <Icon name={isLightTheme ? 'moon' : 'sun'} />
            </button>
          </div>

          <span className="navbar-divider" aria-hidden="true" />

          <div className="navbar-account">
            {isAuthenticated && (
              <Link to="/profile" className="navbar-user" aria-label={`View ${userName}'s profile`}>
                {user?.picture ? <img className="navbar-user-avatar" src={user.picture} alt="" /> : <span className="navbar-user-avatar" aria-hidden="true">{userInitials}</span>}
                <span className="navbar-user-name">{userName}</span>
              </Link>
            )}
            {isAuthenticated && (
              <Link
                to="/memberships"
                className={`navbar-tier navbar-tier-${membership.id}`}
                title={`${membership.name}: view memberships`}
                aria-label={`Membership: ${membership.name}`}
              >
                {membership.name.replace('Gear Rent ', '')}
              </Link>
            )}
            {isAuthenticated ? (
              <button
                type="button"
                className="btn btn-primary navbar-signout"
                onClick={() => {
                  setNotificationsOpen(false);
                  setConfirmingSignOut(true);
                }}
              >
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
      </div>
      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out?"
        message="You'll be signed out of Gear Rent on all your devices."
        confirmLabel="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setConfirmingSignOut(false)}
      />
    </header>
  );
}
