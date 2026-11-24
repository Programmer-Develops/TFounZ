import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'An unexpected interface error occurred.',
    };
  }

  componentDidCatch(error, info) {
    console.error('Studio ErrorBoundary caught:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg-base)',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
        }}
      >
        <div
          className="surface-padded"
          style={{
            maxWidth: 460,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={20} color="var(--status-live)" />
            <h1 style={{ fontSize: '1.1rem' }}>Studio Session Interrupted</h1>
          </div>
          <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
            {this.state.message}
          </p>
          <div>
            <button type="button" className="btn btn-primary btn-sm" onClick={this.handleReset}>
              <RotateCcw size={13} /> Reload Studio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
