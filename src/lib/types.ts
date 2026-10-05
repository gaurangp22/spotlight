export type MusicKind = 'song' | 'album';

export type MusicItem = {
  id: string;
  title: string;
  artist: string;
  album?: string;
  artwork?: string;
  kind: MusicKind;
  color?: string;
  spotifyId?: string;
  externalUrl?: string;
};

export type Comment = { id: string; author: string; text: string; itemId?: string; userId?: string; createdAt?: string };
export type Profile = { id: string; handle: string; name: string; bio: string; followers?: number; following?: number };
export type MoodTile = { id: string; type: 'note' | 'photo'; text: string; uri?: string };

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
  userId?: string;
  kind?: 'ranking' | 'moodboard';
  tiles?: MoodTile[];
  theme?: 'night' | 'paper' | 'rose' | 'forest';
  reacted?: boolean;
  updatedAt?: string;
};

export type Draft = {
  title: string;
  subtitle: string;
  items: MusicItem[];
  visibility: Ranking['visibility'];
  originId?: string;
  editingId?: string;
};

export type MoodDraft = { title: string; subtitle: string; items: MusicItem[]; tiles: MoodTile[]; theme: NonNullable<Ranking['theme']>; visibility: Ranking['visibility']; editingId?: string };
export type AppNotification = { id: string; name: string; handle: string; postId?: string; kind: 'comment' | 'reaction' | 'follow'; seen: boolean; createdAt: string };
