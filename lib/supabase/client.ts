import { createClient } from "@supabase/supabase-js";

import { getSupabaseBrowserEnv } from "@/lib/supabase/env";

export function createBrowserSupabaseClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
}
