/** Settings: your name (for the Home greeting) and light/dark appearance. Kilos only, always. */
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { TextInput } from 'react-native';

import { AppText } from '@/components/app-text';
import { Card } from '@/components/card';
import { Page } from '@/components/page';
import { Segmented } from '@/components/segmented';
import { getSetting, setSetting } from '@/db/settings';
import { useTheme, type ThemePreference } from '@/theme/theme-context';
import { radius, spacing, typography } from '@/theme/typography';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const { colors, preference, setPreference } = useTheme();
  const [name, setName] = useState('');

  useEffect(() => {
    getSetting(db, 'user_name').then((v) => setName(v ?? ''));
  }, [db]);

  return (
    <Page title="Settings">
      <Card>
        <AppText variant="label">Your name</AppText>
        <AppText variant="small" muted>
          Used in the greeting on Home.
        </AppText>
        <TextInput
          value={name}
          onChangeText={setName}
          onEndEditing={() => setSetting(db, 'user_name', name.trim() || null)}
          placeholder="Your first name"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="words"
          returnKeyType="done"
          style={{
            ...typography.body,
            color: colors.text,
            backgroundColor: colors.cardAlt,
            borderRadius: radius.sm,
            padding: spacing.md,
          }}
        />
      </Card>

      <Card>
        <AppText variant="label">Appearance</AppText>
        <Segmented<ThemePreference>
          value={preference}
          onChange={setPreference}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'frost', label: 'Frost' },
            { value: 'auto', label: 'Auto' },
          ]}
        />
        <AppText variant="small" muted>
          Auto follows your iPhone&apos;s light or dark setting.
        </AppText>
      </Card>

      <AppText variant="small" muted style={{ textAlign: 'center' }}>
        All weights are in kilos. Everything is stored on this phone and works offline.
      </AppText>
    </Page>
  );
}
