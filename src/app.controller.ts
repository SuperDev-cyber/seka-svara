import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  // Health check at root level (bypasses global prefix) for Render health checks
  @Get('/health')
  getHealthRoot() {
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

