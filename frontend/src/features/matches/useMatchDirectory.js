import { useCallback, useEffect, useRef, useState } from 'react';
import { listMatches } from './api.js';

function shouldClearDirectory(error) {
  return [401, 403, 503].includes(error?.status);
}

export function useMatchDirectory(apiClient) {
  const [directory, setDirectory] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const directoryRef = useRef(null);
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const refresh = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const hasPreviousDirectory = directoryRef.current !== null;

    if (hasPreviousDirectory) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);
    setIsStale(false);

    try {
      const nextDirectory = await listMatches(apiClient);
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;

      directoryRef.current = nextDirectory;
      setDirectory(nextDirectory);
      setError(null);
      setIsStale(false);
    } catch (nextError) {
      if (!isMountedRef.current || requestId !== requestIdRef.current) return;

      if (shouldClearDirectory(nextError)) {
        directoryRef.current = null;
        setDirectory(null);
        setIsStale(false);
      } else if (hasPreviousDirectory) {
        setIsStale(true);
      }
      setError(nextError);
    } finally {
      if (isMountedRef.current && requestId === requestIdRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [apiClient]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    directory,
    error,
    isLoading,
    isRefreshing,
    isStale,
    refresh
  };
}
