import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const url = process.env.SUPABASE_DIRECT_URL!;
console.log('Connecting to:', url.replace(/:[^:@]+@/, ':****@'));
const sql = postgres(url);

async function heal() {
  console.log('Healing database schema alignment...');
  
  try {
    // 1. Standardize org_members
    console.log('Standardizing org_members...');
    await sql`ALTER TABLE org_members ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;`;
    await sql`ALTER TABLE org_members ADD COLUMN IF NOT EXISTS email text;`;
    await sql`ALTER TABLE org_members ADD COLUMN IF NOT EXISTS display_name text;`;
    
    // 2. Ensure FK for access_grants -> org_members (PostgREST requirement for joins)
    console.log('Verifying relationships...');
    await sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints 
          WHERE constraint_name = 'access_grants_user_id_fkey'
        ) THEN
          ALTER TABLE access_grants 
          ADD CONSTRAINT access_grants_user_id_fkey 
          FOREIGN KEY (user_id) REFERENCES org_members(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `;

    // 3. Ensure bi_access_audit / grant_access_audit table (Blueprint Section 3)
    console.log('Verifying audit tables...');
    await sql`
      CREATE TABLE IF NOT EXISTS grant_access_audit (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        user_id         uuid NOT NULL REFERENCES org_members(id),
        grant_id        uuid REFERENCES access_grants(id) ON DELETE SET NULL,
        scope_used      text NOT NULL,
        document_ids    text[] NOT NULL,
        query_hash      text,
        accessed_at     timestamptz NOT NULL DEFAULT now()
      );
    `;

    // 4. Reload PostgREST schema cache to reflect changes immediately
    console.log('Reloading PostgREST schema cache...');
    await sql`NOTIFY pgrst, 'reload schema';`;
    
    console.log('Schema alignment complete. PostgREST reload triggered.');

  } catch (err) {
    console.error('Schema alignment failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

heal();
