// Runs before each test file (before AppModule is imported, which reads these).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-0123';
process.env.ENABLE_DEV_ENDPOINTS = 'true';
process.env.DEV_API_KEY = 'test-dev-key';
process.env.SNAPSHOT_AS_OF = '2026-08-25T14:30:00Z'; // the dataset cut
process.env.WEB_ORIGIN = 'http://localhost:3000';
