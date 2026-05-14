import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const CreateOrgInput = z.object({
  name: z.string().trim().min(1).max(120),
  accessToken: z.string().min(1),
});

export const createOrgOnServer = createServerFn({ method: "POST" })
  .inputValidator((input) => CreateOrgInput.parse(input))
  .handler(async ({ data }) => {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(
      data.accessToken,
    );
    const user = userData.user;

    if (userError || !user) {
      throw new Error("Não autenticado");
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from("orgs")
      .insert({ name: data.name, owner_id: user.id })
      .select("id,name,owner_id,created_at")
      .single();

    if (orgError) throw new Error(orgError.message);

    const { error: memberError } = await supabaseAdmin.from("org_members").insert({
      org_id: org.id,
      user_id: user.id,
      role: "owner",
    });

    if (memberError && memberError.code !== "42P01") throw new Error(memberError.message);

    return org;
  });