import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Comment, Draft, MusicItem, Ranking } from '../lib/types';
import { sampleRankings } from '../lib/sample';
import { C } from '../ui/theme';

const STORAGE_KEY = 'margin-prototype-v1';
const emptyDraft: Draft = { title: '', subtitle: '', items: [], visibility: 'public' };

type SavedState = { rankings: Ranking[]; draft: Draft; archivedDrafts: { id: string; draft: Draft }[]; reactions: string[]; following: string[]; extraComments: Record<string, Comment[]> };
type AppContextValue = SavedState & {
  hydrated: boolean;
  allRankings: Ranking[];
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  startDraft: (origin?: Ranking) => void;
  openDraft: (id: string) => void;
  addMusic: (item: MusicItem) => void;
  removeMusic: (id: string) => void;
  moveMusic: (index: number, direction: -1 | 1) => void;
  publish: () => Ranking | null;
  toggleReaction: (id: string) => void;
  commentsFor: (id: string) => Comment[];
  addComment: (id: string, text: string, itemId?: string) => void;
  toggleFollow: (handle: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [archivedDrafts, setArchivedDrafts] = useState<SavedState['archivedDrafts']>([]);
  const [reactions, setReactions] = useState<string[]>([]);
  const [following, setFollowing] = useState<string[]>(['@mandi', '@ayush']);
  const [extraComments, setExtraComments] = useState<Record<string, Comment[]>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw) as Partial<SavedState>;
        setRankings(saved.rankings ?? []);
        setDraft(saved.draft ?? emptyDraft);
        setArchivedDrafts(saved.archivedDrafts ?? []);
        setReactions(saved.reactions ?? []);
        setFollowing(saved.following ?? ['@mandi', '@ayush']);
        setExtraComments(saved.extraComments ?? {});
      }
    }).catch(() => {}).finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ rankings, draft, archivedDrafts, reactions, following, extraComments })).catch(() => {});
  }, [rankings, draft, archivedDrafts, reactions, following, extraComments, hydrated]);

  const startDraft = useCallback((origin?: Ranking) => {
    if (draft.items.length || draft.title.trim()) setArchivedDrafts((current) => [{ id: `draft-${Date.now()}`, draft }, ...current]);
    setDraft(origin ? {
      title: origin.title, subtitle: origin.subtitle ?? '', items: [...origin.items].sort((a, b) => a.title.localeCompare(b.title)),
      visibility: 'public', originId: origin.id,
    } : emptyDraft);
  }, [draft]);

  const openDraft = useCallback((id: string) => {
    const chosen = archivedDrafts.find((entry) => entry.id === id);
    if (!chosen) return;
    setArchivedDrafts((current) => [
      ...(draft.items.length || draft.title.trim() ? [{ id: `draft-${Date.now()}`, draft }] : []),
      ...current.filter((entry) => entry.id !== id),
    ]);
    setDraft(chosen.draft);
  }, [archivedDrafts, draft]);

  const addMusic = useCallback((item: MusicItem) => {
    setDraft((current) => current.items.some((existing) => existing.id === item.id)
      ? current : { ...current, items: [...current.items, item] });
  }, []);

  const removeMusic = useCallback((id: string) => {
    setDraft((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  }, []);

  const moveMusic = useCallback((index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.items.length) return current;
      const items = [...current.items];
      [items[index], items[destination]] = [items[destination], items[index]];
      return { ...current, items };
    });
  }, []);

  const publish = useCallback(() => {
    if (!draft.title.trim() || draft.items.length < 2) return null;
    const ranking: Ranking = {
      id: `rank-${Date.now()}`, title: draft.title.trim(), subtitle: draft.subtitle.trim(),
      author: 'You', handle: '@you', items: [...draft.items], createdAt: 'Just now',
      visibility: draft.visibility, reactionCount: 0, comments: [], originId: draft.originId,
    };
    setRankings((current) => [ranking, ...current]);
    setDraft(emptyDraft);
    return ranking;
  }, [draft]);

  const toggleReaction = useCallback((id: string) => {
    setReactions((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]);
  }, []);

  const addComment = useCallback((id: string, text: string, itemId?: string) => {
    const comment = { id: `comment-${Date.now()}`, author: 'You', text: text.trim(), itemId };
    setRankings((current) => current.map((ranking) => ranking.id === id ? { ...ranking, comments: [...ranking.comments, comment] } : ranking));
    if (sampleRankings.some((ranking) => ranking.id === id)) setExtraComments((current) => ({ ...current, [id]: [...(current[id] ?? []), comment] }));
  }, []);

  const toggleFollow = useCallback((handle: string) => {
    setFollowing((current) => current.includes(handle) ? current.filter((entry) => entry !== handle) : [...current, handle]);
  }, []);

  const allRankings = useMemo(() => [...rankings, ...sampleRankings], [rankings]);
  const commentsFor = useCallback((id: string) => [...(allRankings.find((ranking) => ranking.id === id)?.comments ?? []), ...(extraComments[id] ?? [])], [allRankings, extraComments]);
  const value = useMemo(() => ({ rankings, draft, archivedDrafts, reactions, following, hydrated, allRankings,
    extraComments, setDraft, startDraft, openDraft, addMusic, removeMusic, moveMusic, publish, toggleReaction, commentsFor, addComment, toggleFollow,
  }), [rankings, draft, archivedDrafts, reactions, following, extraComments, hydrated, allRankings, startDraft, openDraft, addMusic, removeMusic, moveMusic, publish, toggleReaction, commentsFor, addComment, toggleFollow]);

  return <AppContext.Provider value={value}>{hydrated ? children : <View style={{ flex: 1, backgroundColor: C.paper, alignItems: 'center', justifyContent: 'center', gap: 18 }}><Text style={{ fontSize: 28, fontWeight: '900', color: C.ink }}>MARGIN.</Text><ActivityIndicator color={C.accent} /></View>}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('AppProvider is missing');
  return context;
}
