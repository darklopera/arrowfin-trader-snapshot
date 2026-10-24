-- Run once per cluster as a superuser (docker-compose does this automatically).
-- The password is a DEV placeholder; production gets it from a secret manager.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'arrowfin_app') THEN
    CREATE ROLE arrowfin_app LOGIN PASSWORD 'app_dev_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;
