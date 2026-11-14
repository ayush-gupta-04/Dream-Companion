import { useCallback, useEffect, useState } from 'react';

function normalizePathname(pathname) {
  if (!pathname || pathname === '/') return '/';
  return pathname.replace(/\/+$/, '') || '/';
}

export function parseRoute(pathname) {
  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname === '/') return { name: 'landing' };
  if (normalizedPathname === '/matches') return { name: 'match-directory' };

  const matchRoute = normalizedPathname.match(/^\/matches\/([^/]+)$/);
  if (matchRoute) {
    try {
      return { name: 'match-workspace', matchId: decodeURIComponent(matchRoute[1]) };
    } catch {
      return { name: 'not-found' };
    }
  }

  return { name: 'not-found' };
}

export function useBrowserRoute() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    function handlePopState() {
      setPathname(window.location.pathname);
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((nextPathname) => {
    const destination = normalizePathname(nextPathname);
    if (destination === normalizePathname(window.location.pathname)) return;

    window.history.pushState({}, '', destination);
    setPathname(destination);
  }, []);

  return { route: parseRoute(pathname), navigate };
}
