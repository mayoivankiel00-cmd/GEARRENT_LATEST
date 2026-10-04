import { createClient } from '@supabase/supabase-js';
import { supabase, supabaseAnonKey, supabaseUrl } from '../supabaseClient';

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

// Permanent admin; the database refuses to revoke it. Keep in sync with
// gearrent_default_admin_email() in gearrent_default_admin.sql.
export const DEFAULT_ADMIN_EMAIL = 'gearrent0@gmail.com';

export function isDefaultAdmin(email) {
  return typeof email === 'string' && email.trim().toLowerCase() === DEFAULT_ADMIN_EMAIL;
}

function friendlyError(error, fallback) {
  if (!error) return fallback;
  const text = `${error.message || ''} ${error.hint || ''}`;
  if (/rate_limited|too many|rate limit/i.test(text) || error.status === 429) {
    return 'Too many account changes in a short time. Please wait a few minutes.';
  }
  return error.message || fallback;
}

export async function listAdmins() {
  const { data, error } = await supabase.rpc('admin_list_admins');
  if (error) return { admins: [], error: friendlyError(error, 'Could not load administrators.') };
  return { admins: data || [], error: null };
}

// Grants or revokes admin on an existing account. The database function
// re-checks that the caller is an admin, so this cannot be abused from a
// non-admin session.
export async function setUserRole(email, role) {
  const { data, error } = await supabase.rpc('admin_set_user_role', {
    p_email: email.trim().toLowerCase(),
    p_role: role,
  });
  if (error) return { ok: false, error: friendlyError(error, 'Could not update the account role.') };
  return { ok: true, error: null, account: Array.isArray(data) ? data[0] : data };
}

// Creates a brand-new account and makes it an administrator.
//
// The sign-up runs on a throw-away Supabase client that keeps its session in
// memory only, so the admin doing this stays signed in as themselves (a
// normal signUp() on the shared client would replace their session with the
// new user's). Promotion then happens through admin_set_user_role, which
// only succeeds for an existing admin.
export async function createAdminAccount({ name, email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  if (password.length < MIN_ADMIN_PASSWORD_LENGTH) {
    return { ok: false, error: `Admin passwords need at least ${MIN_ADMIN_PASSWORD_LENGTH} characters.` };
  }

  const provisioningClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: 'gearrent-admin-provisioning',
    },
  });

  const { data, error } = await provisioningClient.auth.signUp({
    email: normalizedEmail,
    password,
    options: { data: { name: name.trim() } },
  });

  if (error) {
    const alreadyExists = /registered|exists/i.test(error.message || '');
    return {
      ok: false,
      alreadyExists,
      error: alreadyExists
        ? 'An account with this email already exists. Use "Grant admin access" below instead.'
        : friendlyError(error, 'Could not create the account.'),
    };
  }

  // With "Confirm email" enabled Supabase hides duplicates by returning a
  // user with no identities instead of an error.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      ok: false,
      alreadyExists: true,
      error: 'An account with this email already exists. Use "Grant admin access" below instead.',
    };
  }

  if (data.session) {
    // Drop the new user's in-memory session right away.
    await provisioningClient.auth.signOut({ scope: 'local' }).catch(() => {});
  }

  const promotion = await setUserRole(normalizedEmail, 'admin');
  if (!promotion.ok) {
    return {
      ok: false,
      error: `The account was created but could not be made an admin: ${promotion.error}`,
    };
  }

  return { ok: true, error: null, needsEmailConfirmation: !data.session };
}
