-- Tenant isolation, enforced by the DATABASE.
--
-- The application connects as `arrowfin_app`: NOT the table owner, NOT a
-- superuser, no BYPASSRLS. Every transaction starts with
--   SELECT set_config('app.broker_id', '<broker from the verified JWT>', true)
-- and the policies below compare broker_id to that setting.
--
-- FAIL-CLOSED: if the setting is missing (a developer forgot to open a tenant
-- transaction) current_setting(..., true) returns NULL, `broker_id = NULL` is
-- never true, and the query returns ZERO rows instead of everybody's rows.

ALTER TABLE "brokers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "brokers" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "brokers"
  USING ("id" = current_setting('app.broker_id', true))
  WITH CHECK ("id" = current_setting('app.broker_id', true));

ALTER TABLE "traders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "traders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "traders"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));

ALTER TABLE "accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "accounts"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));

ALTER TABLE "fills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fills" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "fills"
  USING ("broker_id" = current_setting('app.broker_id', true))
  WITH CHECK ("broker_id" = current_setting('app.broker_id', true));

-- Least privilege: the API role can only READ. Writes (fill ingestion, seed)
-- use a separate privileged connection that is never exposed to request code.
-- `instruments` and `market_prices` are shared reference data (no RLS).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arrowfin_app') THEN
    GRANT USAGE ON SCHEMA public TO arrowfin_app;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO arrowfin_app;
  ELSE
    RAISE NOTICE 'role arrowfin_app does not exist yet: create it, then re-run the GRANTs';
  END IF;
END
$$;
