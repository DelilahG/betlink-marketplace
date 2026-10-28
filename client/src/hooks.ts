import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, errorMessage, type PropertyCard } from './api';
import { useAuth } from './auth';

/** Loads JSON from the API; re-runs when `path` changes. */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!path) return;
    let live = true;
    setLoading(true);
    setError(null);
    api<T>(path)
      .then((d) => live && setData(d))
      .catch((e) => live && setError(errorMessage(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [path, nonce]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, setData, error, loading, reload };
}

/** Optimistic save/unsave. Visitors are sent to log in first. */
export function useFavoriteToggle(update: (id: string, fav: boolean) => void) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    async (p: Pick<PropertyCard, 'id' | 'is_favorite'>) => {
      if (!user) return navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      const next = !p.is_favorite;
      update(p.id, next);
      try {
        await api(`/me/favorites/${p.id}`, { method: next ? 'PUT' : 'DELETE' });
      } catch {
        update(p.id, !next);
      }
    },
    [user, navigate, location, update],
  );
}
