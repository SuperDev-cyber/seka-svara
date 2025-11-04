import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // Health check at root level (excluded from global prefix) for Render health checks
  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Health check with API prefix for programmatic access
  @Get('api/v1/health')
  getHealthApi() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get()
  getRoot() {
    return {
      message: 'Seka Svara API',
      version: '1.0.0',
      documentation: '/api/docs',
    };
  }
}

