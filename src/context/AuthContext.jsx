import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AUTH_STORAGE_KEY,
  browserWasRestarted,
  clearSessionMarkers,
  isSessionRemembered,
  setRememberSession,
  supabase,
} from '../lib/supabaseClient';
import { isRateLimitError } from '../lib/rateLimit';
import { getTierLevel } from '../lib/providerAccess';
import { TIER_GUEST } from '../lib/pricing';

const AuthContext = createContext(null);
const PENDING_SIGNUP_KEY = 'gearRentPendingSignup';

// ---- Session policy -------------------------------------------------------
// How often the session is re-checked against the Supabase Auth server. A
// global sign-out elsewhere (another browser / device) is noticed within this
// window, or immediately when the tab regains focus.
const SESSION_CHECK_INTERVAL_MS = 60 * 1000;
// Sessions without "Maintain Session" end after this much inactivity.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_KEY = 'gearrent-last-activity';
const ACTIVITY_WRITE_THROTTLE_MS = 15 * 1000;
const AUTH_CHANNEL = 'gearrent-auth-events';

// Why the user ended up signed out — shown on the sign-in screen.
export const SIGN_OUT_REASONS = {
  manual: 'You have been signed out.',
  remote: 'You were signed out because this account signed out in another tab, browser or device.',
  expired: 'Your session has expired. Please sign in again.',
  idle: 'You were signed out after 30 minutes of inactivity.',
};

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function readPendingSignup() {
  try {
    return JSON.parse(window.sessionStorage.getItem(PENDING_SIGNUP_KEY) || 'null');
  } catch {
    return null;
  }
}

function mapProfileToUser(authUser, profile) {
  if (!authUser) return null;
  return {
    ...authUser,
    id: authUser.id,
    email: authUser.email,
    name: profile?.name || authUser.user_metadata?.name || '',
    picture: authUser.user_metadata?.avatar_url || '',
    tier: profile?.tier || TIER_GUEST,
    role: profile?.role || 'customer',
    balance: Number(profile?.balance) || 0,
    phone: profile?.phone || '',
    address: profile?.address || '',
    city: profile?.city || '',
    province: profile?.province || '',
    postalCode: profile?.postal_code || '',
    createdAt: profile?.created_at ? new Date(profile.created_at).getTime() : Date.now(),
  };
}

async function fetchProfile(userId) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.error('Failed to load profile', error);
    return null;
  }
  return data;
}

// A 401/403 (or a missing session) from the Auth server means the tokens are
// no longer valid — signed out elsewhere, user deleted/banned, refresh token
// revoked. Network errors (status 0 / undefined) are NOT treated as sign-out.
function isInvalidSessionError(error) {
  if (!error) return false;
  if (error.name === 'AuthSessionMissingError') return true;
  return error.status === 401 || error.status === 403;
}

// Drop anything user-specific the app keeps in browser storage.
function clearClientAuthState() {
  try {
    window.sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    window.localStorage.removeItem(ACTIVITY_KEY);
    // supabase-js already removes its own key; this also catches older keys
    // from before the custom storageKey (sb-<project>-auth-token).
    Object.keys(window.localStorage)
      .filter((key) => key === AUTH_STORAGE_KEY || key.startsWith(`${AUTH_STORAGE_KEY}-`) || /^sb-.*-auth-token/.test(key))
      .forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // storage unavailable — nothing to clear
  }
  clearSessionMarkers();
}

