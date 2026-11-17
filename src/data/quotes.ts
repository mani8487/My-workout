/** Short motivational lines for Home. One is picked per day. */
export const QUOTES = [
  'Show up. The rest follows.',
  'Small plates add up.',
  'Consistency beats intensity.',
  'Today’s warm-up is last month’s max.',
  'One more good set.',
  'Strong is built one session at a time.',
  'Done is better than perfect.',
  'You never regret the workout.',
  'Progress, not perfection.',
  'Earn the rest day.',
  'Lift with intent.',
  'The bar doesn’t care about excuses.',
  'Slow progress is still progress.',
  'Be stronger than last time.',
];

export function quoteOfTheDay(now = new Date()) {
  const day = Math.floor(now.getTime() / 86_400_000);
  return QUOTES[day % QUOTES.length];
}
