import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configure Socket.io adapter with CORS
  app.useWebSocketAdapter(new IoAdapter(app));

  // Security - Configure Helmet to allow WebSocket connections
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for local development
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(cookieParser());

  // CORS for HTTP - Allow frontend domain and local development
  const allowedOrigins = [
    process.env.FRONTEND_URL, // Your Vercel frontend URL
    'http://localhost:5173', // Vite dev server
    'http://localhost:3000', // Alternative local dev
    ...(process.env.NODE_ENV === 'development' ? ['*'] : []), // Allow all in dev
  ].filter(Boolean); // Remove undefined values

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' 
      ? allowedOrigins.length > 0 ? allowedOrigins : true
      : true, // Allow all in development
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Global prefix
  app.setGlobalPrefix(process.env.API_PREFIX || 'api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Seka Svara API')
    .setDescription('API documentation for Seka Svara multiplayer card game')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management')
    .addTag('admin', 'Admin panel')
    .addTag('game', 'Game logic')
    .addTag('tables', 'Game tables')
    .addTag('wallet', 'Wallet management')
    .addTag('transactions', 'Transactions')
    .addTag('nft', 'NFT marketplace')
    .addTag('leaderboard', 'Leaderboard & statistics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 8000;
  // In Docker, bind to 0.0.0.0 to accept external connections
  // On local development (non-Docker), this will still work
  const host = '0.0.0.0';
  await app.listen(port, host);

  console.log(`
    🚀 Server is running on: http://localhost:${port}
    📚 API Documentation: http://localhost:${port}/api/docs
    🔧 Environment: ${process.env.NODE_ENV}
  `);
}

bootstrap();

