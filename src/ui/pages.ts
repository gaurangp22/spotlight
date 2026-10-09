import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../store/AppContext';

/** Cursor pages stay scoped to the viewer and query; stale account requests cannot append. */
export function usePages<T extends { id?: string }>(path: string, field: string, enabled = true) {
  const { user } = useApp(); const key = `${user?.id || 'guest'}:${path}`;
  const live = useRef(key); live.current = key;
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<{ key: string; request: string; rows: T[]; next: string | null; error: string; busy: boolean }>({ key: '', request: '', rows: [], next: null, error: '', busy: false });
  const request = `${key}:${version}`; const lock = useRef(false);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true; const controller = new AbortController(); lock.current = false;
    api<Record<string, unknown>>(path, { signal: controller.signal }).then((data) => { if (active) setState({ key, request, rows: data[field] as T[], next: data.nextCursor as string | null, error: '', busy: false }); })
      .catch((e) => { if (active) setState({ key, request, rows: [], next: null, error: errorMessage(e), busy: false }); });
    return () => { active = false; controller.abort(); };
  }, [key, path, field, request, enabled]);
  const loadMore = useCallback(async () => {
    if (lock.current || state.key !== key || !state.next) return;
    lock.current = true; setState((s) => ({ ...s, busy: true, error: '' }));
    try {
      const data = await api<Record<string, unknown>>(`${path}${path.includes('?') ? '&' : '?'}cursor=${encodeURIComponent(state.next)}`);
      if (live.current === key) setState((s) => { const rows = [...s.rows, ...(data[field] as T[])]; return { ...s, rows: rows.filter((r, i) => !r.id || rows.findIndex((x) => x.id === r.id) === i), next: data.nextCursor as string | null, busy: false }; });
    } catch (e) { if (live.current === key) setState((s) => ({ ...s, error: errorMessage(e), busy: false })); }
    finally { lock.current = false; }
  }, [state, key, path, field]);
  return { rows: state.key === key ? state.rows : [], error: state.key === key ? state.error : '', loading: enabled && state.request !== request, busy: state.key === key && state.busy, hasMore: state.key === key && !!state.next, loadMore, reload };
}
