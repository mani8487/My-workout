/** Exercise picker for the Progress tab: every exercise you've logged, most recent first. */
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ScreenHeader } from '@/components/screen-header';
import { getLoggedExercises } from '@/db/progress';
import { setSetting } from '@/db/settings';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export default function PickExerciseScreen() {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const [list, setList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    getLoggedExercises(db).then(setList);
  }, [db]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader title="Choose Exercise" onBack={() => router.back()} backIcon="xmark" backLabel="Close" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
        <View
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}>
          {list.map((e, i) => (
            <Pressable accessibilityRole="button"
              key={e.id}
              onPress={async () => {
                await setSetting(db, 'progress_exercise', e.id);
                router.back();
              }}
              style={({ pressed }) => ({
                padding: spacing.lg,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: colors.border,
                backgroundColor: pressed ? colors.cardAlt : 'transparent',
              })}>
              <AppText variant="label">{e.name}</AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
