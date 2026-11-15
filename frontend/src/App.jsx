import { Show } from '@clerk/react';
import { useBrowserRoute } from './app/routes.js';
import { SiteHeader, SiteFooter } from './components/layout/index.js';
import {
  LandingPage,
  MatchesPage,
  MatchWorkspacePage,
  AuthenticationRequired,
  NotFoundPage,
  ConfigurationError
} from './pages/index.js';

// Re-export ConfigurationError for backward compatibility and test contracts
export { ConfigurationError };

function ProtectedMatchRoute({ children }) {
  return (
    <Show when="signed-in" fallback={<AuthenticationRequired />}>
      {children}
    </Show>
  );
}

function RouteContent({ route, onNavigate }) {
  if (route.name === 'landing') return <LandingPage />;

  if (route.name === 'match-directory') {
    return (
      <ProtectedMatchRoute>
        <MatchesPage onNavigate={onNavigate} />
      </ProtectedMatchRoute>
    );
  }

  if (route.name === 'match-workspace') {
    return (
      <ProtectedMatchRoute>
        <MatchWorkspacePage matchId={route.matchId} onNavigate={onNavigate} />
      </ProtectedMatchRoute>
    );
  }

  return <NotFoundPage />;
}

export default function App() {
  const { route, navigate } = useBrowserRoute();

  return (
    <div className="site-shell">
      <SiteHeader />
      <RouteContent route={route} onNavigate={navigate} />
      <SiteFooter />
    </div>
  );
}
