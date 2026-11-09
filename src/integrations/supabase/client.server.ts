import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://eswqkdgqkcdegtblzrzq.supabase.co";
const SUPABASE_KEY =
  process.env.EXT_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_tg9AAH_jHwFw_s4MrGlnZg_R29tQIud";

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
