import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://eswqkdgqkcdegtblzrzq.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_tg9AAH_jHwFw_s4MrGlnZg_R29tQIud";

export const createOrgOnServer = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        name: z.string().trim().min(1).max(120),
        accessToken: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${data.accessToken}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(data.accessToken);
    const user = userData.user;

    if (userError || !user) {
      throw new Error("Não autenticado");
    }

    const { data: org, error: orgError } = await userClient
      .from("orgs")
      .insert({ name: data.name, owner_id: user.id })
      .select("id,name,owner_id,created_at")
      .single();

    if (orgError) throw new Error(orgError.message);

    return org;
  });
