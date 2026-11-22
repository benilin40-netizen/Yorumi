import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { SERVER_CONFIG } from './config.js';
import type { Database, ProfileRow } from '../src/types/supabase.js';

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(SERVER_CONFIG.supabaseUrl && SERVER_CONFIG.supabaseServiceRoleKey);
}

export const supabaseAdmin: SupabaseClient<Database> | null = isSupabaseAdminConfigured()
  ? createClient<Database>(
      SERVER_CONFIG.supabaseUrl,
      SERVER_CONFIG.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

export function createSupabaseUserClient(accessToken?: string): SupabaseClient<Database> | null {
  const key =
    SERVER_CONFIG.supabasePublishableKey ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';
  if (!SERVER_CONFIG.supabaseUrl || !key) return null;

  return createClient<Database>(SERVER_CONFIG.supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export interface VerifiedSupabaseAuth {
  user: User | null;
  profile: ProfileRow | null;
  isAdmin: boolean;
}

export async function verifySupabaseAccessToken(
  token: string | null | undefined
): Promise<VerifiedSupabaseAuth> {
  if (!token || typeof token !== 'string' || !token.trim()) {
    return { user: null, profile: null, isAdmin: false };
  }

  const cleanToken = token.replace(/^Bearer\s+/i, '').trim();
  if (!cleanToken) {
    return { user: null, profile: null, isAdmin: false };
  }

  try {
    let user: User | null = null;
    if (supabaseAdmin) {
      const { data, error } = await supabaseAdmin.auth.getUser(cleanToken);
      if (!error && data?.user) {
        user = data.user;
      }
    } else {
      const userClient = createSupabaseUserClient(cleanToken);
      if (userClient) {
        const { data, error } = await userClient.auth.getUser(cleanToken);
        if (!error && data?.user) {
          user = data.user;
        }
      }
    }

    if (!user) {
      return { user: null, profile: null, isAdmin: false };
    }

    const dbClient = supabaseAdmin || createSupabaseUserClient(cleanToken);
    let profile: ProfileRow | null = null;

    if (dbClient) {
      const { data: profData, error: profErr } = await dbClient
        .from('profiles')
        .select('id, username, preferred_provider, preferred_lang, is_admin, created_at, updated_at')
        .eq('id', user.id)
        .maybeSingle();

      if (!profErr && profData) {
        profile = profData as ProfileRow;
      }
    }

    return {
      user,
      profile,
      isAdmin: Boolean(profile?.is_admin),
    };
  } catch {
    return { user: null, profile: null, isAdmin: false };
  }
}
