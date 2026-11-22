# WorkoutTracker: Progress

_Last updated: 21 Nov 2026_

A personal iPhone workout tracker built with **Expo (React Native, SDK 58)** on Windows, tested on iPhone in **Expo Go**. Kilos only. Logging works fully offline (on-phone SQLite); only the optional Friends features go online (Supabase).

## How to run

| What | How |
|---|---|
| Dev server (home Wi-Fi) | `npx.cmd expo start` in `C:\dev\WorkoutTracker`, then open **WorkoutTracker** (192.168… entry) in Expo Go |
| Published version (anywhere with internet) | `eas update --branch main --platform ios --message "…"`, then scan the update's QR code / open its `exp://u.expo.dev/<project>/group/<id>` link |
| Checks | `npx tsc --noEmit` · `npx eslint .` · `npx expo export --platform ios` |
| Friends keys | `.env.local` (gitignored) with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`) |

## What's been built

### Version 1 (steps 0–11, on `master`)
- **Data:** SQLite with numbered upgrades (`src/db/migrations.ts`). Every set is saved the instant it's ticked. History keeps its own copy of names and targets.
- **Exercise library** (56 built-in, plus custom exercises) and a **plan editor** (sets, rep range, rest, ▲/▼ reorder).
- **Active Workout:** set table with the previous result, a weight suggestion and a "last time" card, warm-up tag (long-press), per-set notes, reps-in-reserve chips, edit / swipe-to-delete, Add Set, an automatic rest timer that survives phone lock (saved end time plus a notification), and a −/+ stepper above the number pad.
- **Weight suggestion rule:** if you hit the top of the rep range on every working set, it suggests a small increase. Only an earlier set logged as 0 reps left holds the increase back.
- **Workout Progress** (jump to an exercise, swap with same-muscle suggestions, "X sets left, finish anyway?"), **Finish Summary** (working sets, duration, weight and rep PRs, rotation line).
- **Rotation:** first workout still to do in the cycle ("Up next"); skipped workouts stay owed; a 3-week "Welcome back" fresh start at about 10% lighter weights; warm-up sets for the first exercise.
- **History** (filter, month groups, session detail and editing, log a forgotten workout) and **Progress** (top weight / volume / est. 1RM charts, records, sets per muscle).
- **Routines:** separate plans, each with its own rotation, one active at a time. Switching starts a fresh cycle. Three starter routines are loaded: PPL + Upper/Lower, Upper/Lower, Full Body. You can add, rename and delete routines and workouts.
- **Themes:** Dark (steel and brass), Light, **Frost** (Manrope font, gradient background, glass cards, pill shapes), and Auto. Colours are named roles (`src/theme/colors.ts`).
- **Home (Frost design):** greeting, week strip, hero workout card, "Your plans" scroller.

### Phase 1: tappable date strip (PR #1, `feature/date-strip`)
- Tap any day; swipe for previous / next week; a **Today** button jumps back.
- Markers: filled = done, outline = planned, none = rest, red dash = missed.
- The card follows the selected day: completed summary, planned workout (Start only on the day itself), rest day, or "No workout logged".
- Future days are projected from the rotation onto training days (3 = Mon/Wed/Fri, 4 = Mon/Tue/Thu/Fri, 5 = Mon–Fri). Change Workout can reschedule a day or make it a rest day.
- Set up ESLint and fixed what it found.

### Phase 2: week calendar (PR #2, `feature/week-calendar`)
- Calendar button beside settings on Home, opening the **Week Schedule** (Mon–Sun cards with a Done / Today / Upcoming / Rest / Missed badge and week arrows).

### Phase 3: friends and competition (PR #3, `feature/friends`)
- Supabase backend (`supabase/schema.sql`): profiles with 6-letter friend codes, friendships, weekly stats, shared plans and challenges, all protected by row-level security.
- **More → Friends:** sign in with email + password, copy / share your friend code, add a friend by code, a weekly leaderboard (workouts / kilos / week streak), challenges, and sending or receiving plans.
- "Share my weekly stats" switch (off deletes your summaries from the server). Only summaries leave the phone.
- Verified against the live project with throwaway accounts, which were then deleted.

### Calendar animation (PR #4, `feature/calendar-animation`)
- Week Schedule rebuilt as a **snapping focus wheel** (from the user's reference video). The middle day morphs from a circle into a big card; tapping it expands to full screen.

### Polish (PR #5, `feature/polish`)
- **Custom number pad** (`src/components/number-pad.tsx`) replaces the iPhone keyboard for kg / reps: big keys, −/+ steppers, Next (kg → reps), Done; it scrolls the open box above itself. Notes still use the normal keyboard.
- **Tick-draw** checkmark (`animated-tick.tsx`) and a green **row wipe** when a set is ticked.
- **Animated progress ring** (rest timer) that sweeps between values.
- **Drag-to-reorder** in the plan editor (`drag-list.tsx`): hold the ≡ handle, then drag. VoiceOver can move items up / down.
- **Skeleton loading screens** (`skeleton.tsx`) instead of blank screens on Home, Active Workout, Preview, Overview, Summary and Session detail.

### Swap and hardening (PR #6, `fix/swap-and-hardening`)
- **Mid-workout swap** after sets are logged: ticked sets stay, the rest move to a new exercise inserted after it.
- **Crash screen** (ErrorBoundary), **friend-plan validation** (`src/logic/plan-payload.ts`), stronger passwords.
- A "Security hardening" SQL section at the end of `supabase/schema.sql` (run on the live project 21 Nov 2026).

### UI review (PR #7, `design/ui-review`)
- Workout progress bar fills by working sets ticked across the whole workout; **Next** turns solid accent once the exercise is done.
- **Tap a set number** for Mark as Warm-up / Delete Set; a one-time tip (`tip.setMenuSeen` setting) replaces the gesture hint line.
- Wider note button; "reps left" follows iPhone text size; readable placeholder grey.
- Contrast: deeper Light brass `#7F6428` (white text on it), lighter Dark red `#D25C5C`, darker Frost green `#2F7464`.
- Home: future days say "Planned for <day>" instead of a disabled Start button; new `display` text style for the greeting; links are accent text, not underlined grey.

