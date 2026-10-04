import { Component } from 'react';

// Without this, an error while rendering any page unmounts the whole app and
// leaves an empty (black) screen. This shows what broke instead, and resets
// when the user navigates to another page (`resetKey` = current path).
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="container" role="alert" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div className="eyebrow">Something went wrong</div>
        <h1 style={{ fontSize: '1.8rem', margin: '0.5rem 0 0.8rem' }}>This page couldn't be displayed</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Try reloading. If it keeps happening, send this message to the developer:
        </p>
        <pre
          className="mono"
          style={{
            display: 'inline-block', maxWidth: '100%', overflowX: 'auto', textAlign: 'left', whiteSpace: 'pre-wrap',
            padding: '0.8rem 1rem', border: '1px solid var(--border)', color: 'var(--text)', marginBottom: '1.5rem',
          }}
        >
          {this.props.resetKey}{'\n'}{String(error?.message || error)}
        </pre>
        <div>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>Reload page</button>
        </div>
      </div>
    );
  }
}
