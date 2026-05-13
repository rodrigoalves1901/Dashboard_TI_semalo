import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ncpffawzpcghauovfdci.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_XIPluJsoqojPKG8jXqRcXw_ShLGPIio";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});
