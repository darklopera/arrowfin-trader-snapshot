import { INestApplication, ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { ServerOptions } from 'socket.io';
import { AppConfig } from './config/env';
import { LoggingInterceptor } from './shared/logging.interceptor';

class TenantIoAdapter extends IoAdapter {
  constructor(app: INestApplication, private readonly config: AppConfig) {
    super(app);
  }
  createIOServer(port: number, options?: ServerOptions) {
    return super.createIOServer(port, {
      ...options,
      transports: ['websocket'], // no long-polling fallback: one code path to secure
      cors: { origin: this.config.webOrigin }, // explicit allow-list, never '*'
      maxHttpBufferSize: 1e4, // clients send nothing; keep the ceiling tiny
      // Heartbeat: a silently dead connection is noticed in <= ~15 s, which bounds how
      // long a client can keep showing numbers as live after the feed is gone.
      pingInterval: 10_000,
      pingTimeout: 5_000,
    });
  }
}

/** Shared by main.ts and the e2e tests so tests run the REAL configuration. */
export function configureApp(app: INestApplication, config: AppConfig) {
  app.use(helmet());
  // Financial data must never sit in a browser/proxy cache.
  app.use((_req: unknown, res: { setHeader(k: string, v: string): void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableCors({ origin: config.webOrigin });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useWebSocketAdapter(new TenantIoAdapter(app, config));
}
