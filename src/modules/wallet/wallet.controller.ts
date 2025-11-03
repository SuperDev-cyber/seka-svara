import { Controller, Get, Post, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { getAdminWalletAddress, ADMIN_WALLETS } from '../../config/admin-wallet.config';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get()
  @ApiOperation({ summary: 'Get user wallet' })
  async getWallet(@Request() req) {
    return this.walletService.getUserWallet(req.user.id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get wallet balance' })
  async getBalance(@Request() req) {
    return this.walletService.getBalance(req.user.id);
  }

  @Post('sync-balance')
  @ApiOperation({ summary: 'Sync contract balance to database' })
  async syncBalance(@Request() req, @Body() body: { contractBalance: number }) {
    return this.walletService.syncContractBalance(req.user.id, body.contractBalance);
  }

  @Post('generate-address')
  @ApiOperation({ summary: 'Generate deposit address' })
  async generateAddress(@Request() req, @Body() body: { network: 'BEP20' | 'TRC20' }) {
    return this.walletService.generateDepositAddress(req.user.id, body.network);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Process deposit' })
  async deposit(@Request() req, @Body() depositDto: DepositDto) {
    return this.walletService.processDeposit(req.user.id, depositDto);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Request withdrawal' })
  async withdraw(@Request() req, @Body() withdrawDto: WithdrawDto) {
    return this.walletService.processWithdrawal(req.user.id, withdrawDto);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'Get wallet transactions' })
  async getTransactions(@Request() req) {
    return this.walletService.getTransactions(req.user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get wallet statistics' })
  async getStats(@Request() req) {
    return this.walletService.getWalletStats(req.user.id);
  }

  @Get('wagering-stats')
  @ApiOperation({ summary: 'Get wagering statistics for withdrawal requirements' })
  async getWageringStats(@Request() req) {
    return this.walletService.getWageringStats(req.user.id);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get wallet addresses' })
  async getAddresses(@Request() req) {
    return this.walletService.getWalletAddresses(req.user.id);
  }

  @Public()
  @Get('admin-addresses')
  @ApiOperation({ summary: 'Get admin wallet addresses for deposits' })
  async getAdminAddresses(@Query('network') network?: 'BEP20' | 'TRC20') {
    if (network) {
      return {
        network,
        address: getAdminWalletAddress(network),
        details: ADMIN_WALLETS[network],
      };
    }
    
    // Return all admin addresses
    return {
      BEP20: {
        address: ADMIN_WALLETS.BEP20.address,
        network: ADMIN_WALLETS.BEP20.network,
        chainId: ADMIN_WALLETS.BEP20.chainId,
        USDTContractAddress: ADMIN_WALLETS.BEP20.USDTContractAddress,
      },
      TRC20: {
        address: ADMIN_WALLETS.TRC20.address,
        network: ADMIN_WALLETS.TRC20.network,
        USDTContractAddress: ADMIN_WALLETS.TRC20.USDTContractAddress,
      },
    };
  }

  @Post('confirm-deposit/:transactionId')
  @ApiOperation({ summary: 'Confirm deposit transaction' })
  async confirmDeposit(@Request() req, @Param('transactionId') transactionId: string) {
    return this.walletService.confirmDeposit(transactionId);
  }

  @Post('confirm-withdrawal/:transactionId')
  @ApiOperation({ summary: 'Confirm withdrawal transaction' })
  async confirmWithdrawal(@Request() req, @Param('transactionId') transactionId: string) {
    return this.walletService.confirmWithdrawal(transactionId);
  }
}

