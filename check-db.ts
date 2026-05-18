import * as dotenv from "dotenv";
dotenv.config();

import { supabaseAdmin } from "./lib/supabase/server";

async function check() {
  const { data: cols, error: colsErr } = await supabaseAdmin
    .from("documents")
    .select("id, title, visibility")
    .limit(10);

  console.log("Documents query result:", cols);
  console.log("Error:", colsErr);
}

check();
