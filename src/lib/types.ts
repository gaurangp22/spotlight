export type MusicKind = 'song' | 'album';

export type MusicItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  kind: MusicKind;
  color?: string;
};

export type Comment = { id: string; author: string; text: string; itemId?: string };

export type Ranking = {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  handle: string;
  items: MusicItem[];
  createdAt: string;
  visibility: 'public' | 'followers' | 'private';
  reactionCount: number;
  comments: Comment[];
  originId?: string;
  isSample?: boolean;
};

export type Draft = {
  title: string;
  subtitle: string;
  items: MusicItem[];
  visibility: Ranking['visibility'];
  originId?: string;
};
