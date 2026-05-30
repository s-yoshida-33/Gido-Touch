// src/main.tsx
// Main entry point for the React application
import React, { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import './styles/index.css'
import App from './App.tsx'
import './styles/fonts.css'
import './styles/location-icons.css'
import { PatchScreen } from './screens/PatchScreen'
import { MallProvider } from './contexts/MallContext';
import { AudioSettingsProvider } from './contexts/AudioSettingsContext';

// Send initial watchdog ping immediately — before React renders.
// This ensures the Rust watchdog knows the WebView JS engine is alive
// even if React component mounting fails.
invoke('webview_ping').catch(() => {});

// Suppress known react-zoom-pan-pinch library error: thrown when a pinch
// gesture fires with two touches at the same point (distance = 0). The error
// originates inside a touch event handler so React Error Boundaries cannot
// catch it — the only reliable interception point is the global error event.
window.addEventListener('error', (event) => {
  if (event.message?.includes('Pinch touches distance was not provided')) {
    event.preventDefault();
  }
});

// Simple Error Boundary
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, background: 'white', color: 'red', fontSize: 24, overflow: 'auto', height: '100vh' }}>
          <h1>Something went wrong.</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// Root component: PatchScreen → App transition via React state
// リロード時も毎回 PatchScreen を実行し、アップデートとメディアDLを保証する
function Root() {
  const [showApp, setShowApp] = useState(false);

  if (showApp) {
    return (
      <MallProvider>
        <AudioSettingsProvider>
          <App />
        </AudioSettingsProvider>
      </MallProvider>
    );
  }

  return <PatchScreen onComplete={() => setShowApp(true)} />;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ErrorBoundary>
      <Root />
    </ErrorBoundary>
  </StrictMode>,
);
