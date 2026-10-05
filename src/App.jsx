import { useEffect, useRef } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useNotifications } from './context/NotificationContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import MyGears from './pages/MyGears';
import History from './pages/History';
import Memberships from './pages/Memberships';
import Support from './pages/Support';
import InfoPage from './pages/InfoPage';
import ProviderGear from './pages/ProviderGear';
import AdminDashboard from './admin/AdminDashboard';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminHistory from './admin/AdminHistory';
import AdminRenters from './admin/AdminRenters';
import AdminRenterDetails from './admin/AdminRenterDetails';
import AdminGear from './admin/AdminGear';
import AdminAddEquipment from './admin/AdminAddEquipment';
import AdminRevenue from './admin/AdminRevenue';
import AdminUsers from './admin/AdminUsers';
import AdminUtilization from './admin/AdminUtilization';
import AdminApprovals from './admin/AdminApprovals';
import AdminReturns from './admin/AdminReturns';
import AdminCategories from './admin/AdminCategories';
import AdminAdmins from './admin/AdminAdmins';
import { isGearProvider } from './lib/providerAccess';
import ToastStack from './components/ToastStack';
import ErrorBoundary from './components/ErrorBoundary';

function SiteLayout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
      <Footer />
    </>
  );
}

function NotFound() {
  return (
    <div className="container" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <div className="eyebrow">404</div>
      <h1 style={{ fontSize: '2rem', margin: '0.5rem 0 0.8rem' }}>Page not found</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>The page you were looking for doesn't exist or has moved.</p>
      <Link to="/" className="btn btn-primary">Back to home</Link>
    </div>
  );
}

function AuthGate() {
  return <div className="auth-gate" role="status" aria-live="polite">Checking your session…</div>;
}

// Everything behind sign-in. While the session is still being verified we
// render nothing sensitive; once signed out, every protected URL (including
// ones reached with the browser's Back button) bounces to the sign-in screen.
// Admin accounts don't rent gear, so they are kept in the dashboard.
function ProtectedRoute({ children }) {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthGate />;
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  if (isAdmin) return <Navigate to="/admin" replace />;
  return children;
}

// Tells the user when their role changes mid-session (granted or revoked by
// another admin). The route guards take care of moving them.
function RoleChangeNotice() {
  const { user } = useAuth();
  const { pushToast } = useNotifications();
  const previousRef = useRef(null);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = user ? { id: user.id, role: user.role } : null;
    if (!user || !previous || previous.id !== user.id || previous.role === user.role) return;

    if (user.role === 'admin') {
      pushToast({ id: `role-${Date.now()}`, type: 'success', message: 'You have been given admin access.', link: '/admin' });
    } else if (previous.role === 'admin') {
      pushToast({ id: `role-${Date.now()}`, type: 'warning', message: 'Your admin access was removed.' });
    }
  }, [user, pushToast]);

  return null;
}

function ProviderRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  if (loading) return <AuthGate />;
  return isAuthenticated && isGearProvider(user) ? children : <Navigate to="/profile" replace />;
}

function AdminRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthGate />;
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return user?.role === 'admin' ? children : <Navigate to="/profile" replace />;
}

// Sign-in / sign-up are for signed-out visitors only.
// After signing in, continue to the page the user originally asked for.
// Admins always land in the dashboard unless they were heading to an admin page.
function GuestRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthGate />;
  if (isAuthenticated) {
    const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
      && !location.state.from.startsWith('//') ? location.state.from : null;
    if (user?.role === 'admin') {
      return <Navigate to={from?.startsWith('/admin') ? from : '/admin'} replace />;
    }
    return <Navigate to={from || '/catalog'} replace />;
  }
  return children;
}

export default function App() {
  const { pathname, hash } = useLocation();

  // A new page starts at the top (e.g. footer links), unless the link points
  // at a section (#hash) — InfoPage scrolls to that itself.
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
    <ToastStack />
    <RoleChangeNotice />
    <ErrorBoundary resetKey={pathname}>
    <Routes>
      {/* Admin routes use their own sidebar/topbar layout */}
      <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
      <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
      <Route path="/admin/history" element={<AdminRoute><AdminHistory /></AdminRoute>} />
      <Route path="/admin/renters" element={<AdminRoute><AdminRenters /></AdminRoute>} />
      <Route path="/admin/renters/:email" element={<AdminRoute><AdminRenterDetails /></AdminRoute>} />
      <Route path="/admin/gear" element={<AdminRoute><AdminGear /></AdminRoute>} />
      <Route path="/admin/gear/add" element={<AdminRoute><AdminAddEquipment /></AdminRoute>} />
      <Route path="/admin/revenue" element={<AdminRoute><AdminRevenue /></AdminRoute>} />
      <Route path="/admin/users" element={<AdminRoute><AdminUsers /></AdminRoute>} />
      <Route path="/admin/utilization" element={<AdminRoute><AdminUtilization /></AdminRoute>} />
      <Route path="/admin/approvals" element={<AdminRoute><AdminApprovals /></AdminRoute>} />
      <Route path="/admin/returns" element={<AdminRoute><AdminReturns /></AdminRoute>} />
      <Route path="/admin/categories" element={<AdminRoute><AdminCategories /></AdminRoute>} />
      <Route path="/admin/admins" element={<AdminRoute><AdminAdmins /></AdminRoute>} />

      {/* Customer-facing routes use the shared site navbar/footer */}
      <Route
        path="*"
        element={
          <SiteLayout>
            {/* Inner boundary keeps the navbar/footer usable when a page crashes */}
            <ErrorBoundary resetKey={pathname}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
              <Route path="/product/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
              <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
              <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
              <Route path="/payment" element={<ProtectedRoute><Payment /></ProtectedRoute>} />
              <Route path="/signin" element={<GuestRoute><SignIn /></GuestRoute>} />
              <Route path="/signup" element={<GuestRoute><SignUp /></GuestRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/my-gears" element={<ProtectedRoute><MyGears /></ProtectedRoute>} />
              <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
              <Route path="/provider-gear" element={<ProtectedRoute><ProviderRoute><ProviderGear /></ProviderRoute></ProtectedRoute>} />
              <Route path="/memberships" element={<Memberships />} />
              <Route path="/support" element={<Support />} />
              <Route path="/privacy" element={<InfoPage type="privacy" />} />
              <Route path="/terms" element={<InfoPage type="terms" />} />
              <Route path="/rental-agreement" element={<InfoPage type="agreement" />} />
              <Route path="/contact" element={<InfoPage type="contact" />} />
              <Route path="/locations" element={<InfoPage type="locations" />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </ErrorBoundary>
          </SiteLayout>
        }
      />
    </Routes>
    </ErrorBoundary>
    </>
  );
}
