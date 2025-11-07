import { Controller, Get, Put, Delete, Body, UseGuards, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard-stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('settings')
  @ApiOperation({ summary: 'Get platform settings' })
  async getSettings() {
    return this.adminService.getSettings();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update platform settings' })
  async updateSettings(@Body() updateSettingsDto: UpdatePlatformSettingsDto) {
    return this.adminService.updateSettings(updateSettingsDto);
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users with filters' })
  async getUsers(
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('status') status: string,
  ) {
    return this.adminService.getUsers(page, limit, status);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get all transactions' })
  async getTransactions(
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.adminService.getTransactions(page, limit);
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get platform reports' })
  async getReports(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.adminService.getReports(startDate, endDate);
  }

  @Get('score-transactions')
  @ApiOperation({ summary: 'Get all Seka-Svara Score transactions' })
  async getScoreTransactions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 100,
  ) {
    return this.adminService.getScoreTransactions(page, limit);
  }

  @Get('score-statistics')
  @ApiOperation({ summary: 'Get Seka-Svara Score statistics' })
  async getScoreStatistics() {
    return this.adminService.getScoreStatistics();
  }

  @Put('score-transactions/:id')
  @ApiOperation({ summary: 'Update a Seka-Svara Score transaction' })
  async updateScoreTransaction(
    @Param('id') id: string,
    @Body() updateData: { amount?: number; type?: string; description?: string },
  ) {
    return this.adminService.updateScoreTransaction(id, updateData);
  }

  @Delete('score-transactions/:id')
  @ApiOperation({ summary: 'Delete a Seka-Svara Score transaction' })
  async deleteScoreTransaction(@Param('id') id: string) {
    return this.adminService.deleteScoreTransaction(id);
  }

  @Get('game-tables')
  @ApiOperation({ summary: 'Get all game tables with detailed information' })
  async getGameTables(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('status') status?: string,
  ) {
    // Parse page and limit as integers (query params come as strings)
    const parsedPage = parseInt(String(page)) || 1;
    const parsedLimit = parseInt(String(limit)) || 50;
    return this.adminService.getGameTables(parsedPage, parsedLimit, status);
  }

  @Get('total-locked-funds')
  @ApiOperation({ summary: 'Get total MAINNET funds locked in platform ecosystem' })
  async getTotalLockedFunds() {
    return this.adminService.getTotalLockedFunds();
  }
}

