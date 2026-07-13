/**
 * Optimal Recognition Point — the pivot letter the eye locks onto.
 * Index by word length (per spec):
 *   1 char → 0, 2–5 → 1, 6–9 → 2, 10–13 → 3, 14+ → 4
 */
export function orpIndex(length: number): number {
  if (length <= 1) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  if (length <= 13) return 3
  return 4
}
