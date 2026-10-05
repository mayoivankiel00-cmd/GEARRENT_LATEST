import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { createAttemptLimiter, formatWait } from '../rateLimit';
import './Auth.css';

const MIN_PASSWORD_LENGTH = 8;
// Account creation is throttled per browser: 5 attempts per 15 minutes.
const signupLimiter = createAttemptLimiter('signup', { maxAttempts: 5, baseLockMs: 5 * 60 * 1000 });

export default function SignUp() {
  const { createAccount } = useAuth();
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const form = e.currentTarget;
    const formData = new FormData(form);
    const email = formData.get('email').trim().toLowerCase();
    const password = formData.get('password');

    setErrorMessage('');
    setInfoMessage('');

    const lockMs = signupLimiter.remainingLockMs();
    if (lockMs > 0) {
      setErrorMessage(`Too many sign-up attempts. Try again in ${formatWait(lockMs)}.`);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
      return;
    }

    setSubmitting(true);
    // Supabase's own "already registered" error is the source of truth for
    // duplicate accounts, so there's no separate pre-check call here.
    const result = await createAccount({
      name: formData.get('name').trim(),
      email,
      password,
    });
    setSubmitting(false);

    if (!result.success) {
      signupLimiter.recordFailure();
      if (result.rateLimited) {
        signupLimiter.lockFor(5 * 60 * 1000);
        setErrorMessage('Too many sign-up attempts. Please wait a few minutes and try again.');
        return;
      }
      const message = result.error?.toLowerCase().includes('registered')
        ? 'This email is already in use'
        : result.error || 'Unable to create the account. Please try again.';
      setErrorMessage(message);
      return;
    }

    signupLimiter.recordFailure(); // successful sign-ups count toward the throttle too
    if (result.needsEmailConfirmation) {
      // Project has "Confirm email" enabled in Supabase Auth settings —
      // there's no session yet, so send them to sign in after confirming.
      form.reset();
      setInfoMessage('Account created. Check your email to confirm it, then log in.');
    }
    // Otherwise the new session is live and GuestRoute moves on to the catalog.
  };

  return (
    <div className="auth-page">
      <div className="auth-layout">
        <div className="auth-visual">
          <img
            src="https://images.stockcake.com/public/1/d/e/1de6a029-db24-4c1b-b87b-b43f445c3af6_large/photography-gear-setup-stockcake.jpg"
            alt="Photography cameras, lenses, and prints arranged on a wooden table"
          />
          <div className="auth-visual-copy">
            <span className="eyebrow">See further</span>
            <h1>Build your kit for the next horizon.</h1>
          </div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-heading">
            <div className="wordmark">GEAR RENT</div>
            <span className="eyebrow">Authentication Portal</span>
          </div>

          <form className="card auth-card" onSubmit={handleSubmit}>
            <h2>Create Account</h2>

            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input name="name" id="name" type="text" placeholder="Jane Doe" required />
            </div>

            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input name="email" id="email" type="email" placeholder="jane@studio.com" autoComplete="email" required />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input name="password" id="password" type="password" placeholder="At least 8 characters" minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" required />
            </div>

            {errorMessage && <p className="auth-error" role="alert">{errorMessage} <Link to="/signin">Log in</Link></p>}
            {infoMessage && <p className="auth-notice" role="status">{infoMessage} <Link to="/signin">Log in</Link></p>}

            <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create Account →'}
            </button>

            <div className="auth-divider"><span>OR</span></div>
            <GoogleLoginButton text="signup_with" />

            <p className="auth-footer-line">
              Already have an account? <Link to="/signin">Log In</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
