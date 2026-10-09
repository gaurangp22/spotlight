export type MusicKind = 'song' | 'album' | 'artist' | 'movie' | 'show' | 'podcast' | 'book';

/** Anything people can rate: a song, an album, a film… `artist` holds the creator or a short descriptor. */
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
  previewUrl?: string;
  /** In a pod, the handle of the person who contributed this item. */
  addedBy?: string;
};

export type Comment = { id: string; author: string; handle?: string; avatar?: string; bot?: boolean; text: string; itemId?: string; parentId?: string; userId?: string; createdAt?: string };
export type Profile = { id: string; handle: string; name: string; bio: string; bot?: boolean; status?: string; avatar?: string; favoriteArtists?: MusicItem[]; onboardingComplete?: boolean; followers?: number; following?: number };
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
  avatar?: string;
  /** Posted by a Riffs house bot; always shown with a Bot label. */
  authorBot?: boolean;
  clubId?: string;
  sourceUrl?: string;
  kind?: 'ranking' | 'moodboard' | 'review' | 'pod' | 'take';
  poll?: { total: number; mine: 0 | 1 | null; counts: [number, number] | null };
  tiles?: MoodTile[];
  theme?: 'night' | 'paper' | 'rose' | 'forest';
  reacted?: boolean;
  updatedAt?: string;
  /** Reviews: the author's current score for the item and the tier it sits in. */
  score?: number;
  tier?: Tier;
  /** Pods: whether other people can add to it. */
  open?: boolean;
};

/** Gut reaction: 2 loved it, 1 it was fine, 0 not for me. */
export type Tier = 0 | 1 | 2;
export type Rating = {
  item: MusicItem; category: MusicKind; tier: Tier; position: number; score: number;
  postId: string; review: string; visibility: Ranking['visibility']; createdAt: string; updatedAt: string;
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
export type TakeDraft = { title: string; items: MusicItem[]; poll: boolean; visibility: Ranking['visibility']; editingId?: string };
export type SharedArtist = { name: string; artwork?: string };
export type TasteMatch = { percent: number | null; shared: { item: MusicItem; mine: number; theirs: number }[]; sharedArtists: SharedArtist[] };
export type TasteTwins = { twins: { user: Profile; percent: number; sharedArtists: SharedArtist[] }[]; needed: number };
export type AppNotification = { id: string; name: string; handle: string; avatar?: string; postId?: string; kind: 'comment' | 'reaction' | 'follow' | 'contribution' | 'reply' | 'mention' | 'club' | 'joined'; seen: boolean; createdAt: string };
export type ListeningClub = { id: string; name: string; description: string; ownerId: string; owner: string; handle: string; avatar?: string; members: number; joined: boolean; createdAt: string };
export type ServerConfig = {
  signupVerification?: boolean; push?: boolean;
  spotify: boolean; spotifyCatalog: boolean; passwordRecovery: boolean; emailOtp: boolean;
  catalog: { artist: boolean; movie: boolean; show: boolean; book: boolean };
};
export type Conversation = { id: string; kind: 'direct' | 'group'; name: string; ownerId: string; members: Profile[]; unread: number; lastMessage?: { sender: string; text: string; createdAt: string } | null };
export type Message = { id: string; sequence: number; sender: Profile; text: string; item: MusicItem | null; post: Ranking | null; deleted: boolean; createdAt: string };
