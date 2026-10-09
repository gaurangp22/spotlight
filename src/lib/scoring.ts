// Client mirror of the server's scoring, used to preview a score before it's saved.
const TIER_RANGE: Record<0 | 1 | 2, [number, number]> = { 2: [6.8, 10], 1: [3.4, 6.7], 0: [0, 3.3] };
export function tierScores(tier: 0 | 1 | 2, count: number) {
  const [lo, hi] = TIER_RANGE[tier];
  return Array.from({ length: count }, (_, i) => Math.round((lo + (hi - lo) * (count - i) / count) * 10) / 10);
}

/**
 * Binary insertion into a best-first list: each answer halves the range, so placing an item
 * among n others takes about log2(n) comparisons.
 */
export type Insertion = { lo: number; hi: number };
export const startInsertion = (count: number): Insertion => ({ lo: 0, hi: count });
export const isSettled = (s: Insertion) => s.lo >= s.hi;
export const pivot = (s: Insertion) => Math.floor((s.lo + s.hi) / 2);
/** `better`: the new item beats the item at the pivot. `tie`: place it directly above the pivot. */
export function answer(s: Insertion, choice: 'better' | 'worse' | 'tie'): Insertion {
  const mid = pivot(s);
  if (choice === 'tie') return { lo: mid, hi: mid };
  return choice === 'better' ? { lo: s.lo, hi: mid } : { lo: mid + 1, hi: s.hi };
}
export const comparisonsLeft = (s: Insertion) => (isSettled(s) ? 0 : Math.ceil(Math.log2(s.hi - s.lo + 1)));
