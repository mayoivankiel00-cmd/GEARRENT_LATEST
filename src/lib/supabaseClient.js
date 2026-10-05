import { createClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fails loudly in dev rather than silently making requests to "undefined".
  console.error(
    'Missing Supabase env vars. Create a .env file with VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY (see .env.example).'
  );
}

// Where supabase-js keeps the session (access + refresh token). Every tab of
// the same browser shares it, which is what lets a sign-out in one tab end
// the session in all of them.
export const AUTH_STORAGE_KEY = 'gearrent-auth';

// "Maintain Session" on the sign-in form. When it is off, the session is
// tied to the browser session: a cookie without an expiry marks the browser
// as "still open", and if it is gone on the next visit (browser was closed)
// the stored tokens are discarded. It is also subject to the idle timeout.
const REMEMBER_KEY = 'gearrent-remember-session';
const ALIVE_COOKIE = 'gearrent_alive';

function safeLocalStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function setRememberSession(remember) {
  safeLocalStorage()?.setItem(REMEMBER_KEY, remember ? '1' : '0');
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ALIVE_COOKIE}=1; path=/; SameSite=Strict${secure}`;
}

export function isSessionRemembered() {
  // Accounts that signed in before this setting existed stay remembered.
  return safeLocalStorage()?.getItem(REMEMBER_KEY) !== '0';
}

export function browserWasRestarted() {
  return !document.cookie.split('; ').some((part) => part.startsWith(`${ALIVE_COOKIE}=`));
}

export function clearSessionMarkers() {
  safeLocalStorage()?.removeItem(REMEMBER_KEY);
  document.cookie = `${ALIVE_COOKIE}=; path=/; Max-Age=0; SameSite=Strict`;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: AUTH_STORAGE_KEY,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // PKCE keeps OAuth tokens out of the URL fragment / browser history.
    flowType: 'pkce',
  },
});
