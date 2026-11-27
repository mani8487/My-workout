/**
 * Scene Lab: a tester's bench for judging motion on the phone. Reached from
 * More → Scene Lab. Drives the Living Home room with sliders (active minutes,
 * goal, water, time of day), forces Mist light or dark and Reduce Motion on or
 * off for everything on this screen, and plays each Milo state on demand.
 *
 * Kept in release builds on purpose: it is used through published updates.
 */
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { type MiloState } from '@/components/mascot';
import { Page } from '@/components/page';
import { PressableScale } from '@/components/pressable-scale';
import { LivingScene } from '@/components/scene/living-scene';
import { MiloLine } from '@/components/scene/milo-line';
import { type CameoKind } from '@/logic/cameo';
import { nextLine, type ShownLine } from '@/logic/milo-voice';
import { minutesText, moodOf } from '@/logic/scene-state';
import { ReducedMotionOverride, useReducedMotion } from '@/motion';
import { MistPreview, useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing } from '@/theme/typography';

const STATES: { state: MiloState | null; label: string }[] = [
  { state: null, label: 'Auto' },
  { state: 'sleeping', label: 'Sleeping' },
  { state: 'stirring', label: 'Stirring' },
  { state: 'waking', label: 'Waking' },
  { state: 'sitting', label: 'Sitting' },
  { state: 'content', label: 'Content' },
  { state: 'reacting', label: 'Paw lift' },
  { state: 'celebrating', label: 'Celebrate' },
  { state: 'drinking', label: 'Drinking' },
];
const GOALS = [0, 30, 60];
const WATER_GOAL = 2000;
const EMPTY_ROOM = { stage: 0, water: 0 };

type Motion = 'system' | 'on' | 'off';

function Chip({ label, on, onPress, hint }: { label: string; on: boolean; onPress: () => void; hint?: string }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{
        minHeight: MIN_TAP,
        minWidth: MIN_TAP,
        paddingHorizontal: spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: radius.md,
        backgroundColor: on ? colors.accent : colors.card,
      }}>
      <AppText variant="label" color={on ? colors.onAccent : colors.text}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="small" muted>
        {title}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function LabSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="small" muted>
        {label}
      </AppText>
      <Slider
        accessibilityLabel={label}
        style={{ height: MIN_TAP }}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
      />
    </View>
  );
}

const clock = (h: number) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;

