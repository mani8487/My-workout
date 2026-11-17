/** A pushed (non-tab) page: header with back/close + scrolling content + optional pinned footer. */
import { router } from 'expo-router';
import type { SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { useTheme } from '@/theme/theme-context';
import { spacing } from '@/theme/typography';

export function Page({
  title,
  children,
  footer,
  modal,
  right,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Modal sheets get an ✕ instead of a back arrow. */
  modal?: boolean;
  right?: { icon: SFSymbol; label: string; onPress: () => void };
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScreenHeader
        title={title}
        onBack={() => router.back()}
        backIcon={modal ? 'xmark' : 'chevron.left'}
        backLabel={modal ? 'Close' : 'Back'}
        right={right}
      />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
          {children}
        </ScrollView>
        {footer && <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
