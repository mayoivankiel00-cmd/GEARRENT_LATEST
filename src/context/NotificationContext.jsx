import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);
// Kept only as an export for backward compatibility with any code that
// imported it — the admin channel is now a real `is_admin_channel` column
// instead of a sentinel recipient string.
export const ADMIN_NOTIFICATION_RECIPIENT = '__admin__';

const POLL_INTERVAL_MS = 15000;
// On first load after sign-in, only unread notifications this recent pop up
// as toasts (older ones just sit in the bell panel).
const INITIAL_TOAST_WINDOW_MS = 10 * 60 * 1000;
const MAX_TOASTS = 4;

// Rows created before the `link` column existed get a sensible destination.
function fallbackLink(row) {
  const message = row.message || '';
  if (row.is_admin_channel) {
    if (/awaiting review/i.test(message)) return '/admin/approvals';
    if (/overdue|has not returned/i.test(message)) return '/admin/history';
    return null;
  }
  if (/approved|not approved|was rejected/i.test(message)) return '/provider-gear';
  if (/due back|overdue/i.test(message)) return '/my-gears';
  return null;
}

function mapNotificationRow(row) {
  return {
    id: row.id,
    message: row.message,
    type: row.type,
    link: row.link || fallbackLink(row),
    recipientEmail: row.recipient_user_id ? null : null, // no longer tracked by email — see recipientUserId
    recipientUserId: row.recipient_user_id,
    isAdminChannel: row.is_admin_channel,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    read: row.read,
  };
}

export function NotificationProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const userId = user?.id || null;
  const isAdmin = user?.role === 'admin';
  const [notifications, setNotifications] = useState([]);
  const [adminNotifications, setAdminNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);

  // Notification ids already seen in this tab, per channel. `null` means no
  // baseline yet (first load after sign-in).
  const seenRef = useRef({ user: null, admin: null });

  useEffect(() => {
    seenRef.current = { user: null, admin: null };
    setToasts([]);
  }, [userId]);

  const pushToast = useCallback((toast) => {
    setToasts((current) => {
      if (current.some((item) => item.id === toast.id)) return current;
      return [...current, toast].slice(-MAX_TOASTS);
    });
  }, []);

  const dismissToast = useCallback((toastId) => {
    setToasts((current) => current.filter((item) => item.id !== toastId));
  }, []);

  // Pops up toasts for notifications that weren't there on the previous poll.
  // `silent` records them as seen without a toast — used right after the
  // user's own action, where the page already shows the result inline.
  const announce = useCallback((channel, rows, silent) => {
    const seen = seenRef.current[channel];
    const firstLoad = seen === null;
    const nextSeen = new Set(seen || []);
    const fresh = [];

    rows.forEach((row) => {
      if (nextSeen.has(row.id)) return;
      nextSeen.add(row.id);
      if (silent || row.read) return;
      if (firstLoad && Date.now() - row.createdAt > INITIAL_TOAST_WINDOW_MS) return;
      fresh.push(row);
    });

    seenRef.current[channel] = nextSeen;
    // Oldest first so the newest ends up on top of the stack.
    fresh.reverse().forEach((row) => pushToast({
      id: `${channel}-${row.id}`,
      message: row.message,
      type: row.type,
      link: row.link,
      audience: channel,
    }));
  }, [pushToast]);

  const refreshNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated || !userId) {
      setNotifications([]);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_admin_channel', false)
      .or(`recipient_user_id.eq.${userId},recipient_user_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      console.error('Failed to load notifications', error);
      return;
    }
    const rows = (data || []).map(mapNotificationRow);
    setNotifications(rows);
    announce('user', rows, silent);
  }, [isAuthenticated, userId, announce]);

  const refreshAdminNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!isAuthenticated || !isAdmin) {
      setAdminNotifications([]);
      return;
    }
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_admin_channel', true)
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      console.error('Failed to load admin notifications', error);
      return;
    }
    const rows = (data || []).map(mapNotificationRow);
    setAdminNotifications(rows);
    announce('admin', rows, silent);
  }, [isAuthenticated, isAdmin, announce]);

  // One poll: let the server raise any "due soon" / "overdue" alerts for this
  // user's rentals (as renter or provider), then fetch notifications.
  const poll = useCallback(async () => {
    if (isAuthenticated && userId) {
      const { error } = await supabase.rpc('gearrent_check_due_rentals');
      if (error && error.code !== 'PGRST202') console.error('Due-rental check failed', error);
    }
    await Promise.all([refreshNotifications(), refreshAdminNotifications()]);
  }, [isAuthenticated, userId, refreshNotifications, refreshAdminNotifications]);

  useEffect(() => {
    poll();
    const interval = window.setInterval(poll, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  // recipientEmail lets a user's action (e.g. renting gear) notify a
  // DIFFERENT user (the provider). If omitted, the notification targets
  // whoever is currently signed in.
  const addNotification = useCallback(async (message, type = 'info', recipientEmail = null) => {
    let recipientUserId = userId;
    if (recipientEmail) {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', recipientEmail.trim().toLowerCase())
        .maybeSingle();
      recipientUserId = data?.id || null;
      if (!recipientUserId) return; // unknown recipient — nothing to notify
    }

    const { error } = await supabase.from('notifications').insert({
      message,
      type,
      recipient_user_id: recipientUserId,
      is_admin_channel: false,
    });
    if (error) {
      console.error('addNotification failed', error);
      return;
    }
    if (!recipientEmail || recipientUserId === userId) {
      await refreshNotifications({ silent: true });
    }
  }, [userId, refreshNotifications]);

  const addAdminNotification = useCallback(async (message, type = 'info') => {
    const { error } = await supabase.from('notifications').insert({
      message,
      type,
      is_admin_channel: true,
    });
    if (error) console.error('addAdminNotification failed', error);
    await refreshAdminNotifications({ silent: true });
  }, [refreshAdminNotifications]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('is_admin_channel', false)
      .eq('recipient_user_id', userId);
    if (error) console.error('markAllRead failed', error);
  }, [userId]);

  const clearAllNotifications = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('is_admin_channel', false)
      .eq('recipient_user_id', userId);
    if (error) console.error('clearAllNotifications failed', error);
  }, [userId]);

  const markAdminNotificationsRead = useCallback(async () => {
    setAdminNotifications((current) => current.map((n) => ({ ...n, read: true })));
    const { error } = await supabase.from('notifications').update({ read: true }).eq('is_admin_channel', true);
    if (error) console.error('markAdminNotificationsRead failed', error);
  }, []);

  const clearAdminNotifications = useCallback(async () => {
    setAdminNotifications([]);
    const { error } = await supabase.from('notifications').delete().eq('is_admin_channel', true);
    if (error) console.error('clearAdminNotifications failed', error);
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    refreshNotifications,
    refreshAdminNotifications,
    addNotification,
    addAdminNotification,
    markAllRead,
    clearAllNotifications,
    adminNotifications,
    adminUnreadCount: adminNotifications.filter((n) => !n.read).length,
    toasts,
    pushToast,
    dismissToast,
    markAdminNotificationsRead,
    clearAdminNotifications,
  }), [
    notifications,
    refreshNotifications,
    refreshAdminNotifications,
    addNotification,
    addAdminNotification,
    markAllRead,
    clearAllNotifications,
    adminNotifications,
    markAdminNotificationsRead,
    clearAdminNotifications,
    toasts,
    pushToast,
    dismissToast,
  ]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
