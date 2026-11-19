/**
 * Shown instead of closing the app if a screen hits an unexpected error.
 * Every set is saved the moment it's ticked, so nothing logged is lost.
 * Deliberately uses no theme or database, so it still works if those failed.
 */
import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { Pressable, Text, useColorScheme, View } from 'react-native';

export function CrashScreen({ error, retry }: ErrorBoundaryProps) {
  const dark = useColorScheme() !== 'light';
  const fg = dark ? '#F2F2F2' : '#1A1A1A';
  const muted = dark ? '#A0A0A0' : '#5A5A5A';
  const accent = dark ? '#C9A45C' : '#8A6A2A';
  const button = (label: string, onPress: () => void, primary?: boolean) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: 48,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: primary ? accent : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: muted,
      }}>
      <Text style={{ color: primary ? '#111' : fg, fontSize: 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 32, gap: 16, backgroundColor: dark ? '#111111' : '#FAFAF7' }}>
      <Text style={{ color: fg, fontSize: 24, fontWeight: '700' }}>Something went wrong</Text>
      <Text style={{ color: muted, fontSize: 16, lineHeight: 22 }}>
        Your workouts are safe: every set is saved the moment you tick it. Try again, or go back to Home.
      </Text>
      {__DEV__ && <Text style={{ color: muted, fontSize: 12 }}>{error.message}</Text>}
      {button('Try again', retry, true)}
      {button('Go to Home', () => {
        try {
          router.replace('/');
        } catch {
          retry();
        }
      })}
    </View>
  );
}
