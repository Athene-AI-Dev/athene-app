import { supabaseAdmin } from "../lib/supabase/server";
import { describe, it, expect, beforeAll } from "vitest";

describe("LLM Keys RLS & RPC", () => {
  const TEST_ORG_ID = "00000000-0000-0000-0000-000000000001"; // Assuming a test org exists
  const KMS_KEY = process.env.KMS_KEY || "X6QfEu4GytYcIeNV9Z9y3tPM1bp8cBezo6zkp06EK4Y=";

  beforeAll(async () => {
    // Set up app context for the session
    await supabaseAdmin.rpc("set_app_context", {
      p_org_id: TEST_ORG_ID,
      p_user_id: "00000000-0000-0000-0000-000000000001",
      p_role: "admin",
      p_kms_key: KMS_KEY
    });
  });

  it("should encrypt a key via RPC", async () => {
    const { data, error } = await supabaseAdmin.rpc("encrypt_llm_key", {
      plaintext_key: "sk-test-key-1234"
    });
    expect(error).toBeNull();
    expect(data).toBeDefined();
  });

  it("should decrypt a key via SECURITY DEFINER RPC", async () => {
    // 1. Insert a test key (using admin bypass for setup)
    const { data: encrypted } = await supabaseAdmin.rpc("encrypt_llm_key", {
      plaintext_key: "sk-real-secret"
    });

    const { data: key, error: insertError } = await supabaseAdmin
      .from("llm_keys")
      .insert({
        org_id: TEST_ORG_ID,
        provider: "openai",
        key_encrypted: encrypted,
        key_hint: "...1234",
        created_by: "00000000-0000-0000-0000-000000000001",
        is_active: true
      })
      .select()
      .single();

    expect(insertError).toBeNull();

    // 2. Call the new safe RPC
    const { data: decrypted, error: rpcError } = await supabaseAdmin.rpc(
      "get_decrypted_llm_key",
      { p_org_id: TEST_ORG_ID, p_provider: "openai" }
    );

    expect(rpcError).toBeNull();
    expect(decrypted).toBe("sk-real-secret");

    // 3. Verify last_used_at was bumped
    const { data: updatedKey } = await supabaseAdmin
      .from("llm_keys")
      .select("last_used_at")
      .eq("id", key.id)
      .single();
    
    expect(updatedKey.last_used_at).not.toBeNull();
  });

  it("should enforce provider check constraint", async () => {
    const { error } = await supabaseAdmin
      .from("llm_keys")
      .insert({
        org_id: TEST_ORG_ID,
        provider: "invalid-provider",
        key_encrypted: Buffer.from("data"),
        key_hint: "...",
        created_by: "00000000-0000-0000-0000-000000000001"
      });
    
    expect(error).not.toBeNull();
    expect(error?.message).toContain("violates check constraint");
  });
});
