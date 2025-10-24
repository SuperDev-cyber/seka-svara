import { Controller, Get, Put, Body, UseGuards, Query } from '@nestjs/common';
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
}

