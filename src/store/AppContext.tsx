import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { Draft, MoodDraft, MusicItem, Profile, Ranking } from '../lib/types';
import { sampleRankings } from '../lib/sample';
import { api, ApiError, errorMessage, readToken, setApiToken, storeToken } from '../lib/api';
import { C } from '../ui/theme';

const emptyDraft: Draft = { title: '', subtitle: '', items: [], visibility: 'public' };
const emptyMood: MoodDraft = { title: '', subtitle: '', items: [], tiles: [], theme: 'night', visibility: 'public' };
type LocalState = { draft: Draft; moodDraft: MoodDraft; archivedDrafts: { id: string; draft: Draft }[] };
type SyncData = { posts: Ranking[]; people: Profile[]; following: string[]; blocks: Profile[] };
type AppValue = LocalState & SyncData & {
  hydrated: boolean; user: Profile | null; allRankings: Ranking[]; rankings: Ranking[]; reactions: string[];
  spotifyConnected: boolean; refreshing: boolean; connected: boolean; notice: string;
  setNotice: (value: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  setMoodDraft: React.Dispatch<React.SetStateAction<MoodDraft>>;
  startDraft: (origin?: Ranking) => void; editRanking: (ranking: Ranking) => void; openDraft: (id: string) => void;
  startMood: (post?: Ranking) => void;
  addMusic: (item: MusicItem) => void; removeMusic: (id: string) => void; moveMusic: (index: number, direction: -1 | 1) => void;
  publish: () => Promise<Ranking>; publishMood: () => Promise<Ranking>;
  refresh: () => Promise<void>; loadPost: (id: string) => Promise<void>; deletePost: (id: string) => Promise<void>;
  toggleReaction: (id: string) => Promise<void>; addComment: (id: string, text: string, itemId?: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>; commentsFor: (id: string) => Ranking['comments']; toggleFollow: (handle: string) => Promise<void>;
  blockUser: (handle: string, unblock?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; handle: string }) => Promise<void>;
  logout: () => Promise<void>; updateProfile: (name: string, bio: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
};
const Context = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Ranking[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Profile[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [moodDraft, setMoodDraft] = useState<MoodDraft>(emptyMood);
  const [archivedDrafts, setArchivedDrafts] = useState<LocalState['archivedDrafts']>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const generation = useRef(0);
  const persistQueue = useRef(Promise.resolve());
  const refreshPromise = useRef<Promise<void> | null>(null);
  const guestDraft = useRef<LocalState | null>(null);
  const userId = user?.id;

  const resetRemote = useCallback(() => { setPosts([]); setPeople([]); setFollowing([]); setBlocks([]); setSpotifyConnected(false); }, []);
  const clearSession = useCallback(async () => {
    generation.current++; refreshPromise.current = null;
    await storeToken(null); setUser(null); resetRemote(); setRefreshing(false); setNotice('');
  }, [resetRemote]);

  const refresh = useCallback(async () => {
    if (refreshPromise.current) return refreshPromise.current;
    const current = generation.current;
    setRefreshing(true);
    const promise = (async () => {
      try {
        const data = await api<SyncData>('/sync');
        if (current !== generation.current) return;
        setPosts(data.posts); setPeople(data.people); setFollowing(data.following); setBlocks(data.blocks); setConnected(true);
        if (userId) {
          const me = await api<{ user: Profile; spotifyConnected: boolean }>('/me');
          if (current === generation.current) { setUser(me.user); setSpotifyConnected(me.spotifyConnected); }
        }
      } catch (error) {
        if (current !== generation.current) return;
        setConnected(false);
        if (error instanceof ApiError && error.status === 401) { await clearSession(); setNotice('Your session expired. Sign in again.'); }
        else setNotice(errorMessage(error));
      } finally {
        if (current === generation.current) { setRefreshing(false); refreshPromise.current = null; }
      }
    })();
    refreshPromise.current = promise;
    return promise;
  }, [userId, clearSession]);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const saved = await readToken(); setApiToken(saved);
        if (saved) {
          try { const me = await api<{ user: Profile; spotifyConnected: boolean }>('/me'); if (active) { setUser(me.user); setSpotifyConnected(me.spotifyConnected); } }
          catch (error) { if (error instanceof ApiError && error.status === 401) await storeToken(null); else if (active) setNotice(errorMessage(error)); }
        }
      } catch (error) { if (active) setNotice(errorMessage(error)); }
      finally { if (active) setHydrated(true); }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    const scope = user?.id || 'guest';
    persistQueue.current.then(() => AsyncStorage.getItem(`margin-drafts-v2:${scope}`)).then((raw) => {
      if (!active) return;
      const saved = raw ? JSON.parse(raw) as LocalState : null;
      if (guestDraft.current && scope !== 'guest') {
        const carried = guestDraft.current; guestDraft.current = null;
        setDraft(carried.draft); setMoodDraft(carried.moodDraft);
        setArchivedDrafts([...(saved?.draft && (saved.draft.title || saved.draft.items.length) ? [{ id: `draft-${Date.now()}`, draft: saved.draft }] : []), ...(saved?.archivedDrafts || []), ...carried.archivedDrafts]); return;
      }
      setDraft(saved?.draft && Array.isArray(saved.draft.items) ? saved.draft : emptyDraft);
      setMoodDraft(saved?.moodDraft && Array.isArray(saved.moodDraft.tiles) ? saved.moodDraft : emptyMood);
      setArchivedDrafts(Array.isArray(saved?.archivedDrafts) ? saved.archivedDrafts : []);
    }).catch(() => { if (active) { setDraft(emptyDraft); setMoodDraft(emptyMood); setArchivedDrafts([]); setNotice('Your saved drafts could not be read.'); } }).finally(() => { if (active) setLoadedScope(scope); });
    return () => { active = false; };
  }, [user?.id, hydrated]);

  useEffect(() => {
    if (loadedScope !== (user?.id || 'guest')) return;
    const key = `margin-drafts-v2:${loadedScope}`;
    const data = JSON.stringify({ draft, moodDraft, archivedDrafts });
    persistQueue.current = persistQueue.current.then(() => AsyncStorage.setItem(key, data)).catch(() => setNotice('Draft could not be saved on this device. Keep the app open and try again.'));
  }, [draft, moodDraft, archivedDrafts, loadedScope, user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
    // Refresh only when the account changes, not on profile updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hydrated]);

  const acceptSession = useCallback(async (result: { token: string; user: Profile }) => {
    if (!user && (draft.title || draft.items.length || moodDraft.title || moodDraft.tiles.length || moodDraft.items.length)) guestDraft.current = { draft, moodDraft, archivedDrafts };
    generation.current++; refreshPromise.current = null; resetRemote();
    await storeToken(result.token); setUser(result.user); setNotice('');
  }, [resetRemote, user, draft, moodDraft, archivedDrafts]);
  const login = useCallback(async (email: string, password: string) => acceptSession(await api('/auth/login', { method: 'POST', body: { email, password } })), [acceptSession]);
  const register = useCallback(async (input: { email: string; password: string; name: string; handle: string }) => acceptSession(await api('/auth/register', { method: 'POST', body: input })), [acceptSession]);
  const logout = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { await clearSession(); } }, [clearSession]);
  const updateProfile = useCallback(async (name: string, bio: string) => { const result = await api<{ user: Profile }>('/me', { method: 'PATCH', body: { name, bio } }); setUser(result.user); await refresh(); }, [refresh]);
  const deleteAccount = useCallback(async (password: string) => { await api('/me', { method: 'DELETE', body: { password } }); if (user) await AsyncStorage.removeItem(`margin-drafts-v2:${user.id}`); await clearSession(); }, [user, clearSession]);
  const startDraft = useCallback((origin?: Ranking) => {
    if (draft.items.length || draft.title.trim()) setArchivedDrafts((v) => [{ id: `draft-${Date.now()}`, draft }, ...v].slice(0, 30));
    setDraft(origin ? { title: origin.title, subtitle: origin.subtitle || '', items: [...origin.items].sort((a, b) => a.title.localeCompare(b.title)), visibility: 'public', originId: origin.isSample ? undefined : origin.id } : emptyDraft);
  }, [draft]);
  const editRanking = useCallback((ranking: Ranking) => {
    if (draft.items.length || draft.title.trim()) setArchivedDrafts((v) => [{ id: `draft-${Date.now()}`, draft }, ...v].slice(0, 30));
    setDraft({ title: ranking.title, subtitle: ranking.subtitle || '', items: ranking.items, visibility: ranking.visibility, originId: ranking.originId, editingId: ranking.id });
  }, [draft]);
  const openDraft = useCallback((id: string) => {
    const chosen = archivedDrafts.find((v) => v.id === id); if (!chosen) return;
    setArchivedDrafts((v) => [...(draft.items.length || draft.title.trim() ? [{ id: `draft-${Date.now()}`, draft }] : []), ...v.filter((entry) => entry.id !== id)]);
    setDraft(chosen.draft);
  }, [archivedDrafts, draft]);
  const startMood = useCallback((post?: Ranking) => { if (post) setMoodDraft({ title: post.title, subtitle: post.subtitle || '', items: post.items, tiles: post.tiles || [], theme: post.theme || 'night', visibility: post.visibility, editingId: post.id }); }, []);
  const addMusic = useCallback((item: MusicItem) => setDraft((v) => v.items.some((i) => i.id === item.id) || v.items.length >= 100 ? v : { ...v, items: [...v.items, item] }), []);
  const removeMusic = useCallback((id: string) => setDraft((v) => ({ ...v, items: v.items.filter((i) => i.id !== id) })), []);
  const moveMusic = useCallback((index: number, direction: -1 | 1) => setDraft((v) => { const dest = index + direction; if (dest < 0 || dest >= v.items.length) return v; const items = [...v.items]; [items[index], items[dest]] = [items[dest], items[index]]; return { ...v, items }; }), []);
  const replacePost = useCallback((post: Ranking) => setPosts((v) => [post, ...v.filter((p) => p.id !== post.id)]), []);
  const savePost = useCallback(async (body: Draft | MoodDraft, kind: 'ranking' | 'moodboard') => {
    if (!user) throw new ApiError('Sign in before publishing. Your draft is saved.', 401);
    const data = await api<{ post: Ranking }>(body.editingId ? `/posts/${body.editingId}` : '/posts', { method: body.editingId ? 'PUT' : 'POST', body: { ...body, kind } });
    replacePost(data.post); return data.post;
  }, [user, replacePost]);
  const publish = useCallback(async () => { const post = await savePost(draft, 'ranking'); setDraft(emptyDraft); return post; }, [draft, savePost]);
  const publishMood = useCallback(async () => { const post = await savePost(moodDraft, 'moodboard'); setMoodDraft(emptyMood); return post; }, [moodDraft, savePost]);
  const loadPost = useCallback(async (id: string) => { if (sampleRankings.some((p) => p.id === id)) return; const data = await api<{ post: Ranking }>(`/posts/${id}`); replacePost(data.post); }, [replacePost]);
  const deletePost = useCallback(async (id: string) => { await api(`/posts/${id}`, { method: 'DELETE' }); setPosts((v) => v.filter((p) => p.id !== id)); }, []);
  const toggleReaction = useCallback(async (id: string) => {
    const p = posts.find((v) => v.id === id); if (!p) throw new Error('Sign in and react to a published ranking.');
    const result = await api<{ post: Ranking }>(`/posts/${id}/reaction`, { method: p.reacted ? 'DELETE' : 'PUT' }); replacePost(result.post);
  }, [posts, replacePost]);
  const addComment = useCallback(async (id: string, text: string, itemId?: string) => { const r = await api<{ post: Ranking }>(`/posts/${id}/comments`, { method: 'POST', body: { text, itemId } }); replacePost(r.post); }, [replacePost]);
  const deleteComment = useCallback(async (id: string) => { await api(`/comments/${id}`, { method: 'DELETE' }); await refresh(); }, [refresh]);
  const toggleFollow = useCallback(async (handle: string) => { await api(`/people/${handle.replace('@', '')}/follow`, { method: following.includes(handle) ? 'DELETE' : 'PUT' }); await refresh(); }, [following, refresh]);
  const blockUser = useCallback(async (handle: string, unblock = false) => { await api(`/people/${handle.replace('@', '')}/block`, { method: unblock ? 'DELETE' : 'PUT' }); await refresh(); }, [refresh]);
  const allRankings = useMemo(() => user ? posts : [...posts, ...sampleRankings], [posts, user]);
  const rankings = useMemo(() => posts.filter((p) => p.userId === user?.id), [posts, user?.id]);
  const reactions = useMemo(() => posts.filter((p) => p.reacted).map((p) => p.id), [posts]);
  const commentsFor = useCallback((id: string) => allRankings.find((p) => p.id === id)?.comments || [], [allRankings]);
  const value: AppValue = { user, posts, people, following, blocks, draft, moodDraft, archivedDrafts, hydrated,
    rankings, reactions, allRankings, spotifyConnected, refreshing, connected, notice, setNotice, setDraft, setMoodDraft,
    startDraft, editRanking, startMood, openDraft, addMusic, removeMusic, moveMusic, publish, publishMood, refresh, loadPost,
    deletePost, toggleReaction, addComment, deleteComment, commentsFor, toggleFollow, blockUser, login, register, logout, updateProfile, deleteAccount,
  };
  return <Context.Provider value={value}>{hydrated && loadedScope === (user?.id || 'guest') ? children : <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: 18 }}><Text style={{ fontSize: 28, fontWeight: '900', color: C.ink }}>MARGIN.</Text><ActivityIndicator color={C.accent} /></View>}</Context.Provider>;
}
export function useApp() { const value = useContext(Context); if (!value) throw new Error('AppProvider is missing'); return value; }
