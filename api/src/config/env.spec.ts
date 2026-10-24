import { loadConfig } from './env';
import { devModulesFor } from '../app.module';

const base = { JWT_SECRET: 'x'.repeat(40), DATABASE_URL: 'postgresql://a:b@h/db' };

describe('config safety rails', () => {
  it('refuses to boot with a short JWT secret', () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
  it('refuses to boot in production with dev endpoints enabled', () => {
    expect(() =>
      loadConfig({ ...base, NODE_ENV: 'production', ENABLE_DEV_ENDPOINTS: 'true', DEV_API_KEY: 'k', ADMIN_DATABASE_URL: 'x' }),
    ).toThrow(/must not be true/);
  });
  it('refuses a pinned clock in production', () => {
    expect(() => loadConfig({ ...base, NODE_ENV: 'production', SNAPSHOT_AS_OF: '2026-08-25T14:30:00Z' })).toThrow(/SNAPSHOT_AS_OF/);
  });
  it('dev endpoints require their own key and a privileged connection', () => {
    expect(() => loadConfig({ ...base, ENABLE_DEV_ENDPOINTS: 'true' })).toThrow(/DEV_API_KEY/);
  });
  it('the dev module is not even imported unless explicitly enabled outside production', () => {
    expect(devModulesFor({ NODE_ENV: 'production', ENABLE_DEV_ENDPOINTS: 'true' })).toEqual([]);
    expect(devModulesFor({ NODE_ENV: 'development' })).toEqual([]);
    expect(devModulesFor({ NODE_ENV: 'development', ENABLE_DEV_ENDPOINTS: 'true' })).toHaveLength(1);
  });
});
