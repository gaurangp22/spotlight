import { useCallback, useEffect, useState } from 'react';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../store/AppContext';

/** Account-keyed snapshots never expose the previous viewer's response during navigation or sign-out. */
export function useRemote<T>(path: string, enabled = true) {
  const { user } = useApp();
  const key = `${user?.id || 'guest'}:${path}`;
  const [version, setVersion] = useState(0);
  const [snapshot, setSnapshot] = useState<{ key: string; data: T } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [settled, setSettled] = useState('');
  const requestKey = `${key}:${version}`;
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let active = true; const controller = new AbortController();
    api<T>(path, { signal: controller.signal }).then((data) => { if (active) { setSnapshot({ key, data }); setFailure(null); } })
      .catch((error) => { if (active) setFailure({ key, message: errorMessage(error) }); })
      .finally(() => { if (active) setSettled(requestKey); });
    return () => { active = false; controller.abort(); };
  }, [key, path, version, enabled, requestKey]);
  return { data: snapshot?.key === key ? snapshot.data : null, error: failure?.key === key ? failure.message : '', loading: enabled && settled !== requestKey, reload };
}
