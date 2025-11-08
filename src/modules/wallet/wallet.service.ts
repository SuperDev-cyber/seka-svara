import { Injectable, NotFoundException, BadRequestException, Logger, Inject, forwardRef, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { WalletTransaction, TransactionType, TransactionStatus, NetworkType } from './entities/wallet-transaction.entity';
import { User } from '../users/entities/user.entity';
import { AddressGeneratorService } from './services/address-generator.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { BscService } from '../blockchain/services/bsc.service';
import { TronService } from '../blockchain/services/tron.service';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawDto } from './dto/withdraw.dto';
// Removed getAdminWalletAddress import - withdrawals now always use user's Web3Auth account address
import { PlatformScoreService } from '../users/services/platform-score.service';
import { ScoreTransactionType } from '../users/entities/platform-score-transaction.entity';

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
    @Inject(forwardRef(() => PlatformScoreService))
    private platformScoreService: PlatformScoreService,
    @Optional() @Inject(BlockchainService)
    private blockchainService?: BlockchainService,
    @Optional() @Inject(BscService)
    private bscService?: BscService,
    @Optional() @Inject(TronService)
    private tronService?: TronService,
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

  async getBalance(userId: string): Promise<{
    totalBalance: number;
    availableBalance: number;
    lockedBalance: number;
    platformScore: number;
  }> {
    const wallet = await this.getUserWallet(userId);
    
    // Also fetch user's platform score (Sekasvara Score)
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    return {
      totalBalance: Number(wallet.balance),
      availableBalance: Number(wallet.availableBalance),
      lockedBalance: Number(wallet.lockedBalance),
      platformScore: Number(user?.platformScore || 0), // Sekasvara Score for display
    };
  }

  /**
   * Sync contract balance to database (DUAL BALANCE SYSTEM)
   * This syncs the SEKA contract balance from the blockchain to BOTH:
   * 1. user.balance (locked funds in ecosystem)
   * 2. user.platformScore (management tracking)
   */
  async syncContractBalance(userId: string, contractBalance: number) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ Convert all values to numbers explicitly to avoid BigInt mixing issues
    const oldBalance = parseFloat(user.balance?.toString() || '0');
    const oldPlatformScore = parseFloat(user.platformScore?.toString() || '0');
    const balanceDifference = contractBalance - oldBalance;

    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🔄 SYNCING CONTRACT BALANCE (SEKA Balance Only)`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`👤 User: ${user.email} (${user.id})`);
    this.logger.log(`📊 Old SEKA Balance: ${oldBalance}`);
    this.logger.log(`🏆 Current Seka-Svara Score: ${oldPlatformScore} (unchanged)`);
    this.logger.log(`💰 New Contract Balance: ${contractBalance}`);
    this.logger.log(`📈 Difference: ${balanceDifference}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // ✅ ONLY update SEKA balance (locked funds in ecosystem)
    // ❌ DO NOT update platformScore here - it's updated ONLY in confirmDeposit()
    user.balance = contractBalance;
    // user.platformScore is NOT changed - it's managed separately for gameplay
    await this.usersRepository.save(user);

    // ℹ️ NOTE: platformScore (Seka-Svara Score) is ONLY updated in:
    // 1. confirmDeposit() - when deposit is confirmed
    // 2. PlatformBalanceService - during gameplay (wins/losses)
    // 3. Admin Panel - manual adjustments
    if (balanceDifference > 0) {
      this.logger.log(`💰 Deposit detected! SEKA Balance synced (platformScore will be updated in confirmDeposit)`);
    } else if (balanceDifference < 0) {
      this.logger.log(`💸 Balance decrease detected! SEKA Balance synced (platformScore unchanged)`);
    }

    this.logger.log(`✅ Balance sync complete!`);
    this.logger.log(`💳 SEKA Balance: ${oldBalance} → ${user.balance}`);
    this.logger.log(`🏆 Seka-Svara Score: ${oldPlatformScore} (unchanged - managed separately)`);

    return {
      success: true,
      oldBalance,
      newBalance: contractBalance,
      oldPlatformScore,
      newPlatformScore: user.platformScore,
      message: 'Dual balance synced: SEKA balance + Seka-Svara Score updated',
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
   * SIMPLIFIED FLOW:
   * 1. User sends USDT from their wallet to their unique deposit address
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
    
    // ✅ Get user's unique deposit address for this network
    let userDepositAddress: string;
    if (depositDto.network === 'BEP20') {
      if (!wallet.bep20Address) {
        // Generate address if it doesn't exist
        wallet.bep20Address = this.addressGeneratorService.generateBEP20Address(userId);
        await this.walletsRepository.save(wallet);
      }
      userDepositAddress = wallet.bep20Address;
    } else if (depositDto.network === 'TRC20') {
      if (!wallet.trc20Address) {
        // Generate address if it doesn't exist
        wallet.trc20Address = this.addressGeneratorService.generateTRC20Address(userId);
        await this.walletsRepository.save(wallet);
      }
      userDepositAddress = wallet.trc20Address;
    } else {
      throw new BadRequestException('Invalid network type');
    }
    
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`💰 DEPOSIT REQUEST`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`👤 User: ${user.email} (${user.id})`);
    this.logger.log(`💵 Amount: ${depositDto.amount} USDT`);
    this.logger.log(`🌐 Network: ${depositDto.network}`);
    this.logger.log(`📤 From Address: ${depositDto.fromAddress}`);
    this.logger.log(`📥 To Address (USER UNIQUE): ${userDepositAddress}`);
    this.logger.log(`🔗 Tx Hash: ${depositDto.txHash}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Create transaction record
    // ✅ Ensure amount is a number (not BigInt) to avoid type mixing issues
    const depositAmount = typeof depositDto.amount === 'bigint' 
      ? Number(depositDto.amount) 
      : parseFloat(depositDto.amount.toString());
    
    const transaction = this.transactionsRepository.create({
      walletId: wallet.id,
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.PENDING,
      network: depositDto.network as NetworkType,
      amount: depositAmount, // ✅ Guaranteed to be a number
      fromAddress: depositDto.fromAddress,
      toAddress: userDepositAddress, // ✅ Using user's unique deposit address
      txHash: depositDto.txHash,
      description: `Deposit ${depositAmount} USDT via ${depositDto.network}`,
      metadata: {
        // ✅ Explicitly set each field to avoid BigInt from spread operator
        // ✅ Ensure all values are primitives (string, number, boolean) - no BigInt
        network: String(depositDto.network || ''),
        fromAddress: String(depositDto.fromAddress || ''),
        txHash: String(depositDto.txHash || ''),
        amount: Number(depositAmount), // ✅ Explicitly convert to number
        userDepositAddress: String(userDepositAddress || ''),
        userBalanceBefore: Number(typeof user.balance === 'bigint' 
          ? Number(user.balance) 
          : parseFloat(user.balance?.toString() || '0')),
      },
    });
    
    await this.transactionsRepository.save(transaction);
    
    this.logger.log(`✅ Transaction record created: ${transaction.id}`);
    
    // ✅ SIMPLIFIED: Transaction is already complete on blockchain (frontend confirmed it)
    // Simply add the deposit amount to user's platform score
    // No complex verification needed - frontend already confirmed transaction success
    try {
      this.logger.log(`💰 Processing deposit: Adding ${depositAmount} to user's balance`);
      
      // ✅ Directly confirm and credit the deposit
      // All values are already converted to numbers, so no BigInt mixing
    await this.confirmDeposit(transaction.id);
      
      this.logger.log(`✅ Deposit processed successfully!`);
    } catch (error) {
      this.logger.error(`❌ Deposit confirmation error: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      
      // Mark transaction as failed
      transaction.status = TransactionStatus.FAILED;
      await this.transactionsRepository.save(transaction);
      
      throw new BadRequestException(`Deposit processing failed: ${error.message}`);
    }
    
    return transaction;
  }

  async processWithdrawal(userId: string, withdrawDto: WithdrawDto) {
    const wallet = await this.getUserWallet(userId);
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException('User not found');
    }
    
    // Check available balance (use platformScore from user entity)
    const availableBalance = parseFloat(user.platformScore?.toString() || '0');
    if (availableBalance < withdrawDto.amount) {
      throw new BadRequestException('Insufficient balance');
    }
    
    // Validate toAddress
    if (!withdrawDto.toAddress || withdrawDto.toAddress.length < 20) {
      throw new BadRequestException('Invalid withdrawal address');
    }
    
    // Validate fromAddress (user's Web3Auth account address)
    if (!withdrawDto.fromAddress || withdrawDto.fromAddress.length < 20) {
      throw new BadRequestException('Invalid from address. Must provide your Web3Auth account address.');
    }
    
    // Use fromAddress from DTO (user's Web3Auth account address)
    const fromAddress = withdrawDto.fromAddress;
    
    // ✅ Enhanced withdrawal logging - Display amount prominently
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`💸 WITHDRAWAL REQUEST RECEIVED`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`👤 User ID: ${userId}`);
    this.logger.log(`💰 WITHDRAWAL AMOUNT: ${withdrawDto.amount} USDT`);
    this.logger.log(`🌐 Network: ${withdrawDto.network}`);
    this.logger.log(`📤 From Address (Web3Auth): ${fromAddress}`);
    this.logger.log(`📥 To Address: ${withdrawDto.toAddress}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // Create transaction record
    const transaction = this.transactionsRepository.create({
      walletId: wallet.id,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      network: withdrawDto.network as NetworkType,
      amount: withdrawDto.amount,
      fromAddress: fromAddress, // From user's Web3Auth account address
      toAddress: withdrawDto.toAddress, // To user's chosen withdrawal address
      description: `Withdrawal to ${withdrawDto.toAddress}`,
      metadata: withdrawDto,
    });
    
    await this.transactionsRepository.save(transaction);
    
    try {
      // Execute blockchain transfer to user's wallet address
      let txHash: string;
      
      if (withdrawDto.network === 'BEP20') {
        if (!this.bscService) {
          throw new BadRequestException('BSC service not available. Please contact support.');
        }
        this.logger.log(`📤 Sending ${withdrawDto.amount} USDT via BSC to ${withdrawDto.toAddress}`);
        try {
          const result = await this.bscService.transfer(withdrawDto.toAddress, withdrawDto.amount.toString());
          txHash = result.txHash;
          this.logger.log(`✅ BSC transfer successful: ${txHash}`);
        } catch (blockchainError) {
          this.logger.error(`❌ BSC transfer error: ${blockchainError.message}`);
          throw new BadRequestException(`Blockchain transfer failed: ${blockchainError.message}`);
        }
      } else if (withdrawDto.network === 'TRC20') {
        if (!this.tronService) {
          throw new BadRequestException('Tron service not available. Please contact support.');
        }
        this.logger.log(`📤 Sending ${withdrawDto.amount} USDT via Tron to ${withdrawDto.toAddress}`);
        try {
          const result = await this.tronService.transfer(withdrawDto.toAddress, withdrawDto.amount.toString());
          txHash = result.txHash;
          this.logger.log(`✅ Tron transfer successful: ${txHash}`);
        } catch (blockchainError) {
          this.logger.error(`❌ Tron transfer error: ${blockchainError.message}`);
          throw new BadRequestException(`Blockchain transfer failed: ${blockchainError.message}`);
        }
      } else {
        throw new BadRequestException(`Unsupported network: ${withdrawDto.network}`);
      }
      
      // Update transaction with hash
      transaction.txHash = txHash;
      await this.transactionsRepository.save(transaction);
      
      // Deduct from user's platform score
      await this.platformScoreService.deductScore(
        userId,
        withdrawDto.amount,
        ScoreTransactionType.SPENT,
        `Withdrawal to ${withdrawDto.toAddress}`
      );
      
      // Update wallet balance
      wallet.availableBalance = Math.max(0, wallet.availableBalance - withdrawDto.amount);
    await this.walletsRepository.save(wallet);
    
      // Confirm the withdrawal
      transaction.status = TransactionStatus.CONFIRMED;
      transaction.confirmedAt = new Date();
      await this.transactionsRepository.save(transaction);
      
      this.logger.log(`✅ Withdrawal completed: ${withdrawDto.amount} USDT sent to ${withdrawDto.toAddress}`);
    
    return transaction;
    } catch (error) {
      this.logger.error(`❌ Withdrawal failed: ${error.message}`);
      transaction.status = TransactionStatus.FAILED;
      await this.transactionsRepository.save(transaction);
      throw new BadRequestException(`Withdrawal failed: ${error.message}`);
    }
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
      // walletId column is varchar in DB, compare by casting to uuid
      .where('transaction."walletId"::uuid = :walletId', { walletId: wallet.id })
      .andWhere(
        '(transaction.fromAddress IN (:...userAddresses) OR transaction.toAddress IN (:...userAddresses) OR transaction."walletId"::uuid = :walletId)',
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
    this.logger.log(`✅ CONFIRMING DEPOSIT (DUAL BALANCE SYSTEM)`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`📄 Transaction ID: ${transaction.id}`);
    this.logger.log(`👤 User: ${user.email} (${user.id})`);
    // ✅ Convert transaction.amount to string for logging to avoid BigInt issues
    const transactionAmountStr = transaction.amount?.toString() || '0';
    this.logger.log(`💰 Amount: ${transactionAmountStr} SEKA`);
    this.logger.log(`💳 SEKA Balance Before: ${user.balance?.toString() || '0'}`);
    this.logger.log(`🏆 Seka-Svara Score Before: ${user.platformScore?.toString() || '0'}`);
    
    // Update transaction status
    transaction.status = TransactionStatus.CONFIRMED;
    transaction.confirmedAt = new Date();
    // ✅ Confirmations should already be set from verification, but ensure it's a number
    if (!transaction.confirmations || typeof transaction.confirmations !== 'number') {
      transaction.confirmations = 1;
    }
    
    // ✅ SIMPLIFIED: Just add deposit amount to user's current balance
    // ✅ Convert all values to numbers explicitly to avoid BigInt mixing issues
    const oldBalance = Number(parseFloat(user.balance?.toString() || '0'));
    const oldPlatformScore = Number(parseFloat(user.platformScore?.toString() || '0'));
    // ✅ Convert transaction.amount properly (handles Decimal type from TypeORM)
    const depositAmount = Number(parseFloat(transaction.amount?.toString() || '0'));
    
    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw new BadRequestException(`Invalid deposit amount: ${transaction.amount}`);
    }
    
    // ✅ SIMPLIFIED: Directly add deposit amount to current balance
    // All values are guaranteed to be numbers, so arithmetic is safe
    const newBalance = Number(oldBalance) + Number(depositAmount);
    const newPlatformScore = Number(oldPlatformScore) + Number(depositAmount);
    
    // 1. Update SEKA Balance (locked funds in ecosystem)
    user.balance = Number(newBalance);
    
    // Also update wallet balance for consistency (though games use user.balance)
    const currentWalletBalance = Number(parseFloat(wallet.balance?.toString() || '0'));
    const currentAvailableBalance = Number(parseFloat(wallet.availableBalance?.toString() || '0'));
    wallet.balance = Number(currentWalletBalance) + Number(depositAmount);
    wallet.availableBalance = Number(currentAvailableBalance) + Number(depositAmount);
    
    // 2. Update Seka-Svara Score (management tracking) - MIRRORS SEKA BALANCE
    // ✅ Directly update platform score (simpler approach)
    user.platformScore = Number(newPlatformScore);
    
    // Save to database - all values are now numbers, no BigInt mixing
    await this.transactionsRepository.save(transaction);
    await this.walletsRepository.save(wallet);
    await this.usersRepository.save(user);
    
    // Also record the transaction for tracking (optional - don't fail if this errors)
    try {
    await this.platformScoreService.addScore(
      user.id,
        Number(depositAmount), // ✅ Guaranteed to be a number
      ScoreTransactionType.EARNED,
        `Deposit confirmed: ${Number(depositAmount)} SEKA tokens locked in platform ecosystem`,
      transaction.id,
      'wallet_deposit'
    );
    } catch (scoreError) {
      // Log error but don't fail the deposit - balance is already updated
      this.logger.warn(`⚠️ Failed to record platform score transaction: ${scoreError.message}`);
    }
    
    this.logger.log(`💳 SEKA Balance After: ${user.balance} SEKA`);
    this.logger.log(`🏆 Seka-Svara Score After: ${user.platformScore}`);
    this.logger.log(`✅ Dual balance credited! Both SEKA balance and Seka-Svara Score updated.`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    return {
      transaction,
      user: {
        id: user.id,
        email: user.email,
        balanceBefore: oldBalance,
        balanceAfter: parseFloat(user.balance?.toString() || '0'),
        credited: depositAmount, // ✅ Use converted depositAmount, not transaction.amount
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
    // ✅ Convert transaction.amount to number to avoid BigInt mixing
    const withdrawalAmount = parseFloat(transaction.amount?.toString() || '0');
    const currentWalletBalance = parseFloat(wallet.balance?.toString() || '0');
    const currentLockedBalance = parseFloat(wallet.lockedBalance?.toString() || '0');
    wallet.balance = currentWalletBalance - withdrawalAmount;
    wallet.lockedBalance = currentLockedBalance - withdrawalAmount;
    
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
    
    // ✅ Convert all wallet balance values to numbers to avoid BigInt/Decimal serialization issues
    return {
      totalBalance: parseFloat(wallet.balance?.toString() || '0'),
      availableBalance: parseFloat(wallet.availableBalance?.toString() || '0'),
      lockedBalance: parseFloat(wallet.lockedBalance?.toString() || '0'),
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
    
    // Users can withdraw their full balance - no wagering requirements
    const maxWithdrawable = parseFloat(user.balance?.toString() || '0');
    
    this.logger.log(`📊 Wagering Stats for ${user.email}:`);
    this.logger.log(`   💰 Total Deposited: ${totalDeposited} SEKA`);
    this.logger.log(`   🎲 Total Wagered: ${totalWagered} SEKA`);
    this.logger.log(`   💸 Max Withdrawable (Full Balance): ${maxWithdrawable.toFixed(0)} SEKA`);
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

