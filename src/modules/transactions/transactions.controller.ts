import { Controller, Get, Param, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user transactions' })
  async getUserTransactions(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('type') type?: string,
  ) {
    return this.transactionsService.getUserTransactions(req.user.id, page, limit, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get transaction by ID' })
  async getTransaction(@Param('id') id: string) {
    return this.transactionsService.findOne(id);
  }

  @Get('verify/:txHash')
  @ApiOperation({ summary: 'Verify blockchain transaction' })
  async verifyTransaction(@Param('txHash') txHash: string, @Query('network') network: string) {
    return this.transactionsService.verifyBlockchainTransaction(txHash, network as any);
  }

  @Get('admin/all')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get all transactions (Admin only)' })
  async getAllTransactions(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.transactionsService.findAll(page, limit);
  }
}

