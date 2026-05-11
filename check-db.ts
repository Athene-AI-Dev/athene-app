import { supabaseAdmin } from "./lib/supabase/server";

async function check() {
  const userId = "user_3DL4opxiE8U9UFVRJFdm2Y9FImI";
  const { data, error } = await supabaseAdmin
    .from("org_members")
    .select("*")
    .eq("clerk_user_id", userId);

  console.log("Member data:", data);
  console.log("Error:", error);
}

check();
