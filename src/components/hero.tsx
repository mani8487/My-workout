/** The big gradient workout card on Home, its main button and its small chips. */
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useTheme } from '@/theme/theme-context';
import { radius, spacing } from '@/theme/typography';

export function Hero({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.heroStart, colors.heroEnd]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ borderRadius: radius.lg, padding: spacing.xl, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }}>
      {children}
    </LinearGradient>
  );
}

export function HeroTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <AppText style={{ fontSize: 40, fontWeight: '700', letterSpacing: -0.8 }} color={colors.onHero}>
      {children}
    </AppText>
  );
}

export function HeroButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => ({
        minHeight: 56,
        marginTop: spacing.md,
        borderRadius: radius.md,
        backgroundColor: colors.heroButton,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.85 : 1,
      })}>
      <AppText variant="heading" style={{ fontSize: 20 }} color={colors.onHeroButton}>
        {title}
      </AppText>
    </Pressable>
  );
}

/** Quiet outlined button that sits on the hero card. */
export function HeroOutlineButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        minHeight: 52,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: colors.onHeroMuted,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.75 : 1,
      })}>
      <AppText variant="label" color={colors.onHero}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function HeroChip({ children, icon }: { children: string; icon?: SFSymbol }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm - 2,
        borderRadius: 999,
        backgroundColor: colors.heroChip,
      }}>
      {icon && <SymbolView name={icon} size={14} tintColor={colors.onHero} />}
      <AppText variant="small" color={colors.onHero}>
        {children}
      </AppText>
    </View>
  );
}
