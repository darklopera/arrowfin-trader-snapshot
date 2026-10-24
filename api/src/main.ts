import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap';
import { APP_CONFIG, AppConfig } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  app.enableShutdownHooks();
  await app.listen(config.port);
  console.log(`API listening on :${config.port} (${config.nodeEnv})${config.devEndpoints ? '  [DEV ENDPOINTS ON]' : ''}`);
}
bootstrap();
