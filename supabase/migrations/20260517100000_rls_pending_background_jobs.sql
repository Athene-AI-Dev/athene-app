-- Enable RLS on pending_background_jobs.
-- This table was created without RLS in 20260416000000_pending_background_jobs.sql.
-- Workers exclusively use the service_role key which bypasses RLS.
-- Authenticated users (anon key) must not be able to read or manipulate the job queue.

ALTER TABLE pending_background_jobs ENABLE ROW LEVEL SECURITY;

-- Org admins may inspect job queue status for their own org.
CREATE POLICY "org_admin_select_jobs" ON pending_background_jobs
  FOR SELECT
  USING (
    org_id IN (
      SELECT o.id
      FROM organizations o
      JOIN org_members m ON m.org_id = o.id
      WHERE m.clerk_user_id = (auth.jwt() ->> 'sub')
        AND m.role = 'admin'
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated users.
-- Only the service_role (used by QStash workers) may write to this table.
