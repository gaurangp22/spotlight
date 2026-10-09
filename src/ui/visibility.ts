import { Ranking } from '../lib/types';
import { IconName } from './primitives';

export const visibilityIcon: Record<Ranking['visibility'], IconName> = { public: 'globe-outline', followers: 'people-outline', private: 'lock-closed-outline' };
export const visibilityLabel: Record<Ranking['visibility'], string> = { public: 'Public', followers: 'Followers', private: 'Only you' };
