-- ============================================================
-- Fix: BYOK encryption should not error with "unrecognized configuration parameter"
-- when app.kms_key isn't set in the current transaction.
--
-- We keep these helpers for backwards compatibility, but make them:
-- - use current_setting(..., true) so missing setting doesn't throw
-- - raise a clear error message instead
-- ============================================================

CREATE OR REPLACE FUNCTION encrypt_llm_key(plaintext_key text)
RETURNS bytea AS $$
DECLARE
  kms text;
BEGIN
  kms := current_setting('app.kms_key', true);
  IF kms IS NULL OR length(kms) = 0 THEN
    RAISE EXCEPTION 'KMS key missing: set app.kms_key for this transaction or call store_llm_key(p_kms_key => ...).';
  END IF;

  RETURN pgp_sym_encrypt(plaintext_key, kms);
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION decrypt_llm_key(encrypted_key bytea)
RETURNS text AS $$
DECLARE
  kms text;
BEGIN
  kms := current_setting('app.kms_key', true);
  IF kms IS NULL OR length(kms) = 0 THEN
    RAISE EXCEPTION 'KMS key missing: set app.kms_key for this transaction or call get_decrypted_llm_key(p_kms_key => ...).';
  END IF;

  RETURN pgp_sym_decrypt(encrypted_key, kms);
END;
$$ LANGUAGE plpgsql;

