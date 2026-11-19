/**
 * Connection to Supabase (the online part, used only for Friends).
 *
 * The two values come from a local `.env.local` file (never committed to
 * GitHub). If they're missing, `supabase` is null and the Friends screen says
 * it isn't set up yet — the rest of the app works exactly as before, offline.
 */
import 'expo-sqlite/localStorage/install'; // gives Supabase somewhere to keep you signed in

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export const isOnlineConfigured = supabase != null;

/**
 * Sign in with email and password. (Supabase's free email service can only send
 * links, which can't open the app inside Expo Go, so we don't rely on email.)
 */
export async function signInWithEmail(email: string, password: string) {
  if (!supabase) throw new Error('Friends are not set up yet.');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

/** Create an account. You're signed in straight away. */
export async function createAccount(email: string, password: string) {
  if (!supabase) throw new Error('Friends are not set up yet.');
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw error;
  if (!data.session) throw new Error('Account created. Please sign in.');
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
