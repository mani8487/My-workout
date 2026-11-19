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

/** Step 1 of signing in: email a 6-digit code. */
export async function sendSignInCode(email: string) {
  if (!supabase) throw new Error('Friends are not set up yet.');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

/** Step 2: check the code from the email. */
export async function verifySignInCode(email: string, code: string) {
  if (!supabase) throw new Error('Friends are not set up yet.');
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

export async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
