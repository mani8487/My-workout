/** Small helpers for showing and reading numbers. Kilos only. */

/** 60 -> "60", 62.5 -> "62.5", 61.25 -> "61.25" */
export function formatKg(kg: number | null | undefined): string {
  if (kg == null) return '';
  return String(Math.round(kg * 100) / 100);
}

/** Reads what you typed in a weight box. Accepts "62,5" as well as "62.5". */
export function parseKg(text: string): number | null {
  const cleaned = text.replace(',', '.').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

/** Reads what you typed in a reps box. */
export function parseReps(text: string): number | null {
  const cleaned = text.trim();
  if (cleaned === '') return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** "60 × 8", or "—" if there's nothing. */
export function formatSet(weightKg: number | null, reps: number | null): string {
  if (reps == null) return '—';
  return weightKg ? `${formatKg(weightKg)} × ${reps}` : `BW × ${reps}`;
}
