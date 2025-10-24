import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction, TransactionType, TransactionStatus, NetworkType } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { getAdminWalletAddress } from '../../config/admin-wallet.config';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    @InjectRepository(WalletTransaction)
    private transactionsRepository: Repository<WalletTransaction>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private addressGeneratorService: AddressGeneratorService,
    private blockchainService: BlockchainService,
  ) {}

  async getUserWallet(userId: string) {
    let wallet = await this.walletsRepository.findOne({ where: { userId } });

    if (!wallet) {
      // Create wallet with unique addresses if doesn't exist
      wallet = this.walletsRepository.create({ 
        userId,
        bep20Address: this.addressGeneratorService.generateBEP20Address(userId),
        trc20Address: this.addressGeneratorService.generateTRC20Address(userId),
      });
      await this.walletsRepository.save(wallet);
    }

    return wallet;
  }

  async getBalance(userId: string) {
    const wallet = await this.getUserWallet(userId);
    return {
      totalBalance: wallet.balance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
    };
  }

  /**
   * Sync contract balance to database
   * This syncs the SEKA contract balance from the blockchain to the user's database balance
   */
  async syncContractBalance(userId: string, contractBalance: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🔄 SYNCING CONTRACT BALANCE TO DATABASE`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`👤 User: ${user.email} (${user.id})`);
    this.logger.log(`📊 Old DB Balance: ${user.balance}`);
    this.logger.log(`💰 New Contract Balance: ${contractBalance}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // Update user's database balance to match contract balance
    user.balance = contractBalance;
    await this.usersRepository.save(user);

    this.logger.log(`✅ Balance synced successfully!`);

    return {
      success: true,
      oldBalance: user.balance,
      newBalance: contractBalance,
      message: 'Balance synced from contract to database',
    };
  }

  async generateDepositAddress(userId: string, network: 'BEP20' | 'TRC20') {
    const wallet = await this.getUserWallet(userId);
    
    if (network === 'BEP20') {
      if (!wallet.bep20Address) {
        wallet.bep20Address = this.addressGeneratorService.generateBEP20Address(userId);
        await this.walletsRepository.save(wallet);
      }
      return wallet.bep20Address;
    } else if (network === 'TRC20') {
      if (!wallet.trc20Address) {
        wallet.trc20Address = this.addressGeneratorService.generateTRC20Address(userId);
        await this.walletsRepository.save(wallet);
      }
      return wallet.trc20Address;
    }
    
    throw new BadRequestException('Invalid network type');
  }

  /**
   * Process deposit
   * 
   * NEW FLOW:
   * 1. User sends USDT from their wallet to ADMIN wallet address
   * 2. Backend verifies the transaction on blockchain
   * 3. Backend credits virtual balance to user's account (user.balance in DB)
   * 4. User plays games with virtual balance
   */
  async processDeposit(userId: string, depositDto: DepositDto) {
    const wallet = await this.getUserWallet(userId);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Get admin wallet address for this network
    const adminAddress = getAdminWalletAddress(depositDto.network as 'BEP20' | 'TRC20');
    
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`💰 DEPOSIT REQUEST`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`👤 User: ${user.email} (${user.id})`);
    this.logger.log(`💵 Amount: ${depositDto.amount} USDT`);
    this.logger.log(`🌐 Network: ${depositDto.network}`);
    this.logger.log(`📤 From Address: ${depositDto.fromAddress}`);
    this.logger.log(`📥 To Address (ADMIN): ${adminAddress}`);
    this.logger.log(`🔗 Tx Hash: ${depositDto.txHash}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Create transaction record
    const transaction = this.transactionsRepository.create({
      walletId: wallet.id,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      network: depositDto.network as NetworkType,
      amount: depositDto.amount,
      fromAddress: depositDto.fromAddress,
      toAddress: adminAddress, // ✅ Now using admin wallet address
      txHash: depositDto.txHash,
      description: `Deposit ${depositDto.amount} USDT via ${depositDto.network}`,
      metadata: {
        ...depositDto,
        adminAddress,
        userBalanceBefore: user.balance,
      },
    });
    
    await this.transactionsRepository.save(transaction);
    
    this.logger.log(`✅ Transaction record created: ${transaction.id}`);
    
    // TODO: In production, verify the transaction on blockchain:
    // 1. Check that txHash exists on blockchain
    // 2. Verify recipient is admin address
    // 3. Verify amount matches
    // 4. Wait for confirmations (6+ for security)
    // 
    // For now, we'll auto-confirm for testing
    this.logger.warn(`⚠️ AUTO-CONFIRMING FOR TESTING - In production, verify blockchain first!`);
    await this.confirmDeposit(transaction.id);
    
    return transaction;
  }

  async processWithdrawal(userId: string, withdrawDto: WithdrawDto) {
    const wallet = await this.getUserWallet(userId);
    
    // Check available balance
    if (wallet.availableBalance < withdrawDto.amount) {
      throw new BadRequestException('Insufficient balance');
    }
    
    // Create transaction record
    const transaction = this.transactionsRepository.create({
      walletId: wallet.id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      network: withdrawDto.network as NetworkType,
      amount: withdrawDto.amount,
      fromAddress: withdrawDto.network === 'BEP20' ? wallet.bep20Address : wallet.trc20Address,
      toAddress: withdrawDto.toAddress,
      description: `Withdrawal to ${withdrawDto.toAddress}`,
      metadata: withdrawDto,
    });
    
    await this.transactionsRepository.save(transaction);
    
    // Lock the funds
    wallet.availableBalance -= withdrawDto.amount;
    wallet.lockedBalance += withdrawDto.amount;
    await this.walletsRepository.save(wallet);
    
    // In a real implementation, you would:
    // 1. Execute the blockchain transfer
    // 2. Wait for confirmation
    // 3. Update transaction status
    
    // For now, we'll simulate a successful withdrawal
    await this.confirmWithdrawal(transaction.id);
    
    return transaction;
  }

  async lockFunds(userId: string, amount: number) {
    // Lock funds for betting
    const wallet = await this.getUserWallet(userId);

    if (wallet.availableBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    wallet.availableBalance -= amount;
    wallet.lockedBalance += amount;
    await this.walletsRepository.save(wallet);

    return wallet;
  }

  async unlockFunds(userId: string, amount: number) {
    // Unlock funds after game ends
    const wallet = await this.getUserWallet(userId);
    wallet.lockedBalance -= amount;
    wallet.availableBalance += amount;
    await this.walletsRepository.save(wallet);

    return wallet;
  }

  async addWinnings(userId: string, amount: number) {
    const wallet = await this.getUserWallet(userId);
    wallet.balance += amount;
    wallet.availableBalance += amount;
    await this.walletsRepository.save(wallet);

    return wallet;
  }

  async getTransactions(userId: string) {
    const wallet = await this.getUserWallet(userId);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Get transactions where:
    // 1. Transaction belongs to user's wallet (walletId)
    // 2. Transaction is related to user's addresses (fromAddress or toAddress)
    const transactions = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .where('transaction.walletId = :walletId', { walletId: wallet.id })
      .andWhere(
        '(transaction.fromAddress IN (:...userAddresses) OR transaction.toAddress IN (:...userAddresses) OR transaction.walletId = :walletId)',
        { 
          userAddresses: [wallet.bep20Address, wallet.trc20Address].filter(addr => !!addr),
          walletId: wallet.id 
        }
      )
      .orderBy('transaction.createdAt', 'DESC')
      .take(50) // Limit to last 50 transactions
      .getMany();
    
    this.logger.log(`📊 Found ${transactions.length} transactions for user ${user.email}`);
    this.logger.log(`🔍 Filtered by wallet addresses: ${[wallet.bep20Address, wallet.trc20Address].filter(addr => !!addr).join(', ')}`);
    
    return transactions;
  }

  /**
   * Confirm a deposit transaction and update USER VIRTUAL BALANCE
   * 
   * NEW FLOW:
   * - Transaction has been sent to admin wallet
   * - Now credit user's virtual balance (user.balance in database)
   * - User plays games with virtual balance
   */
  async confirmDeposit(transactionId: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
      relations: ['wallet'],
    });
    
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction already processed');
    }
    
    // Get wallet to ensure it's loaded
    const wallet = await this.walletsRepository.findOne({
      where: { id: transaction.walletId },
    });
    
    if (!wallet) {
      throw new NotFoundException('Wallet not found for this transaction');
    }
    
    // Get user associated with this wallet
    const user = await this.usersRepository.findOne({
      where: { id: wallet.userId },
    });
    
    if (!user) {
      throw new NotFoundException('User not found for this transaction');
    }
    
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`✅ CONFIRMING DEPOSIT`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📄 Transaction ID: ${transaction.id}`);
    this.logger.log(`👤 User: ${user.email} (${user.id})`);
    this.logger.log(`💰 Amount: ${transaction.amount} USDT`);
    this.logger.log(`💳 Balance Before: ${user.balance} USDT`);
    
    // Update transaction status
    transaction.status = TransactionStatus.CONFIRMED;
    transaction.confirmedAt = new Date();
    transaction.confirmations = 1; // In real implementation, get from blockchain
    
    // ✅ CREDIT USER'S VIRTUAL BALANCE (this is what they play games with)
    const oldBalance = user.balance;
    user.balance = Number(user.balance) + Number(transaction.amount);
    
    // Also update wallet balance for consistency (though games use user.balance)
    wallet.balance = Number(wallet.balance) + Number(transaction.amount);
    wallet.availableBalance = Number(wallet.availableBalance) + Number(transaction.amount);
    
    await this.transactionsRepository.save(transaction);
    await this.walletsRepository.save(wallet);
    await this.usersRepository.save(user);
    
    this.logger.log(`💳 Balance After: ${user.balance} USDT`);
    this.logger.log(`✅ Virtual balance credited!`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    return {
      transaction,
      user: {
        id: user.id,
        email: user.email,
        balanceBefore: oldBalance,
        balanceAfter: user.balance,
        credited: transaction.amount,
      },
    };
  }

  /**
   * Confirm a withdrawal transaction and update wallet balance
   */
  async confirmWithdrawal(transactionId: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
      relations: ['wallet'],
    });
    
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction already processed');
    }
    
    // Update transaction status
    transaction.status = TransactionStatus.CONFIRMED;
    transaction.confirmedAt = new Date();
    transaction.confirmations = 1; // In real implementation, get from blockchain
    
    // Update wallet balance
    const wallet = transaction.wallet;
    wallet.balance -= transaction.amount;
    wallet.lockedBalance -= transaction.amount;
    
    await this.transactionsRepository.save(transaction);
    await this.walletsRepository.save(wallet);
    
    return transaction;
  }

  /**
   * Get wallet addresses for a user
   */
  async getWalletAddresses(userId: string) {
    const wallet = await this.getUserWallet(userId);
    return {
      BEP20: wallet.bep20Address,
      TRC20: wallet.trc20Address,
    };
  }

  /**
   * Get wallet statistics
   */
  async getWalletStats(userId: string) {
    const wallet = await this.getUserWallet(userId);
    
    const transactions = await this.transactionsRepository.find({
      where: { walletId: wallet.id },
    });
    
    const deposits = transactions.filter(t => t.type === TransactionType.DEPOSIT && t.status === TransactionStatus.CONFIRMED);
    const withdrawals = transactions.filter(t => t.type === TransactionType.WITHDRAWAL && t.status === TransactionStatus.CONFIRMED);
    
    const totalDeposits = deposits.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    const totalWithdrawals = withdrawals.reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);
    
    return {
      totalBalance: wallet.balance,
      availableBalance: wallet.availableBalance,
      lockedBalance: wallet.lockedBalance,
      totalDeposits,
      totalWithdrawals,
      transactionCount: transactions.length,
    };
  }

  /**
   * Get wagering statistics for withdrawal requirements
   * Calculates total amount wagered in games (bets, antes, raises)
   */
  async getWageringStats(userId: string) {
    const wallet = await this.getUserWallet(userId);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Get all transactions for this user's wallet addresses
    const transactions = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .where('transaction.walletId = :walletId', { walletId: wallet.id })
      .andWhere(
        '(transaction.fromAddress IN (:...userAddresses) OR transaction.toAddress IN (:...userAddresses) OR transaction.walletId = :walletId)',
        { 
          userAddresses: [wallet.bep20Address, wallet.trc20Address].filter(addr => !!addr),
          walletId: wallet.id 
        }
      )
      .getMany();
    
    // Calculate total deposited (confirmed deposits only)
    const deposits = transactions.filter(
      t => t.type === TransactionType.DEPOSIT && t.status === TransactionStatus.CONFIRMED
    );
    const totalDeposited = deposits.reduce(
      (sum, t) => sum + parseFloat(t.amount.toString()), 
      0
    );
    
    // Calculate total wagered (all game-related transactions where money went OUT)
    // This includes: game_bet, game_ante, game_raise
    const gameTransactions = transactions.filter(t => 
      t.type && (
        t.type.toString().includes('game_bet') || 
        t.type.toString().includes('game_ante') || 
        t.type.toString().includes('game_raise') ||
        t.type === 'game_bet' as any
      )
    );
    
    const totalWagered = gameTransactions.reduce(
      (sum, t) => sum + parseFloat(t.amount.toString()), 
      0
    );
    
    // Calculate max withdrawable (totalWagered / 1.3)
    const maxWithdrawable = totalWagered / 1.3;
    
    this.logger.log(`📊 Wagering Stats for ${user.email}:`);
    this.logger.log(`   💰 Total Deposited: ${totalDeposited} SEKA`);
    this.logger.log(`   🎲 Total Wagered: ${totalWagered} SEKA`);
    this.logger.log(`   💸 Max Withdrawable: ${maxWithdrawable.toFixed(2)} SEKA`);
    this.logger.log(`   🎮 Game Transactions: ${gameTransactions.length}`);
    
    return {
      totalDeposited,
      totalWagered,
      maxWithdrawable,
      currentBalance: user.balance,
      gameTransactionCount: gameTransactions.length,
    };
  }

}

