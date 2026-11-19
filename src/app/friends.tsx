/**
 * Friends: sign in with an email code, invite friends with your code or a
 * share link, a weekly leaderboard, challenges, and plans friends send you.
 * Friends only ever see your name, your weekly summary (while sharing is on),
 * and anything you choose to send them.
 */
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, Share, Switch, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListRow, Section } from '@/components/list';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { getRoutines } from '@/db/plan';
import { currentUserId, isOnlineConfigured, sendSignInCode, signOut, verifySignInCode } from '@/lib/supabase';
import {
  addFriendByCode,
  answerChallenge,
  dismissPlan,
  getLeaderboard,
  getMyProfile,
  importPlan,
  listChallenges,
  listFriends,
  listIncomingPlans,
  METRIC_LABEL,
  metricValue,
  removeFriend,
  sendChallenge,
  sharePlan,
  syncMyWeek,
  updateMyProfile,
  type BoardRow,
  type Challenge,
  type Friend,
  type IncomingPlan,
  type Metric,
  type Profile,
} from '@/logic/social';
import { useTheme } from '@/theme/theme-context';
import { MIN_TAP, radius, spacing, typography } from '@/theme/typography';

type Data = { me: Profile; friends: Friend[]; board: BoardRow[]; challenges: Challenge[]; plans: IncomingPlan[] };

