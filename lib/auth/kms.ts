// ============================================================
// lib/auth/kms.ts — Per-org KMS key derivation
//
// Problem: All orgs' BYOK keys are currently encrypted with a single
// global KMS_KEY env var. A leaked environment means an attacker can
// decrypt every org's API keys.
//
// Fix: Derive a per-org encryption key using HMAC-SHA256.
//   derivedKey = HMAC-SHA256(masterKey, internalOrgId)
//
// This means:
//  - A leaked master key alone cannot decrypt any org's data without
//    also knowing the org's internal UUID.
//  - Key rotation requires only updating KMS_KEY and re-encrypting
//    individual org keys — not a full re-keying of all data.
//  - Existing keys encrypted with the raw master key continue to work
//    because callers that haven't migrated still pass KMS_KEY directly.
//
// Usage:
//   import { deriveOrgKey, getMasterKey } from '@/lib/auth/kms'
//   const encKey = deriveOrgKey(getMasterKey(), internalOrgId)
//   // pass encKey to store_llm_key / get_decrypted_llm_key RPCs
// ============================================================

import { createHmac } from 'crypto';

/**
 * Derives a per-org encryption key from the master KMS key.
 * Output is a 64-char lowercase hex string (256 bits).
 *
 * @param masterKey  Raw KMS_KEY env var value
 * @param orgId      Internal Supabase UUID for the org (NOT the Clerk org ID)
 */
export function deriveOrgKey(masterKey: string, orgId: string): string {
  return createHmac('sha256', masterKey).update(orgId).digest('hex');
}

/**
 * Reads and validates the master KMS key from env.
 * Throws a descriptive error if missing — call sites should catch and
 * surface a 500 with a helpful message.
 */
export function getMasterKey(): string {
  const key = process.env.KMS_KEY;
  if (!key) {
    throw new Error(
      'KMS_KEY environment variable is not set. ' +
        'BYOK encryption/decryption is disabled. ' +
        'Set KMS_KEY in your deployment environment.'
    );
  }
  return key;
}
