import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, StyleSheet, View } from 'react-native';
import { AppNotification, Draft, MoodDraft, MusicItem, Profile, Ranking, Rating, ServerConfig, TakeDraft, Tier } from '../lib/types';
import { sampleRankings } from '../lib/sample';
import { api, ApiError, errorMessage, readToken, setApiToken, storeToken } from '../lib/api';
import { clearInvite, pendingInvite } from '../lib/invite';
import { useTheme } from '../ui/theme';

const emptyDraft: Draft = { title: '', subtitle: '', items: [], visibility: 'public' };
const emptyMood: MoodDraft = { title: '', subtitle: '', items: [], tiles: [], theme: 'night', visibility: 'public' };
const emptyTake: TakeDraft = { title: '', items: [], poll: false, visibility: 'public' };
type LocalState = { draft: Draft; moodDraft: MoodDraft; takeDraft: TakeDraft; archivedDrafts: { id: string; draft: Draft }[]; archivedTakes: { id: string; draft: TakeDraft }[]; archivedMoods: { id: string; draft: MoodDraft }[] };
type SyncData = { posts: Ranking[]; people: Profile[]; following: string[]; blocks: Profile[]; ratings: Rating[]; savedItems: MusicItem[]; savedPostIds: string[] };
export type PodInput = { title: string; subtitle: string; items: MusicItem[]; visibility: Ranking['visibility']; open: boolean; sourceUrl?: string; editingId?: string };
type AppValue = LocalState & SyncData & {
  hydrated: boolean; user: Profile | null; allRankings: Ranking[]; rankings: Ranking[]; reactions: string[];
  spotifyConnected: boolean; refreshing: boolean; connected: boolean; notice: string; unread: number;
  setUnread: (value: number) => void;
  setNotice: (value: string) => void;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  setMoodDraft: React.Dispatch<React.SetStateAction<MoodDraft>>;
  setTakeDraft: React.Dispatch<React.SetStateAction<TakeDraft>>;
  startTake: (post?: Ranking, poll?: boolean) => void; publishTake: () => Promise<Ranking>;
  openTakeDraft: (id: string) => void; openMoodDraft: (id: string) => void;
  vote: (id: string, choice: 0 | 1 | null) => Promise<void>;
  startDraft: (origin?: Ranking) => void; editRanking: (ranking: Ranking) => void; openDraft: (id: string) => void;
  startMood: (post?: Ranking) => void;
  addMusic: (item: MusicItem) => void; removeMusic: (id: string) => void; moveMusic: (index: number, direction: -1 | 1) => void;
  publish: () => Promise<Ranking>; publishMood: () => Promise<Ranking>;
  refresh: () => Promise<void>; loadPost: (id: string) => Promise<void>; deletePost: (id: string) => Promise<void>;
  toggleReaction: (id: string) => Promise<void>; addComment: (id: string, text: string, itemId?: string, parentId?: string) => Promise<void>;
  deleteComment: (id: string) => Promise<void>; commentsFor: (id: string) => Ranking['comments']; toggleFollow: (handle: string) => Promise<void>;
  blockUser: (handle: string, unblock?: boolean) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginOtp: (challenge: string, code: string) => Promise<void>;
  register: (input: { email: string; password: string; name: string; handle: string; challenge?: string; code?: string }) => Promise<void>;
  logout: () => Promise<void>; updateProfile: (name: string, bio: string, status?: string, avatar?: string) => Promise<void>;
  completeOnboarding: (artists: MusicItem[], complete?: boolean) => Promise<void>;
  toggleSavedItem: (item: MusicItem) => Promise<void>; toggleSavedPost: (id: string) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  config: ServerConfig | null;
  /** Remembers an item so its page can render instantly before the server responds. */
  rememberItem: (item: MusicItem) => void; itemFor: (id: string) => MusicItem | undefined;
  ratingFor: (itemId: string) => Rating | undefined;
  rate: (input: { item: MusicItem; tier: Tier; position: number; review: string; visibility: Ranking['visibility'] }) => Promise<Ranking>;
  savePod: (input: PodInput) => Promise<Ranking>;
  contribute: (postId: string, item: MusicItem) => Promise<void>; removeFromPod: (postId: string, itemId: string) => Promise<void>;
};
const Context = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Ranking[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Profile[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [savedItems, setSavedItems] = useState<MusicItem[]>([]), [savedPostIds, setSavedPostIds] = useState<string[]>([]);
  const [config, setConfig] = useState<ServerConfig | null>(null);
  const items = useRef(new Map<string, MusicItem>());
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [moodDraft, setMoodDraft] = useState<MoodDraft>(emptyMood);
  const [takeDraft, setTakeDraft] = useState<TakeDraft>(emptyTake);
  const [archivedDrafts, setArchivedDrafts] = useState<LocalState['archivedDrafts']>([]);
  const [archivedTakes, setArchivedTakes] = useState<LocalState['archivedTakes']>([]);
  const [archivedMoods, setArchivedMoods] = useState<LocalState['archivedMoods']>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loadedScope, setLoadedScope] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState('');
  const [unread, setUnread] = useState(0);
  const generation = useRef(0);
  const persistQueue = useRef(Promise.resolve());
  const refreshPromise = useRef<Promise<void> | null>(null);
  const guestDraft = useRef<LocalState | null>(null);
  const userId = user?.id;

  const resetRemote = useCallback(() => { setPosts([]); setPeople([]); setFollowing([]); setBlocks([]); setRatings([]); setSavedItems([]); setSavedPostIds([]); setSpotifyConnected(false); setUnread(0); }, []);
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
        setPosts(data.posts); setPeople(data.people); setFollowing(data.following); setBlocks(data.blocks); setRatings(data.ratings || []); setConnected(true);
        setSavedItems(data.savedItems || []); setSavedPostIds(data.savedPostIds || []);
        if (userId) {
          const [me, activity] = await Promise.all([
            api<{ user: Profile; spotifyConnected: boolean }>('/me'),
            api<{ notifications: AppNotification[] }>('/notifications').catch(() => null),
          ]);
          if (current === generation.current) {
            setUser(me.user); setSpotifyConnected(me.spotifyConnected);
            if (activity) setUnread(activity.notifications.filter((n) => !n.seen).length);
          }
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
        const carryRanking = !!(carried.draft.title || carried.draft.items.length);
        const carryMood = !!(carried.moodDraft.title || carried.moodDraft.items.length || carried.moodDraft.tiles.length);
        const carryTake = !!(carried.takeDraft.title || carried.takeDraft.items.length);
        setDraft(carryRanking ? carried.draft : saved?.draft ?? emptyDraft);
        setMoodDraft(carryMood ? carried.moodDraft : saved?.moodDraft ?? emptyMood);
        setTakeDraft(carryTake ? carried.takeDraft : saved?.takeDraft ?? emptyTake);
        setArchivedDrafts([...(carryRanking && saved?.draft && (saved.draft.title || saved.draft.items.length) ? [{ id: `draft-${Date.now()}`, draft: saved.draft }] : []), ...(saved?.archivedDrafts || []), ...carried.archivedDrafts]);
        setArchivedTakes([...(carryTake && saved?.takeDraft && (saved.takeDraft.title || saved.takeDraft.items.length) ? [{ id: `take-${Date.now()}`, draft: saved.takeDraft }] : []), ...(saved?.archivedTakes || []), ...carried.archivedTakes]);
        setArchivedMoods([...(carryMood && saved?.moodDraft && (saved.moodDraft.title || saved.moodDraft.items.length || saved.moodDraft.tiles.length) ? [{ id: `mood-${Date.now()}`, draft: saved.moodDraft }] : []), ...(saved?.archivedMoods || []), ...carried.archivedMoods]);
        return;
      }
      setDraft(saved?.draft && Array.isArray(saved.draft.items) ? saved.draft : emptyDraft);
      setMoodDraft(saved?.moodDraft && Array.isArray(saved.moodDraft.tiles) ? saved.moodDraft : emptyMood);
      setTakeDraft(saved?.takeDraft && Array.isArray(saved.takeDraft.items) ? saved.takeDraft : emptyTake);
      setArchivedDrafts(Array.isArray(saved?.archivedDrafts) ? saved.archivedDrafts : []);
      setArchivedTakes(Array.isArray(saved?.archivedTakes) ? saved.archivedTakes : []);
      setArchivedMoods(Array.isArray(saved?.archivedMoods) ? saved.archivedMoods : []);
    }).catch(() => { if (active) { setDraft(emptyDraft); setMoodDraft(emptyMood); setTakeDraft(emptyTake); setArchivedDrafts([]); setArchivedTakes([]); setArchivedMoods([]); setNotice('Your saved drafts could not be read.'); } }).finally(() => { if (active) setLoadedScope(scope); });
    return () => { active = false; };
  }, [user?.id, hydrated]);

  useEffect(() => {
    if (loadedScope !== (user?.id || 'guest')) return;
    const key = `margin-drafts-v2:${loadedScope}`;
    const data = JSON.stringify({ draft, moodDraft, takeDraft, archivedDrafts, archivedTakes, archivedMoods });
    persistQueue.current = persistQueue.current.then(() => AsyncStorage.setItem(key, data)).catch(() => setNotice('Draft could not be saved on this device. Keep the app open and try again.'));
  }, [draft, moodDraft, takeDraft, archivedDrafts, archivedTakes, archivedMoods, loadedScope, user?.id]);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { clearInterval(timer); listener.remove(); };
    // Refresh only when the account changes, not on profile updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hydrated]);

  // Server capabilities (which catalogs and Spotify features are on); retried once the server is reachable.
  useEffect(() => { if (connected && !config) api<ServerConfig>('/config').then(setConfig).catch(() => {}); }, [connected, config]);

  const acceptSession = useCallback(async (result: { token: string; user: Profile }) => {
    if (!user && (draft.title || draft.items.length || moodDraft.title || moodDraft.tiles.length || moodDraft.items.length || takeDraft.title || takeDraft.items.length)) guestDraft.current = { draft, moodDraft, takeDraft, archivedDrafts, archivedTakes, archivedMoods };
    generation.current++; refreshPromise.current = null; resetRemote();
    await storeToken(result.token); setUser(result.user); setNotice('');
  }, [resetRemote, user, draft, moodDraft, takeDraft, archivedDrafts, archivedTakes, archivedMoods]);
  const login = useCallback(async (email: string, password: string) => acceptSession(await api('/auth/login', { method: 'POST', body: { email, password } })), [acceptSession]);
  const loginOtp = useCallback(async (challenge: string, code: string) => acceptSession(await api('/auth/otp/verify', { method: 'POST', body: { challenge, code } })), [acceptSession]);
  const register = useCallback(async (input: { email: string; password: string; name: string; handle: string; challenge?: string; code?: string }) => {
    // Someone who arrived through an invite link is credited to (and follows) whoever invited them.
    const invite = await pendingInvite();
    await acceptSession(await api('/auth/register', { method: 'POST', body: { ...input, ...(invite ? { invite } : {}) } }));
    await clearInvite();
  }, [acceptSession]);
  const logout = useCallback(async () => { try { await api('/auth/logout', { method: 'POST' }); } finally { await clearSession(); } }, [clearSession]);
  const updateProfile = useCallback(async (name: string, bio: string, status?: string, avatar?: string) => { const result = await api<{ user: Profile }>('/me', { method: 'PATCH', body: { name, bio, status, avatar } }); setUser(result.user); await refresh(); }, [refresh]);
  const completeOnboarding = useCallback(async (artists: MusicItem[], complete = true) => { const result = await api<{ user: Profile }>('/me/onboarding', { method: 'PUT', body: { artists, complete } }); setUser(result.user); }, []);
  const toggleSavedItem = useCallback(async (item: MusicItem) => {
    const current = generation.current, saved = savedItems.some((pick) => pick.id === item.id);
    await api(`/library/items/${encodeURIComponent(item.id)}`, { method: saved ? 'DELETE' : 'PUT', body: saved ? undefined : { item } });
    if (current === generation.current) setSavedItems((list) => saved ? list.filter((pick) => pick.id !== item.id) : [item, ...list]);
  }, [savedItems]);
  const toggleSavedPost = useCallback(async (id: string) => {
    const current = generation.current, saved = savedPostIds.includes(id);
    await api(`/library/posts/${id}`, { method: saved ? 'DELETE' : 'PUT' });
    if (current === generation.current) setSavedPostIds((list) => saved ? list.filter((postId) => postId !== id) : [id, ...list]);
  }, [savedPostIds]);
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
  const openTakeDraft = useCallback((id: string) => {
    const entry = archivedTakes.find((v) => v.id === id); if (!entry) return;
    setArchivedTakes((v) => [...(takeDraft.title || takeDraft.items.length ? [{ id: `take-${Date.now()}`, draft: takeDraft }] : []), ...v.filter((t) => t.id !== id)]);
    setTakeDraft(entry.draft);
  }, [archivedTakes, takeDraft]);
  const openMoodDraft = useCallback((id: string) => {
    const entry = archivedMoods.find((v) => v.id === id); if (!entry) return;
    setArchivedMoods((v) => [...(moodDraft.title || moodDraft.items.length || moodDraft.tiles.length ? [{ id: `mood-${Date.now()}`, draft: moodDraft }] : []), ...v.filter((t) => t.id !== id)]);
    setMoodDraft(entry.draft);
  }, [archivedMoods, moodDraft]);
  const addMusic = useCallback((item: MusicItem) => setDraft((v) => v.items.some((i) => i.id === item.id) || v.items.length >= 100 ? v : { ...v, items: [...v.items, item] }), []);
  const removeMusic = useCallback((id: string) => setDraft((v) => ({ ...v, items: v.items.filter((i) => i.id !== id) })), []);
  const moveMusic = useCallback((index: number, direction: -1 | 1) => setDraft((v) => { const dest = index + direction; if (dest < 0 || dest >= v.items.length) return v; const items = [...v.items]; [items[index], items[dest]] = [items[dest], items[index]]; return { ...v, items }; }), []);
  const replacePost = useCallback((post: Ranking) => setPosts((v) => v.some((p) => p.id === post.id) ? v.map((p) => p.id === post.id ? post : p) : [post, ...v]), []);
  const startTake = useCallback((post?: Ranking, poll?: boolean) => {
    if (post) setTakeDraft({ title: post.title, items: post.items, poll: !!post.poll, visibility: post.visibility, editingId: post.id });
    else if (poll !== undefined) setTakeDraft((v) => v.editingId ? { ...emptyTake, poll } : { ...v, poll, items: v.items.slice(0, poll ? 2 : 1) });
  }, []);
  const publishTake = useCallback(async () => {
    if (!user) throw new ApiError('Sign in to publish. Your draft is saved.', 401);
    const { editingId, ...body } = takeDraft;
    const result = await api<{ post: Ranking }>(editingId ? `/posts/${editingId}` : '/posts', { method: editingId ? 'PUT' : 'POST', body: { ...body, kind: 'take' } });
    replacePost(result.post); setTakeDraft(emptyTake); return result.post;
  }, [takeDraft, user, replacePost]);
  const vote = useCallback(async (id: string, choice: 0 | 1 | null) => {
    const result = await api<{ post: Ranking }>(`/posts/${id}/vote`, { method: choice === null ? 'DELETE' : 'PUT', body: choice === null ? undefined : { choice } });
    replacePost(result.post);
  }, [replacePost]);
  const savePost = useCallback(async (body: Draft | MoodDraft, kind: 'ranking' | 'moodboard') => {
    if (!user) throw new ApiError('Sign in before publishing. Your draft is saved.', 401);
    const data = await api<{ post: Ranking }>(body.editingId ? `/posts/${body.editingId}` : '/posts', { method: body.editingId ? 'PUT' : 'POST', body: { ...body, kind } });
    replacePost(data.post); return data.post;
  }, [user, replacePost]);
  const publish = useCallback(async () => { const post = await savePost(draft, 'ranking'); setDraft(emptyDraft); return post; }, [draft, savePost]);
  const publishMood = useCallback(async () => { const post = await savePost(moodDraft, 'moodboard'); setMoodDraft(emptyMood); return post; }, [moodDraft, savePost]);
  // Changing the viewer also revalidates any mounted detail/share screens. Ignore late replies
  // from the previous session, so an account change cannot restore its private posts.
  const loadPost = useCallback(async (id: string) => {
    if (sampleRankings.some((p) => p.id === id)) return;
    const current = generation.current;
    const data = await api<{ post: Ranking }>(`/posts/${id}`);
    if (current !== generation.current) return;
    if (!userId && data.post.visibility !== 'public') throw new ApiError('This post isn’t available.', 404);
    replacePost(data.post);
  }, [replacePost, userId]);
  const deletePost = useCallback(async (id: string) => {
    await api(`/posts/${id}`, { method: 'DELETE' }); setPosts((v) => v.filter((p) => p.id !== id));
    if (ratings.some((r) => r.postId === id)) { const data = await api<SyncData>('/sync').catch(() => null); if (data) setRatings(data.ratings || []); }
  }, [ratings]);
  const toggleReaction = useCallback(async (id: string) => {
    const p = posts.find((v) => v.id === id) || (await api<{ post: Ranking }>(`/posts/${id}`)).post;
    const result = await api<{ post: Ranking }>(`/posts/${id}/reaction`, { method: p.reacted ? 'DELETE' : 'PUT' }); replacePost(result.post);
  }, [posts, replacePost]);
  const addComment = useCallback(async (id: string, text: string, itemId?: string, parentId?: string) => { const r = await api<{ post: Ranking }>(`/posts/${id}/comments`, { method: 'POST', body: { text, itemId, parentId } }); replacePost(r.post); }, [replacePost]);
  const deleteComment = useCallback(async (id: string) => { await api(`/comments/${id}`, { method: 'DELETE' }); await refresh(); }, [refresh]);
  const toggleFollow = useCallback(async (handle: string) => { await api(`/people/${handle.replace('@', '')}/follow`, { method: following.includes(handle) ? 'DELETE' : 'PUT' }); await refresh(); }, [following, refresh]);
  const blockUser = useCallback(async (handle: string, unblock = false) => { await api(`/people/${handle.replace('@', '')}/block`, { method: unblock ? 'DELETE' : 'PUT' }); await refresh(); }, [refresh]);
  const rememberItem = useCallback((item: MusicItem) => { items.current.set(item.id, item); }, []);
  const ratingFor = useCallback((itemId: string) => ratings.find((r) => r.item.id === itemId), [ratings]);
  const itemFor = useCallback((id: string) => items.current.get(id) ?? ratings.find((r) => r.item.id === id)?.item, [ratings]);
  const rate = useCallback(async (input: { item: MusicItem; tier: Tier; position: number; review: string; visibility: Ranking['visibility'] }) => {
    if (!user) throw new ApiError('Sign in to save your rating.', 401);
    const { color: _color, addedBy: _addedBy, ...item } = input.item;
    const result = await api<{ rating: Rating; post: Ranking }>('/ratings', { method: 'POST', body: { ...input, item } });
    replacePost(result.post); rememberItem(result.rating.item);
    // Other scores in the same category shift when an item is inserted, so reload the whole list.
    const data = await api<SyncData>('/sync').catch(() => null);
    if (data) setRatings(data.ratings || []);
    return result.post;
  }, [user, replacePost, rememberItem]);
  const savePod = useCallback(async ({ editingId, ...body }: PodInput) => {
    if (!user) throw new ApiError('Sign in before publishing a pod.', 401);
    const data = await api<{ post: Ranking }>(editingId ? `/posts/${editingId}` : '/posts', { method: editingId ? 'PUT' : 'POST', body: { ...body, kind: 'pod' } });
    replacePost(data.post); return data.post;
  }, [user, replacePost]);
  const contribute = useCallback(async (postId: string, item: MusicItem) => {
    const { color: _color, addedBy: _addedBy, ...clean } = item;
    replacePost((await api<{ post: Ranking }>(`/posts/${postId}/items`, { method: 'POST', body: { item: clean } })).post);
  }, [replacePost]);
  const removeFromPod = useCallback(async (postId: string, itemId: string) => {
    replacePost((await api<{ post: Ranking }>(`/posts/${postId}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE' })).post);
  }, [replacePost]);
  const allRankings = useMemo(() => user ? posts : [...posts, ...sampleRankings], [posts, user]);
  const rankings = useMemo(() => posts.filter((p) => p.userId === user?.id), [posts, user?.id]);
  const reactions = useMemo(() => posts.filter((p) => p.reacted).map((p) => p.id), [posts]);
  const commentsFor = useCallback((id: string) => allRankings.find((p) => p.id === id)?.comments || [], [allRankings]);
  const value: AppValue = { user, posts, people, following, blocks, draft, moodDraft, takeDraft, setTakeDraft, startTake, publishTake, vote, archivedDrafts, archivedTakes, archivedMoods, openTakeDraft, openMoodDraft, hydrated,
    rankings, reactions, allRankings, spotifyConnected, refreshing, connected, notice, unread, setUnread, setNotice, setDraft, setMoodDraft,
    startDraft, editRanking, startMood, openDraft, addMusic, removeMusic, moveMusic, publish, publishMood, refresh, loadPost,
    deletePost, toggleReaction, addComment, deleteComment, commentsFor, toggleFollow, blockUser, login, loginOtp, register, logout, updateProfile, completeOnboarding, deleteAccount,
    ratings, savedItems, savedPostIds, toggleSavedItem, toggleSavedPost, config, rememberItem, itemFor, ratingFor, rate, savePod, contribute, removeFromPod,
  };
  const ready = hydrated && loadedScope === (user?.id || 'guest');
  const { c } = useTheme();
  // Hold the native splash until the session and drafts are known, so launch never flashes a spinner.
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  // Keep the navigator mounted during account changes. An opaque, inaccessible overlay prevents
  // the previous account's drafts from flashing while the next account's local state is restored.
  return <Context.Provider value={value}>{hydrated ? <View style={{ flex: 1 }}>
    <View style={{ flex: 1 }} pointerEvents={ready ? 'auto' : 'none'} accessibilityElementsHidden={!ready} importantForAccessibility={ready ? 'auto' : 'no-hide-descendants'}>{children}</View>
    {!ready && <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]} />}
  </View> : <View style={{ flex: 1, backgroundColor: c.bg }} />}</Context.Provider>;
}
export function useApp() { const value = useContext(Context); if (!value) throw new Error('AppProvider is missing'); return value; }