function LabBody({ dark, setDark, motion, setMotion }: { dark: boolean; setDark: (d: boolean) => void; motion: Motion; setMotion: (m: Motion) => void }) {
  const reduced = useReducedMotion();
  const [minutes, setMinutes] = useState(0);
  const [goal, setGoal] = useState(30);
  const [waterMl, setWaterMl] = useState(500);
  const [hour, setHour] = useState(() => Math.round(new Date().getHours() * 2) / 2);
  const [override, setOverride] = useState<MiloState | null>(null);
  const [cue, setCue] = useState(0);
  const [replay, setReplay] = useState(0);
  const [departCue, setDepartCue] = useState(0);
  const [arriveCue, setArriveCue] = useState(0);
  const [away, setAway] = useState(false);
  const [towel, setTowel] = useState(false);
  const [cameo, setCameo] = useState<{ cue: number; kinds: CameoKind[] }>({ cue: 0, kinds: [] });
  const play = (...kinds: CameoKind[]) => setCameo((c) => ({ cue: c.cue + 1, kinds }));

  // Milo's voice: the same picker Home uses. A new line whenever the situation changes or on "New line".
  const [yesterday, setYesterday] = useState(false);
  const [streak, setStreak] = useState(false);
  const [workoutDone, setWorkoutDone] = useState(false);
  const voiceCtx = {
    mood: moodOf(minutes, goal),
    activeMinutes: minutes,
    goalMinutes: goal,
    streakDays: streak ? 5 : 0,
    yesterdayMinutes: yesterday ? 42 : 0,
    workoutDoneToday: workoutDone,
  };
  // Same rule as Home: keep the line while the situation is the same (numbers update), new one otherwise.
  const [shown, setShown] = useState<ShownLine | null>(null);
  const [roll, setRoll] = useState(() => Math.random());
  const voice = nextLine(voiceCtx, 'lab', shown, false, roll);
  if (!shown || shown.id !== voice.id || shown.key !== voice.key) setShown({ id: voice.id, key: voice.key });
  const newLine = () => {
    setRoll(Math.random());
    setShown((s) => (s ? { id: s.id, key: '' } : s)); // a stale key forces a different line
  };

  const label = STATES.find((x) => x.state === override)?.label ?? 'Auto';
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(`Milo: ${label}`);
  }, [label]);

  const choose = (state: MiloState | null) => {
    // Waking only happens from lying down: the first tap lays Milo down, the next one wakes him.
    if (state === 'waking' && override !== 'sleeping' && override !== 'stirring') setOverride('sleeping');
    else setOverride(state);
    setCue((c) => c + 1);
  };

  return (
    <Page title="Scene Lab">
      <View style={{ gap: spacing.md }}>
        <View style={{ marginHorizontal: -spacing.lg }}>
          <LivingScene
            key={replay}
            activeMinutes={minutes}
            goalMinutes={goal}
            waterMl={waterMl}
            waterGoalMl={WATER_GOAL}
            hour={hour}
            from={replay > 0 ? EMPTY_ROOM : undefined}
            miloOverride={override}
            miloCue={cue}
            departCue={departCue}
            arriveCue={arriveCue}
            towel={towel}
            cameoCue={cameo.cue}
            cameoKinds={cameo.kinds}
          />
        </View>
        <View style={{ alignItems: 'center', gap: 2 }}>
          {override ? <AppText variant="label">{`Milo: ${label}`}</AppText> : <MiloLine text={voice.text} />}
          <AppText variant="small" muted>
            {minutesText(minutes, goal)} · {(waterMl / 1000).toFixed(1)} / 2 L · {clock(hour)}
            {reduced ? ' · Reduce Motion' : ''}
          </AppText>
        </View>

        <LabSlider label={`Active minutes: ${minutes}`} value={minutes} min={0} max={60} step={1} onChange={setMinutes} />
        <Row title="Daily goal (minutes)">
          {GOALS.map((g) => (
            <Chip key={g} label={String(g)} on={goal === g} onPress={() => setGoal(g)} />
          ))}
          <Chip
            label="Log 10 min"
            on={false}
            hint="Adds 10 minutes the way a real log does, with a light buzz"
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              setMinutes((m) => Math.min(60, m + 10));
            }}
          />
        </Row>
        <LabSlider label={`Water: ${waterMl} ml of ${WATER_GOAL}`} value={waterMl} min={0} max={3000} step={50} onChange={setWaterMl} />
        <LabSlider label={`Time of day: ${clock(hour)}`} value={hour} min={0} max={23.5} step={0.5} onChange={setHour} />

        <Row title="Milo's line">
          <Chip label="New line" on={false} hint="Picks another line; never the same one twice in a row" onPress={newLine} />
          <Chip label="42 min yesterday" on={yesterday} onPress={() => setYesterday((v) => !v)} />
          <Chip label="5-day streak" on={streak} onPress={() => setStreak((v) => !v)} />
          <Chip label="Workout done" on={workoutDone} onPress={() => setWorkoutDone((v) => !v)} />
        </Row>

        <Row title="Activity cameos (tap Milo to stop one)">
          <Chip label="Stretch" on={false} onPress={() => play('stretch')} />
          <Chip label="Walk" on={false} onPress={() => play('walk')} />
          <Chip label="Run" on={false} onPress={() => play('run')} />
          <Chip label="Squat" on={false} onPress={() => play('squat')} />
          <Chip
            label="3 quick logs"
            on={false}
            hint="Walk, walk and run logged at once: the two walks play once, then the run"
            onPress={() => play('walk', 'walk', 'run')}
          />
        </Row>

        <Row title="Workout start and return">
          <Chip
            label={away ? 'Come back' : 'Start workout'}
            on={false}
            hint={away ? 'Milo hops back into his spot as the room returns' : 'Plays the start move: ears perk, Milo hops off, the room eases away'}
            onPress={() => {
              if (away) setArriveCue((c) => c + 1);
              else setDepartCue((c) => c + 1);
              setAway((a) => !a);
            }}
          />
          <Chip label="Towel" on={towel} onPress={() => setTowel((t) => !t)} />
        </Row>

        <Row title="Catch-up">
          <Chip label="Replay from 0" on={false} hint="Rebuilds the room and plays the catch-up from an empty morning" onPress={() => setReplay((r) => r + 1)} />
        </Row>

        <Row title="Milo (Auto follows the minutes)">
          {STATES.map(({ state, label: l }) => (
            <Chip
              key={l}
              label={l}
              on={override === state}
              onPress={() => choose(state)}
              hint={state === 'waking' && override !== 'sleeping' && override !== 'stirring' ? 'Lays Milo down first; tap again to wake him' : undefined}
            />
          ))}
        </Row>

        <Row title="Appearance">
          <Chip label="Light" on={!dark} onPress={() => setDark(false)} />
          <Chip label="Dark" on={dark} onPress={() => setDark(true)} />
        </Row>

        <Row title="Reduce Motion">
          <Chip label="iPhone setting" on={motion === 'system'} onPress={() => setMotion('system')} />
          <Chip label="Off" on={motion === 'off'} onPress={() => setMotion('off')} />
          <Chip label="On" on={motion === 'on'} onPress={() => setMotion('on')} />
        </Row>

        <AppText variant="small" muted>
          Tap Milo to pet him. The room is the same one Home shows in the Mist theme.
        </AppText>
      </View>
    </Page>
  );
}

export default function SceneLabScreen() {
  const { isDark } = useTheme();
  const [dark, setDark] = useState(isDark);
  const [motion, setMotion] = useState<Motion>('system');

  return (
    <MistPreview dark={dark}>
      <ReducedMotionOverride value={motion === 'system' ? null : motion === 'on'}>
        <LabBody dark={dark} setDark={setDark} motion={motion} setMotion={setMotion} />
      </ReducedMotionOverride>
    </MistPreview>
  );
}
