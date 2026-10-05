import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SIGN_OUT_REASONS, useAuth } from '../context/AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { createAttemptLimiter, formatWait } from '../lib/rateLimit';
import './Auth.css';

// 5 failed attempts → 30s lock, doubling on each further lock (max 15 min).
const loginLimiter = createAttemptLimiter('signin');

export default function SignIn() {
  const location = useLocation();
  const { signIn } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberSession, setRememberSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lockMs, setLockMs] = useState(() => loginLimiter.remainingLockMs());
  const signedOutNotice = SIGN_OUT_REASONS[location.state?.signedOutReason] || '';

  // Count down while locked out.
  useEffect(() => {
    if (lockMs <= 0) return undefined;
    const timer = window.setInterval(() => setLockMs(loginLimiter.remainingLockMs()), 1000);
    return () => window.clearInterval(timer);
  }, [lockMs]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const remaining = loginLimiter.remainingLockMs();
    if (remaining > 0) {
      setLockMs(remaining);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');

    setSubmitting(true);
    setErrorMessage('');
    const result = await signIn(email, password, { remember: rememberSession });
    setSubmitting(false);

    if (result.user) {
      // The GuestRoute wrapper redirects to the requested page (or the
      // catalog / admin dashboard) as soon as the session is in place.
      loginLimiter.reset();
      return;
    }

    if (result.rateLimited) {
      loginLimiter.lockFor(60 * 1000);
      setLockMs(loginLimiter.remainingLockMs());
      setErrorMessage('Too many sign-in attempts. Please wait before trying again.');
      return;
    }
    if (result.unconfirmed) {
      setErrorMessage('Please confirm your email address first. Check your inbox for the confirmation link.');
      return;
    }

    const lockedFor = loginLimiter.recordFailure();
    setLockMs(lockedFor);
    setErrorMessage(lockedFor > 0
      ? 'Too many failed attempts.'
      : 'The email or password is incorrect. Please try again.');
  };

  const locked = lockMs > 0;

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <div className="auth-visual">
          <img
            src="https://northtexasjellystone.com/wp-content/uploads/2025/05/must-have-camping-gear.jpeg"
            alt="Camping gear ready for an outdoor trip"
          />
          <div className="auth-visual-copy">
            <span className="eyebrow">Pack for the outside</span>
            <h1>Good gear makes the wild feel closer.</h1>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-heading">
            <div className="wordmark">GEAR RENT</div>
            <span className="eyebrow">Authentication Portal</span>
          </div>

          <form className="card auth-card" onSubmit={handleSubmit}>
            <h2>Access Gear</h2>

            {signedOutNotice && !errorMessage && (
              <p className="auth-notice" role="status">{signedOutNotice}</p>
            )}

            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input name="email" id="email" type="email" placeholder="user@studio.com" autoComplete="email" required />
            </div>

            <div className="field">
              <div className="field-row">
                <label htmlFor="password" style={{ marginBottom: 0 }}>
                  Password
                </label>
                <label className="checkbox-row" htmlFor="show-password">
                  <input
                    id="show-password"
                    type="checkbox"
                    checked={showPassword}
                    onChange={(event) => setShowPassword(event.target.checked)}
                  />
                  Show password
                </label>
              </div>
              <input
                name="password"
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {errorMessage && (
              <p className="auth-error" role="alert">
                {errorMessage}
                {locked ? ` Try again in ${formatWait(lockMs)}.` : <> <Link to="/signup">Create account</Link></>}
              </p>
            )}

            <label className="checkbox-row" title="Stay signed in after closing the browser. Leave off on shared computers.">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(event) => setRememberSession(event.target.checked)}
              />
              Maintain Session
            </label>

            <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting || locked}>
              {submitting ? 'Authenticating…' : locked ? `Locked · ${formatWait(lockMs)}` : 'Authenticate →'}
            </button>

            <div className="auth-divider"><span>OR</span></div>
            <GoogleLoginButton text="signin_with" />

            <p className="auth-footer-line">
              No account? <Link to="/signup">Request Access</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
