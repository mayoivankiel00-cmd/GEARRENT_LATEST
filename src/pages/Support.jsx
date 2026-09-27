export default function Support() {
  return (
    <div className="container" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '0.8rem' }}>Support</h1>
      <p style={{ color: 'var(--text-muted)', maxWidth: '48ch', margin: '0 auto' }}>
        Need help with a rental, a return, or your account? Reach the crew at{' '}
        <a href="mailto:support@gearrent.ph" style={{ color: 'var(--accent)' }}>
          support@gearrent.ph
        </a>{' '}
        and we'll get back to you within one business day.
      </p>
    </div>
  );
}
