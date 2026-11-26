/** More tab: plan editor, exercise library, plate calculator, settings. */
import { router } from 'expo-router';

import { AppText } from '@/components/app-text';
import { ListRow, Section } from '@/components/list';
import { Screen } from '@/components/screen';

export default function MoreScreen() {
  return (
    <Screen>
      <AppText variant="title">More</AppText>
      <Section title="Training">
        <ListRow icon="list.bullet.rectangle" title="Plan Editor" subtitle="Exercises, sets and reps for each workout" onPress={() => router.push('/plans')} />
        <ListRow icon="books.vertical" title="Exercise Library" subtitle="Browse exercises and add your own" onPress={() => router.push('/library')} />
        <ListRow icon="scalemass" title="Plate Calculator" subtitle="Which plates to load on each side" onPress={() => router.push('/plates')} />
      </Section>
      <Section title="Social">
        <ListRow icon="person.2" title="Friends" subtitle="Invite friends, leaderboard, challenges" onPress={() => router.push('/friends')} />
      </Section>
      <Section title="App">
        <ListRow icon="gearshape" title="Settings" subtitle="Your name and appearance" onPress={() => router.push('/settings')} />
      </Section>
    </Screen>
  );
}
