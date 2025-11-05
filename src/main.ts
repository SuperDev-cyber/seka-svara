import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as express from 'express';

async function bootstrap() {
  // Increase body size limit to handle base64-encoded images (10MB)
  // Base64 encoding increases size by ~33%, so 5MB image becomes ~6.7MB base64
  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    rawBody: false,
  });
  
  // Configure Express body parser limits for JSON and URL-encoded bodies
  // Increase limit to 10MB to handle base64-encoded images
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ limit: '10mb', extended: true }));

  // Configure Socket.io adapter with CORS
  app.useWebSocketAdapter(new IoAdapter(app));

  // Security - Configure Helmet to allow WebSocket connections
  app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for local development
    crossOriginEmbedderPolicy: false,
  }));
  app.use(compression());
  app.use(cookieParser());

  // CORS for HTTP - Allow frontend and local development
  const allowedOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000']; // Default Vite and React dev ports
  
  console.log('🌐 CORS Configuration:', {
    allowedOrigins,
    nodeEnv: process.env.NODE_ENV,
    corsOriginsEnv: process.env.CORS_ORIGINS
  });
  
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) {
        console.log('🌐 CORS: Allowing request with no origin');
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        console.log('✅ CORS: Allowing origin:', origin);
        callback(null, true);
      } 
      // Allow Vercel preview deployments (seka-svara-*-*.vercel.app pattern)
      else if (origin.includes('vercel.app') && (
        origin.includes('seka-svara') || 
        origin.includes('seka-svara-cp') ||
        origin.includes('seka-svara-frontend')
      )) {
        console.log('✅ CORS: Allowing Vercel deployment:', origin);
        callback(null, true);
      }
      // Allow in development mode
      else if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ CORS: Allowing in development mode:', origin);
        callback(null, true);
      } 
      else {
        console.error('❌ CORS: Blocking origin:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  // Register root endpoints before setting global prefix (so they're at root level)
  const httpAdapter = app.getHttpAdapter();
  
  // Health endpoint for Render health checks
  httpAdapter.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Root endpoint
  httpAdapter.get('/', (req, res) => {
    res.json({
      message: 'Seka Svara API',
      version: '1.0.0',
      documentation: '/api/docs',
      health: '/health',
      api: '/api/v1'
    });
  });

  // Global prefix - root endpoints are already registered at root level
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

