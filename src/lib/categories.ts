import type { IconName } from '../ui/primitives';
import { MusicKind, Tier } from './types';

type Category = { label: string; plural: string; icon: IconName; tint: string; placeholder: string; empty: string };

export const categories: Record<MusicKind, Category> = {
  song: { label: 'Song', plural: 'Songs', icon: 'musical-note', tint: '#AF52DE', placeholder: 'Songs, artists', empty: 'songs' },
  album: { label: 'Album', plural: 'Albums', icon: 'disc', tint: '#FF2D55', placeholder: 'Albums, artists', empty: 'albums' },
  artist: { label: 'Artist', plural: 'Artists', icon: 'mic', tint: '#0FA3B1', placeholder: 'Artists', empty: 'artists' },
  movie: { label: 'Movie', plural: 'Movies', icon: 'film', tint: '#FF9500', placeholder: 'Movies', empty: 'movies' },
  show: { label: 'Show', plural: 'Shows', icon: 'tv', tint: '#007AFF', placeholder: 'TV shows', empty: 'shows' },
  podcast: { label: 'Podcast', plural: 'Podcasts', icon: 'radio', tint: '#FF3B30', placeholder: 'Podcasts', empty: 'podcasts' },
  book: { label: 'Book', plural: 'Books', icon: 'book', tint: '#34C759', placeholder: 'Books, authors', empty: 'books' },
};
export const allKinds = Object.keys(categories) as MusicKind[];
/** Categories shown in the app today. Riffs is music-first; the server and types still support the rest. */
export const activeKinds: MusicKind[] = ['song', 'album', 'artist'];
export const musicKinds: MusicKind[] = ['song', 'album', 'artist'];

export const tiers: { value: Tier; label: string; short: string; icon: IconName; color: string }[] = [
  { value: 2, label: 'Loved it', short: 'Loved', icon: 'heart', color: '#1E9E4A' },
  { value: 1, label: 'It was fine', short: 'Fine', icon: 'remove-circle', color: '#D97A00' },
  { value: 0, label: 'Not for me', short: 'Nope', icon: 'thumbs-down', color: '#D93025' },
];

/** Colour for a 0–10 score, matching the tier it falls in: green for loved, orange for fine, red for nope. */
export function scoreColor(score: number) {
  return score >= 6.8 ? '#1E9E4A' : score >= 3.4 ? '#D97A00' : '#D93025';
}
/** Numerals on any tier colour: bold white reads at ≥ 3:1 (large text) on all three. */
export const scoreInk = '#FFFFFF';
export const formatScore = (score: number) => (Number.isInteger(score) ? score.toFixed(0) : score.toFixed(1));
