import { setRememberSession, supabase } from '../lib/supabaseClient';

export default function GoogleLoginButton({ text = 'signin_with' }) {
  return (
    <div className="google-login-control">
      <button
        type="button"
        className="google-login-button btn-block"
        onClick={() => {
          setRememberSession(true);
          supabase.auth.signInWithOAuth({
            provider: 'google',
            // Come back through /signin so GuestRoute sends admins to /admin.
            options: { redirectTo: `${window.location.origin}/signin` },
          });
        }}
      >
        <svg className="google-login-mark" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M21.35 12.23c0-.76-.07-1.49-.22-2.18H12v4.13h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.34Z" />
          <path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.28v2.53A9.74 9.74 0 0 0 12 21.5Z" />
          <path fill="#FBBC05" d="M6.53 13.58a5.86 5.86 0 0 1 0-3.16V7.89H3.28a9.74 9.74 0 0 0 0 8.22l3.25-2.53Z" />
          <path fill="#EA4335" d="M12 6.39c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.47 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.72 5.39l3.25 2.53C7.3 8.11 9.46 6.39 12 6.39Z" />
        </svg>
        {text === 'signup_with' ? 'Sign up with Google' : 'Sign in with Google'}
      </button>
    </div>
  );
}