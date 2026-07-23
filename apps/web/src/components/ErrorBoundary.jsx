import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

/**
 * App-wide error boundary. Prevents a single render/runtime error from
 * blanking the entire app (React has no default boundary). Shows a recoverable
 * fallback with reload + home actions.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Surfaced to the runtime session journal / console for diagnosis.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Uncaught error:', error, info?.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="pointer-events-none fixed inset-0 bg-grid opacity-[0.12]" />
        <div className="glass relative w-full max-w-md rounded-2xl p-8 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-destructive/15 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="font-serif-lux text-2xl font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            An unexpected error interrupted this view. Your data is safe — try reloading, or head back home.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground glow-gold"
            >
              <RotateCcw className="h-4 w-4" /> Reload
            </button>
            <a
              href="/"
              onClick={this.handleReset}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm hover:bg-secondary"
            >
              <Home className="h-4 w-4" /> Home
            </a>
          </div>
        </div>
      </div>
    );
  }
}
