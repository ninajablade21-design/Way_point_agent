import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only VITE_-prefixed variables are exposed to browser code by Vite.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const looksLikePlaceholder = (value: string) => value.includes('YOUR_');

export const isSupabaseConfigured = Boolean(
  url && anonKey && !looksLikePlaceholder(url) && !looksLikePlaceholder(anonKey)
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