export default function FriendsScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>(); // from an invite link

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('workouts');
  const [friendCode, setFriendCode] = useState(params.code ?? '');
  const [name, setName] = useState('');

  const load = useCallback(async () => {
    if (!isOnlineConfigured) return;
    try {
      setError(null);
      const uid = await currentUserId();
      setSignedIn(uid != null);
      if (!uid) return;
      await syncMyWeek(db);
      const me = await getMyProfile();
      if (!me) {
        setError('Your profile isn’t ready yet. Make sure the setup script was run in Supabase, then try again.');
        return;
      }
      const friends = await listFriends();
      const [board, challenges, plans] = await Promise.all([
        getLeaderboard(me, friends),
        listChallenges(),
        listIncomingPlans(me.id, friends),
      ]);
      setData({ me, friends, board, challenges, plans });
      setName(me.display_name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the server. Check your internet.');
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const input = {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: MIN_TAP,
  };

  // ---------- Not set up / signed out ----------

  if (!isOnlineConfigured) {
    return (
      <Page title="Friends">
        <Card>
          <AppText variant="label">Friends aren&apos;t connected yet</AppText>
          <AppText muted>
            This needs a free online account (Supabase). Once it&apos;s set up, you can invite friends, compare weekly
            stats and send each other plans. Everything else in the app keeps working offline.
          </AppText>
        </Card>
      </Page>
    );
  }

  if (signedIn === false) return <SignIn onDone={load} />;

  // ---------- Signed in ----------

  async function act(fn: () => Promise<unknown>, success?: string) {
    try {
      await fn();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (success) Alert.alert(success);
      await load();
    } catch (e) {
      Alert.alert('That didn’t work', e instanceof Error ? e.message : 'Please try again.');
    }
  }

  function inviteText(code: string) {
    const link = Linking.createURL('friends', { queryParams: { code } });
    return `Train with me on WorkoutTracker! My friend code is ${code}.\nOpen: ${link}`;
  }

  function friendMenu(f: Friend) {
    if (!data) return;
    Alert.alert(f.name, undefined, [
      { text: 'Challenge', onPress: () => challengeMenu(f) },
      { text: 'Send a Plan', onPress: () => planMenu(f) },
      {
        text: 'Remove Friend',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Remove ${f.name}?`, 'You’ll stop seeing each other’s stats.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => act(() => removeFriend(f.id)) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function challengeMenu(f: Friend) {
    Alert.alert(`Challenge ${f.name}`, 'Who wins this week?', [
      ...(['workouts', 'volume', 'streak'] as Metric[]).map((m) => ({
        text: `Most ${METRIC_LABEL[m].toLowerCase()}`,
        onPress: () => act(() => sendChallenge(data!.me.id, f.id, m), `Challenge sent to ${f.name}`),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  async function planMenu(f: Friend) {
    const routines = await getRoutines(db);
    Alert.alert(`Send a plan to ${f.name}`, 'They get a copy of the plan, not your history.', [
      ...routines.map((r) => ({
        text: r.name,
        onPress: () => act(() => sharePlan(db, data!.me.id, f.id, r.id), `Sent “${r.name}” to ${f.name}`),
      })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  if (!data) {
    return (
      <Page title="Friends">
        {error ? (
          <Card>
            <AppText variant="label">Can&apos;t load friends</AppText>
            <AppText muted>{error}</AppText>
            <Button title="Try Again" kind="secondary" onPress={load} />
          </Card>
        ) : (
          <AppText muted>Loading…</AppText>
        )}
      </Page>
    );
  }

  const { me, friends, board, challenges, plans } = data;
  const ranked = [...board].sort((a, b) => metricValue(b, metric) - metricValue(a, metric));
  const nameOf = (id: string) => (id === me.id ? 'You' : (friends.find((f) => f.id === id)?.name ?? 'Friend'));
  const statOf = (id: string, m: Metric) => {
    const r = board.find((b) => b.userId === id);
    return r ? metricValue(r, m) : 0;
  };
  const fmt = (m: Metric, v: number) => (m === 'volume' ? `${v.toLocaleString()} kg` : String(v));

  return (
    <Page title="Friends">
      {error && <AppText color={colors.danger}>{error}</AppText>}

      {/* You */}
      <Card>
        <AppText variant="small" muted>
          YOUR NAME
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => name.trim() && name.trim() !== me.display_name && act(() => updateMyProfile({ display_name: name.trim() }))}
          placeholder="What friends see"
          placeholderTextColor={colors.faint}
          style={input}
        />
        <AppText variant="small" muted style={{ marginTop: spacing.sm }}>
          YOUR FRIEND CODE
        </AppText>
        <AppText style={{ fontSize: 32, fontWeight: '700', letterSpacing: 4 }}>{me.invite_code}</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              title="Copy"
              kind="secondary"
              onPress={async () => {
                await Clipboard.setStringAsync(me.invite_code);
                Haptics.selectionAsync().catch(() => {});
                Alert.alert('Copied', 'Your friend code is on the clipboard.');
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="Share Invite" onPress={() => Share.share({ message: inviteText(me.invite_code) })} />
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label">Share my weekly stats</AppText>
            <AppText variant="small" muted>
              Workouts, kilos lifted and week streak. Off = friends see nothing.
            </AppText>
          </View>
          <Switch
            value={me.share_stats}
            onValueChange={(v) => act(() => updateMyProfile({ share_stats: v }))}
            trackColor={{ true: colors.accent }}
          />
        </View>
      </Card>

      {/* Add a friend */}
      <Card>
        <AppText variant="label">Add a friend</AppText>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <TextInput
            value={friendCode}
            onChangeText={(t) => setFriendCode(t.toUpperCase())}
            placeholder="Their 6-letter code"
            placeholderTextColor={colors.faint}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            style={[input, { flex: 1, letterSpacing: 2 }]}
          />
          <Button
            title="Add"
            disabled={friendCode.trim().length < 6}
            onPress={() =>
              act(async () => {
                const who = await addFriendByCode(friendCode);
                setFriendCode('');
                Alert.alert('Friends!', `You and ${who} are now friends.`);
              })
            }
          />
        </View>
      </Card>

      {/* Plans sent to you */}
      {plans.length > 0 && (
        <Section title="Plans sent to you">
          {plans.map((p) => (
            <View key={p.id} style={{ padding: spacing.lg, gap: spacing.sm }}>
              <AppText variant="label">{p.name}</AppText>
              <AppText variant="small" muted>
                From {p.fromName} · {p.payload.workouts?.length ?? 0} workouts
              </AppText>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button title="Add to My Plans" onPress={() => act(() => importPlan(db, p), 'Added to your plans')} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button title="Dismiss" kind="secondary" onPress={() => act(() => dismissPlan(p.id))} />
                </View>
              </View>
            </View>
          ))}
        </Section>
      )}

      {/* Leaderboard */}
      <Card>
        <AppText variant="label">This week&apos;s leaderboard</AppText>
        <Segmented
          value={metric}
          onChange={setMetric}
          options={[
            { value: 'workouts', label: 'Workouts' },
            { value: 'volume', label: 'Kilos' },
            { value: 'streak', label: 'Streak' },
          ]}
        />
        {ranked.map((r, i) => (
          <View
            key={r.userId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              backgroundColor: r.isMe ? colors.accentSoft : 'transparent',
            }}>
            <AppText variant="label" muted style={{ width: 24 }}>
              {i + 1}
            </AppText>
            <AppText variant="label" style={{ flex: 1 }} numberOfLines={1}>
              {r.isMe ? 'You' : r.name}
            </AppText>
            <AppText variant="label">{fmt(metric, metricValue(r, metric))}</AppText>
          </View>
        ))}
        {friends.length === 0 && (
          <AppText variant="small" muted>
            Add a friend to start competing.
          </AppText>
        )}
      </Card>

      {/* Challenges */}
      {challenges.length > 0 && (
        <Section title="Challenges this week">
          {challenges.map((c) => {
            const incoming = c.toId === me.id;
            const otherId = incoming ? c.fromId : c.toId;
            const mine = statOf(me.id, c.metric);
            const theirs = statOf(otherId, c.metric);
            return (
              <View key={c.id} style={{ padding: spacing.lg, gap: spacing.sm }}>
                <AppText variant="label">
                  Most {METRIC_LABEL[c.metric].toLowerCase()}: You vs {nameOf(otherId)}
                </AppText>
                {c.status === 'accepted' && (
                  <AppText variant="small" muted>
                    {fmt(c.metric, mine)} vs {fmt(c.metric, theirs)} ·{' '}
                    {mine > theirs ? 'You’re ahead' : mine < theirs ? `${nameOf(otherId)} is ahead` : 'Tied'}
                  </AppText>
                )}
                {c.status === 'declined' && (
                  <AppText variant="small" muted>
                    Declined
                  </AppText>
                )}
                {c.status === 'pending' &&
                  (incoming ? (
                    <View style={{ flexDirection: 'row', gap: spacing.md }}>
                      <View style={{ flex: 1 }}>
                        <Button title="Accept" onPress={() => act(() => answerChallenge(c.id, 'accepted'))} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button title="Decline" kind="secondary" onPress={() => act(() => answerChallenge(c.id, 'declined'))} />
                      </View>
                    </View>
                  ) : (
                    <AppText variant="small" muted>
                      Waiting for {nameOf(otherId)} to accept
                    </AppText>
                  ))}
              </View>
            );
          })}
        </Section>
      )}

      {/* Friends list */}
      {friends.length > 0 && (
        <Section title={`Friends (${friends.length})`}>
          {friends.map((f) => (
            <ListRow key={f.id} icon="person.crop.circle" title={f.name} subtitle="Challenge or send a plan" onPress={() => friendMenu(f)} />
          ))}
        </Section>
      )}

      <Pressable onPress={() => act(signOut)} style={{ alignSelf: 'center', padding: spacing.md }}>
        <AppText variant="small" muted style={{ textDecorationLine: 'underline' }}>
          Sign out
        </AppText>
      </Pressable>
    </Page>
  );
}

/** Email → 6-digit code → signed in. No password to remember. */
function SignIn({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: MIN_TAP,
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('That didn’t work', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Friends">
      <Card>
        <AppText variant="heading">Train with friends</AppText>
        <AppText muted>
          Sign in to invite friends, compare weekly stats and send each other plans. Friends only see your name and
          your weekly summary (which you can turn off). Your full workout log stays on this phone.
        </AppText>
      </Card>
      <Card>
        <AppText variant="label">{sent ? 'Enter the code we emailed you' : 'Your email'}</AppText>
        {!sent ? (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.faint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              style={input}
            />
            <Button
              title={busy ? 'Sending…' : 'Email Me a Code'}
              disabled={busy || !email.includes('@')}
              onPress={() => run(async () => {
                await sendSignInCode(email);
                setSent(true);
              })}
            />
          </>
        ) : (
          <>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-digit code"
              placeholderTextColor={colors.faint}
              keyboardType="number-pad"
              maxLength={6}
              style={[input, { letterSpacing: 4, fontSize: 22 }]}
            />
            <Button
              title={busy ? 'Checking…' : 'Sign In'}
              disabled={busy || code.trim().length < 6}
              onPress={() => run(async () => {
                await verifySignInCode(email, code);
                onDone();
              })}
            />
            <Pressable onPress={() => setSent(false)} style={{ alignSelf: 'center', padding: spacing.sm }}>
              <AppText variant="small" muted style={{ textDecorationLine: 'underline' }}>
                Use a different email
              </AppText>
            </Pressable>
          </>
        )}
      </Card>
    </Page>
  );
}
