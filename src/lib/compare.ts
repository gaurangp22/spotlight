import { MusicItem } from './types';

export function compareRankings(a: MusicItem[], b: MusicItem[]) {
  const aIds = a.map((item) => item.id);
  const bIds = b.map((item) => item.id);
  const common = aIds.filter((id) => bIds.includes(id));
  if (common.length < 2) return { agreement: common.length === 1 ? 100 : 0, biggest: null as MusicItem | null, common: common.length };
  const bCommon = bIds.filter((id) => common.includes(id));
  const positions = common.map((id) => ({ id, distance: Math.abs(common.indexOf(id) - bCommon.indexOf(id)) }));
  // Maximum Spearman footrule distance for a permutation of n shared picks.
  const maxDistance = Math.floor(common.length * common.length / 2);
  const totalDistance = positions.reduce((sum, item) => sum + item.distance, 0);
  const agreement = Math.max(0, Math.round(100 * (1 - totalDistance / maxDistance)));
  const biggestPosition = positions.sort((x, y) => y.distance - x.distance)[0];
  const biggestId = biggestPosition?.distance ? biggestPosition.id : undefined;
  return { agreement, biggest: a.find((item) => item.id === biggestId) ?? null, common: common.length };
}