### Motion polish (PR #8, `feature/motion-polish`)
- Based on Emil Kowalski's animate-expo and apple-design skills (read from github.com/emilkowalski/skills).
- `PressableScale`: buttons shrink to 97% on press-in (dim instead with Reduce Motion).
- Week strip swipe tracks the finger 1:1 (Gesture Handler), counts flicks, springs into place.
- Springs for the row wipe, drag-to-reorder drop and the week card; shared constants in `src/theme/motion.ts`.

### Ember theme (PR #9, `feature/ember-theme`)
- Fourth theme: true black, orange `#FF7A1A` (black text on it), iOS green for done sets, pill shapes.
- Fonts: Instrument Serif titles, Geist body, Geist Mono weights / reps (`@expo-google-fonts/*`).
- Home (Ember only): smaller serif date, Apple Fitness-style `CompactDayCard` with a round play button, "This week" tiles, "Coming up" list, small-caps section labels.

### Ember workout screen (PR #10, `feature/ember-workout`)
- Orange dot on the next set to do; bottom bar with a progress ring (exercise of total), exercise name, round Previous button and a Next / Finish capsule that turns orange once the exercise is done. Other themes keep Previous / Next.

### Audit fixes (PR #11, `fix/audit-polish`)
- From an Impeccable native audit + Taste anti-slop pass: History is a SectionList with one query for PR trophies (`getSessionIdsWithRecords`); text grows to 2x with iPhone text size (fixed cells 1.3x, `TIGHT_FONT_SCALE`); Home quote replaced by the top set of the last session of this workout; button roles / selected states for VoiceOver.
- Still open from that audit: crash screen and PR pill use fixed colours; some decorative entrance fades.

## Main files

| Area | Files |
|---|---|
| Screens | `src/app/(tabs)/index.tsx` (Home), `history.tsx`, `progress.tsx`, `more.tsx`; `src/app/workout/*` (preview, active, overview, swap, summary, change); `week.tsx`, `friends.tsx`, `session/[id].tsx`, `log-workout.tsx`, `plans.tsx`, `routine/[routineId].tsx`, `plan/*`, `library.tsx`, `exercise-new.tsx`, `plates.tsx`, `settings.tsx` |
| Logic | `src/logic/` (`schedule.ts`, `rotation.ts`, `today.ts`, `suggestion.ts`, `records.ts`, `warmup.ts`, `rest-timer.tsx`, `fresh-start.ts`, `finish.ts`, `social.ts`, `format.ts`) |
| Data | `src/db/` (`migrations.ts`, `init.ts`, `sessions.ts`, `plan.ts`, `history.ts`, `progress.ts`, `settings.ts`); `src/data/` (library, default plan, starter routines, quotes) |
| UI | `src/components/` (set row, week strip, hero, day cards, rest timer bar, PR pill, progress ring, line chart, list, page, …); `src/theme/` |
| Online | `src/lib/supabase.ts`, `supabase/schema.sql`, `.env.example` |

## Services
- **GitHub:** `mani8487/My-workout`. PRs #1–#11 are merged into `master` (#11 on 22 Nov 2026). PRs are opened through Claude in Chrome (GitHub sign-in lives in the user's Chrome).
- **Expo / EAS:** project `@mani8487/WorkoutTracker`, updates published to branch / channel `main`.
- **Supabase:** project `kczdhpranzekgswgmjuz` (free plan); email + password auth with "Confirm email" off.

## Known limitations
- **Expo Go needs internet to open** the published version, and the dev-server version needs the PC. True offline use needs an installed build.
- The "always latest" channel link didn't load new versions on the user's phone, so a fresh QR / group link is shared after each publish.
- Free Supabase email can't send sign-in codes, hence passwords. A friend needs Expo Go plus access to the Expo project until TestFlight exists.

## Next steps
1. **Done 21 Nov 2026:** the "Security hardening" SQL was run on the live Supabase project and verified (3 limits, attempts table, friendships insert revoked, anon blocked, rate limit on). Next: try adding a friend once to confirm Friends still works.
2. **Feedback on the calendar animation and the number pad**, then tweak speed and sizes.
3. **Use it at the gym for 1–2 weeks** and collect pain points (the design doc says to revisit the Finish Summary after real use).
4. **Apple Developer Program, an EAS Build and TestFlight:** a real installed app that opens offline, and easy sharing with friends.
5. **App Store preparation:** unique name and icon, first-run onboarding (pick a routine, enter your name), backup / export of data, privacy policy page, store listing and screenshots.
6. **AI progression (version 1.1):** after 4–6 weeks of real data, an online suggestion service. Keep the simple rule as the offline fallback; the API key must live on a server, never in the app.
7. **Remaining polish:** adjust whatever feels off from step 1.
