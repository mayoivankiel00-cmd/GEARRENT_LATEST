import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useProviderCatalog } from '../context/ProviderContext';
import './AdminLayout.css';

const links = [
  { to: '/admin', label: 'Dashboard', icon: '▦', end: true },
  { to: '/admin/analytics', label: 'Analytics', icon: '📈' },
  { to: '/admin/history', label: 'Rental History', icon: '↺' },
  { to: '/admin/returns', label: 'Returns', icon: '⇄' },
  { to: '/admin/renters', label: 'Gear Renters', icon: '♙' },
  { to: '/admin/gear', label: 'Gear Inventory', icon: '▣' },
  { to: '/admin/categories', label: 'Categories', icon: '▤' },
  { to: '/admin/revenue', label: 'Revenue', icon: '↗' },
  { to: '/admin/users', label: 'New Users', icon: '♙' },
  { to: '/admin/utilization', label: 'Gear Utilization', icon: '◔' },
  { to: '/admin/approvals', label: 'Approvals', icon: '✓', badge: 'pending' },
  { to: '/admin/admins', label: 'Admin Accounts', icon: '⚿' },
];

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { pendingProducts } = useProviderCatalog();
  const {
    adminNotifications,
    adminUnreadCount,
    markAdminNotificationsRead,
    clearAdminNotifications,
  } = useNotifications();
  const [isLightTheme, setIsLightTheme] = useState(() => window.localStorage.getItem('gearRentTheme') === 'light');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = isLightTheme ? 'light' : 'dark';
    window.localStorage.setItem('gearRentTheme', isLightTheme ? 'light' : 'dark');
  }, [isLightTheme]);

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-brand">
          <div className="admin-logo">GEAR RENT</div>
          <span className="admin-brand-mark">OPS</span>
        </div>
        <div className="admin-topbar-context">
          <span className="eyebrow">Operations console</span>
          <strong>Rental network</strong>
        </div>
        <div className="admin-search">
          <span className="admin-search-icon">🔍</span>
          <input type="text" placeholder="Search equipment, orders, or users..." />
        </div>
        <div className="admin-topbar-actions">
          <div className="admin-notification-wrap">
            <button
              type="button"
              className="admin-icon-btn admin-notification-btn"
              aria-label={adminUnreadCount ? `${adminUnreadCount} unread notifications` : 'Notifications'}
              title="Notifications"
              onClick={() => {
                setNotificationsOpen((open) => !open);
                markAdminNotificationsRead();
              }}
            >
              <span className="admin-notification-glyph" aria-hidden="true" />
              {adminUnreadCount > 0 && <span className="admin-notif-dot" />}
            </button>
            {notificationsOpen && (
              <div className="admin-notification-panel" role="dialog" aria-label="Admin notifications">
                <div className="admin-notification-heading">
                  <strong>Notifications</strong>
                  <span className="mono">{adminNotifications.length}</span>
                  {adminNotifications.length > 0 && (
                    <button type="button" className="admin-notification-clear" onClick={clearAdminNotifications}>
                      Clear
                    </button>
                  )}
                </div>
                {adminNotifications.length === 0 ? <p className="admin-notification-empty">No notifications yet.</p> : (
                  <div className="admin-notification-list">
                    {adminNotifications.map((notification) => (
                      <div
                        className={`admin-notification-item ${notification.link ? 'is-link' : ''}`}
                        key={notification.id}
                        role={notification.link ? 'link' : undefined}
                        tabIndex={notification.link ? 0 : undefined}
                        onClick={() => {
                          if (!notification.link) return;
                          setNotificationsOpen(false);
                          navigate(notification.link);
                        }}
                        onKeyDown={(event) => {
                          if (notification.link && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            setNotificationsOpen(false);
                            navigate(notification.link);
                          }
                        }}
                      >
                        <span className={`admin-notification-dot ${notification.type}`} />
                        <div>
                          <p>{notification.message}</p>
                          <time dateTime={new Date(notification.createdAt).toISOString()}>
                            {new Date(notification.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                          </time>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="admin-icon-btn admin-theme-toggle"
            aria-label={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
            title={isLightTheme ? 'Switch to dark theme' : 'Switch to light theme'}
            onClick={() => setIsLightTheme((lightTheme) => !lightTheme)}
          >
            <span aria-hidden="true">{isLightTheme ? '☾' : '☀'}</span>
          </button>
        </div>
      </header>

      <div className="admin-body">
        <aside className="admin-sidebar">
          <div className="admin-sidebar-heading">
            <span className="eyebrow">Workspace</span>
            <strong>Administration</strong>
          </div>
          <nav className="admin-nav">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <span className="admin-nav-icon">{l.icon}</span> {l.label}
                {l.badge === 'pending' && pendingProducts.length > 0 && (
                  <span className="admin-nav-badge" aria-label={`${pendingProducts.length} awaiting review`}>{pendingProducts.length}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <button type="button" className="btn btn-primary btn-block admin-add-btn" onClick={() => navigate('/admin/gear/add')}><span aria-hidden="true">+</span> Add Equipment</button>

          <div className="admin-sidebar-divider" />
          <nav className="admin-nav">
            <a href="mailto:support@gearrent.ph">
              <span className="admin-nav-icon">📩</span> Support
            </a>
            {/* Revokes every session of this account and returns to sign-in. */}
            <button type="button" className="admin-nav-link" onClick={() => signOut()}>
              <span className="admin-nav-icon">⎋</span> Logout
            </button>
          </nav>
        </aside>

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
