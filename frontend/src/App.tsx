import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { lazy, Suspense, Component } from 'react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Retry wrapper — retries a dynamic import up to `retries` times with
// exponential back-off. Prevents one-time ERR_NETWORK_CHANGED / cold-start
// failures from crashing the app.
// ---------------------------------------------------------------------------
function lazyWithRetry<T extends React.ComponentType<unknown>>(
  importFn: () => Promise<{ default: T }>,
  retries = 3,
  baseDelay = 800,
): React.LazyExoticComponent<T> {
  return lazy(
    () =>
      new Promise<{ default: T }>((resolve, reject) => {
        const attempt = (remaining: number) => {
          importFn()
            .then(resolve)
            .catch((err) => {
              if (remaining <= 0) {
                reject(err);
              } else {
                setTimeout(() => attempt(remaining - 1), baseDelay * (retries - remaining + 1));
              }
            });
        };
        attempt(retries);
      }),
  );
}

// ---------------------------------------------------------------------------
// Error boundary — catches "Failed to fetch dynamically imported module"
// errors (chunk not found after a new deploy) and triggers a full-page reload
// so the user transparently picks up the latest assets.
// ---------------------------------------------------------------------------
class ChunkErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    const msg = error?.message ?? '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Unable to preload CSS')
    ) {
      return { hasError: true };
    }
    return null;
  }

  componentDidCatch(error: Error) {
    const msg = error?.message ?? '';
    if (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      msg.includes('Unable to preload CSS')
    ) {
      // Hard reload — browser will re-fetch the latest chunk manifest
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
          <div className="animate-pulse text-[#8B5A2B] text-lg font-medium">
            Updating… please wait
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Lazy-load each app shell (with network-error retry)
// ---------------------------------------------------------------------------
const AdminApp  = lazyWithRetry(() => import('@/admin/App'));
const ClientApp = lazyWithRetry(() => import('@/client/ClientApp'));
const KioskApp  = lazyWithRetry(() => import('@/client/app/components/kiosk/KioskApp'));

const Fallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#FFF8F0]">
    <div className="animate-pulse text-[#8B5A2B] text-lg font-medium">Loading…</div>
  </div>
);

const router = createBrowserRouter(
  [
    {
      path: '/admin/*',
      element: (
        <ChunkErrorBoundary>
          <Suspense fallback={<Fallback />}>
            <AdminApp />
          </Suspense>
        </ChunkErrorBoundary>
      ),
    },
    {
      path: '/kiosk',
      element: (
        <ChunkErrorBoundary>
          <Suspense fallback={<Fallback />}>
            <KioskApp />
          </Suspense>
        </ChunkErrorBoundary>
      ),
    },
    {
      path: '/kitchen/*',
      element: (
        <ChunkErrorBoundary>
          <Suspense fallback={<Fallback />}>
            <AdminApp />
          </Suspense>
        </ChunkErrorBoundary>
      ),
    },
    {
      // Client app owns every non-admin path (/, /menu, /cart, /orders …)
      path: '/*',
      element: (
        <ChunkErrorBoundary>
          <Suspense fallback={<Fallback />}>
            <ClientApp />
          </Suspense>
        </ChunkErrorBoundary>
      ),
    },
  ],
  {
    future: {
      v7_relativeSplatPath: true,
    },
  }
);

export default function App() {
  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}
