import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
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
import AdminAdmins from './admin/AdminAdmins';
import { isGearProvider } from './providerAccess';
import ToastStack from './components/ToastStack';

function SiteLayout({ children }) {
  return (
    <>
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>{children}</main>
      <Footer />
    </>
  );
}

function AuthGate() {
  return <div className="auth-gate" role="status" aria-live="polite">Checking your session…</div>;
}

// Everything behind sign-in. While the session is still being verified we
// render nothing sensitive; once signed out, every protected URL (including
// ones reached with the browser's Back button) bounces to the sign-in screen.
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AuthGate />;
  if (!isAuthenticated) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }
  return children;
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
function GuestRoute({ children }) {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthGate />;
  if (isAuthenticated) {
    const from = typeof location.state?.from === 'string' && location.state.from.startsWith('/')
      && !location.state.from.startsWith('//') ? location.state.from : null;
    return <Navigate to={from || (user?.role === 'admin' ? '/admin' : '/catalog')} replace />;
  }
  return children;
}

export default function App() {
  return (
    <>
    <ToastStack />
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
      <Route path="/admin/admins" element={<AdminRoute><AdminAdmins /></AdminRoute>} />

      {/* Customer-facing routes use the shared site navbar/footer */}
      <Route
        path="*"
        element={
          <SiteLayout>
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
            </Routes>
          </SiteLayout>
        }
      />
    </Routes>
    </>
  );
}