function openChannel() {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(AUTH_CHANNEL);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pendingSignup, setPendingSignupState] = useState(readPendingSignup);

  const userRef = useRef(null);
  const signingOutRef = useRef(false);
  const channelRef = useRef(null);
  const lastActivityWriteRef = useRef(0);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const loadUser = useCallback(async (authUser) => {
    if (!authUser) {
      setUser(null);
      setIsAuthenticated(false);
      return null;
    }
    const profile = await fetchProfile(authUser.id);
    const mapped = mapProfileToUser(authUser, profile);
    setUser(mapped);
    setIsAuthenticated(true);
    return mapped;
  }, []);

  // react-router's navigate() changes identity on every route change; keep it
  // in a ref so the auth effects below don't re-subscribe on navigation.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  // Clears React state only. Browser storage is cleared AFTER signOut(),
  // because supabase-js needs the stored access token to revoke the session
  // on the server.
  const resetLocalState = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    setPendingSignupState(null);
  }, []);

  // Single exit path for every kind of sign-out. `scope`:
  //   'global' — revoke every session of this account (all tabs, browsers,
  //              devices). Used for the Sign Out button.
  //   'local'  — only clear this browser (the session is already gone
  //              server-side, e.g. it was revoked elsewhere).
  const endSession = useCallback(async ({ scope = 'global', reason = 'manual', broadcast = true } = {}) => {
    if (signingOutRef.current) return;
    signingOutRef.current = true;
    const wasSignedIn = Boolean(userRef.current);

    // Clear UI state first so protected screens unmount immediately.
    resetLocalState();
    navigateRef.current('/signin', { replace: true, state: { signedOutReason: reason } });

    try {
      const { error } = await supabase.auth.signOut({ scope });
      if (error && scope !== 'local') {
        // Network failure etc. — still make sure nothing survives locally.
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    } finally {
      clearClientAuthState();
      if (broadcast && wasSignedIn) {
        channelRef.current?.postMessage({ type: 'signed-out', at: Date.now() });
      }
      signingOutRef.current = false;
    }
  }, [resetLocalState]);

  // Asks the Auth server whether the current tokens are still valid. getUser()
  // always makes a network round-trip (unlike getSession(), which only reads
  // local storage), so it catches sessions revoked from elsewhere.
  const validateSession = useCallback(async () => {
    if (signingOutRef.current) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      if (userRef.current) endSession({ scope: 'local', reason: 'remote', broadcast: false });
      return;
    }

    const { data, error } = await supabase.auth.getUser();
    if (isInvalidSessionError(error)) {
      endSession({ scope: 'local', reason: 'remote', broadcast: false });
      return;
    }
    if (error || !data?.user) return; // offline — try again later

    // Pick up role/tier changes (e.g. admin access granted or revoked)
    // without replacing the user object on every tick.
    const profile = await fetchProfile(data.user.id);
    const current = userRef.current;
    if (!profile || !current) return;
    if (profile.role !== current.role || profile.tier !== current.tier
      || profile.name !== current.name || Number(profile.balance) !== current.balance) {
      setUser(mapProfileToUser(data.user, profile));
    }
  }, [endSession]);

  // ---- Initial load + auth events ----------------------------------------
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && !isSessionRemembered() && browserWasRestarted()) {
        // "Maintain Session" was off and the browser has been closed since.
        await supabase.auth.signOut({ scope: 'local' });
        clearClientAuthState();
        if (isMounted) setLoading(false);
        return;
      }
      if (session) {
        const { data, error } = await supabase.auth.getUser();
        if (!isMounted) return;
        if (error && isInvalidSessionError(error)) {
          await supabase.auth.signOut({ scope: 'local' });
          clearClientAuthState();
        } else {
          await loadUser(data?.user || session.user);
        }
      }
      if (isMounted) setLoading(false);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Never await Supabase calls inside this callback (it holds the auth
      // lock) — defer to the next tick instead.
      window.setTimeout(() => {
        if (!isMounted) return;
        if (event === 'SIGNED_OUT' || !session) {
          if (userRef.current && !signingOutRef.current) {
            // Refresh token was revoked, or another tab signed out.
            endSession({ scope: 'local', reason: 'remote', broadcast: false });
          }
          return;
        }
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
          if (!userRef.current || userRef.current.id !== session.user.id || event === 'USER_UPDATED') {
            loadUser(session.user);
          }
        }
      }, 0);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [loadUser, endSession]);

  // ---- Cross-tab sign-out --------------------------------------------------
  useEffect(() => {
    const channel = openChannel();
    channelRef.current = channel;
    const onMessage = (event) => {
      if (event.data?.type === 'signed-out' && userRef.current) {
        endSession({ scope: 'local', reason: 'remote', broadcast: false });
      }
    };
    channel?.addEventListener('message', onMessage);

    // Fallback for browsers without BroadcastChannel: the shared session key
    // disappearing from localStorage means another tab signed out.
    const onStorage = (event) => {
      if (event.key === AUTH_STORAGE_KEY && !event.newValue && userRef.current) {
        endSession({ scope: 'local', reason: 'remote', broadcast: false });
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      channel?.removeEventListener('message', onMessage);
      channel?.close();
      channelRef.current = null;
      window.removeEventListener('storage', onStorage);
    };
  }, [endSession]);

  // ---- Periodic / on-focus validation + back-forward cache ----------------
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const interval = window.setInterval(validateSession, SESSION_CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') validateSession();
    };
    window.addEventListener('focus', validateSession);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', validateSession);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isAuthenticated, validateSession]);

  useEffect(() => {
    // A page restored from the back/forward cache is a frozen snapshot from
    // before sign-out. Re-check, and if there is no session reload so the
    // route guards run against the real (signed-out) state.
    const onPageShow = async (event) => {
      if (!event.persisted) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) window.location.replace('/signin');
      else validateSession();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [validateSession]);

  // ---- Idle timeout (only when "Maintain Session" is off) -----------------
  useEffect(() => {
    if (!isAuthenticated || isSessionRemembered()) return undefined;

    const markActive = () => {
      const now = Date.now();
      if (now - lastActivityWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return;
      lastActivityWriteRef.current = now;
      try {
        window.localStorage.setItem(ACTIVITY_KEY, String(now)); // shared by all tabs
      } catch {
        // ignore
      }
    };
    lastActivityWriteRef.current = 0;
    markActive();

    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    events.forEach((name) => window.addEventListener(name, markActive, { passive: true }));
    const timer = window.setInterval(() => {
      let last = Date.now();
      try {
        last = Number(window.localStorage.getItem(ACTIVITY_KEY)) || last;
      } catch {
        // ignore
      }
      if (Date.now() - last > IDLE_TIMEOUT_MS) {
        // Ends (and revokes server-side) this browser's session only; other
        // devices stay signed in. Other tabs follow via the broadcast.
        endSession({ scope: 'local', reason: 'idle' });
      }
    }, 30 * 1000);

    return () => {
      events.forEach((name) => window.removeEventListener(name, markActive));
      window.clearInterval(timer);
    };
  }, [isAuthenticated, endSession]);

  // ---- Public API ---------------------------------------------------------

  // Checks whether an account already exists for this email. Mainly useful
  // for inline validation — sign-up itself still relies on Supabase's own
  // "already registered" error as the source of truth.
  const accountExists = useCallback(async (email) => {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', normalizeEmail(email))
      .maybeSingle();
    return Boolean(data);
  }, []);

  // Returns { success, error, needsEmailConfirmation, rateLimited }.
  const createAccount = useCallback(async (userData) => {
    const email = normalizeEmail(userData.email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password: userData.password,
      options: { data: { name: userData.name } },
    });

    if (error) {
      return { success: false, error: error.message, rateLimited: isRateLimitError(error) };
    }

    // The `on_auth_user_created` trigger creates the profile row, and the
    // database always starts it on Gear Rent Guest. Paid tiers are bought
    // afterwards with purchaseMembership.

    if (data.session) {
      setRememberSession(true);
      await loadUser(data.user);
    }

    return { success: true, needsEmailConfirmation: !data.session };
  }, [loadUser]);

  // Returns { user, error, rateLimited, unconfirmed }.
  const signIn = useCallback(async (email, password, { remember = false } = {}) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error || !data.user) {
      const message = error?.message || '';
      return {
        user: null,
        error: message,
        rateLimited: isRateLimitError(error),
        unconfirmed: /confirm/i.test(message),
      };
    }

    setRememberSession(remember);
    const mapped = await loadUser(data.user);
    return { user: mapped, error: null };
  }, [loadUser]);

  // Backwards-compatible wrapper: returns the signed-in user or null.
  const authenticate = useCallback(async (email, password, options) => {
    const result = await signIn(email, password, options);
    return result.user;
  }, [signIn]);

  // Re-reads the signed-in user's profile (e.g. after a refund changed the
  // balance on the server).
  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const profile = await fetchProfile(session.user.id);
    if (!profile) return null;
    const mapped = mapProfileToUser(session.user, profile);
    setUser(mapped);
    return mapped;
  }, []);

  // Balance changes only happen in the database (checkout, refunds,
  // withdrawals). Returns { ok, error, balance }.
  const requestWithdrawal = useCallback(async (amount) => {
    const { data, error } = await supabase.rpc('request_withdrawal', { p_amount: Number(amount) });
    if (error) {
      return {
        ok: false,
        error: isRateLimitError(error)
          ? 'Too many transfer requests. Please wait a while and try again.'
          : error.message || 'The transfer could not be completed.',
      };
    }
    const balance = Number(data?.balance) || 0;
    setUser((prev) => (prev ? { ...prev, balance } : prev));
    return { ok: true, error: null, balance, amount: Number(data?.amount) || Number(amount) };
  }, []);

  // Paid tiers ('renter' / 'provider') can only be granted by the database
  // after the (still simulated) card payment. The database also decides the
  // price (₱199 instead of ₱699 when a Renter upgrades to Provider).
  // Returns { ok, error, tier, amount, periodEnd }.
  const purchaseMembership = useCallback(async (tierId, cardLast4) => {
    const { data, error } = await supabase.rpc('purchase_membership', {
      p_tier: tierId,
      p_card_last4: /^\d{4}$/.test(cardLast4 || '') ? cardLast4 : null,
    });
    if (error) {
      return {
        ok: false,
        error: isRateLimitError(error)
          ? 'Too many payment attempts. Please wait a while and try again.'
          : error.message || 'The payment could not be completed.',
      };
    }
    if (data?.tier) setUser((prev) => (prev ? { ...prev, tier: data.tier } : prev));
    return {
      ok: true,
      error: null,
      tier: data?.tier || null,
      amount: Number(data?.amount) || 0,
      periodEnd: data?.period_end || null,
    };
  }, []);

  // Signs out everywhere (all tabs, browsers and devices), invalidates the
  // refresh tokens server-side and redirects to the sign-in screen.
  const logout = useCallback(() => endSession({ scope: 'global', reason: 'manual' }), [endSession]);
  const signOut = logout;

  // Merges and persists partial updates to the signed-in user's own profile.
  // Applies the change to local state immediately (optimistic update) and
  // writes it to Supabase in the background. `balance`, `role` and the paid
  // tiers are not writable from here — the database rejects them (use
  // purchaseMembership). Moving down to Gear Rent Guest is allowed.
  const updateUser = useCallback(async (rawUpdates) => {
    const updates = { ...(rawUpdates || {}) };
    delete updates.balance;
    delete updates.role;
    if ('tier' in updates && getTierLevel(updates.tier) > 0) delete updates.tier;
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const patch = {};
    if ('name' in updates) patch.name = updates.name;
    if ('tier' in updates) patch.tier = updates.tier;
    if ('phone' in updates) patch.phone = updates.phone;
    if ('address' in updates) patch.address = updates.address;
    if ('city' in updates) patch.city = updates.city;
    if ('province' in updates) patch.province = updates.province;
    if ('postalCode' in updates) patch.postal_code = updates.postalCode;
    if (Object.keys(patch).length === 0) return;

    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    if (error) console.error('updateUser failed', error);
  }, []);

  // Stashes signup details while the user picks a membership tier, mirroring
  // the old sessionStorage handoff between SignUp and Memberships.
  const setPendingSignup = useCallback((data) => {
    window.sessionStorage.setItem(PENDING_SIGNUP_KEY, JSON.stringify(data));
    setPendingSignupState(data);
  }, []);

  const clearPendingSignup = useCallback(() => {
    window.sessionStorage.removeItem(PENDING_SIGNUP_KEY);
    setPendingSignupState(null);
  }, []);

  const value = {
    isAuthenticated,
    isAdmin: user?.role === 'admin',
    user,
    loading,
    pendingSignup,
    accountExists,
    createAccount,
    signIn,
    authenticate,
    logout,
    refreshProfile,
    requestWithdrawal,
    purchaseMembership,
    signOut,
    updateUser,
    setPendingSignup,
    clearPendingSignup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
