import { Controller, Get } from '@nestjs/common';

/**
 * Health Controller - Routes excluded from global prefix
 * This controller handles health checks at root level for Render/deployment platforms
 */
@Controller({ path: '', exclude: ['api/v1'] })
export class HealthController {
  @Get('health')
  getHealth() {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
}

