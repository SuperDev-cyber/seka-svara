import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSettings } from './entities/platform-settings.entity';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { User } from '../users/entities/user.entity';
import { UserStatus } from '../users/enums/user-status.enum';
import { PlatformScoreService } from '../users/services/platform-score.service';
import { GameTable } from '../tables/entities/game-table.entity';
import { Game } from '../game/entities/game.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(PlatformSettings)
    private settingsRepository: Repository<PlatformSettings>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(GameTable)
    private gameTablesRepository: Repository<GameTable>,
    @InjectRepository(Game)
    private gamesRepository: Repository<Game>,
    private platformScoreService: PlatformScoreService,
  ) {}

  async getDashboardStats() {
    try {
      // Get total users count
      const totalUsers = await this.usersRepository.count();

      // Get total platform score transactions
      const totalTransactionsResult = await this.usersRepository.query(
        `SELECT COUNT(*) as count FROM platform_score_transactions`
      );
      const totalTransactions = parseInt(totalTransactionsResult[0]?.count || 0);

      // Get total commission (sum of platform scores earned)
      const totalCommissionResult = await this.usersRepository.query(
        `SELECT SUM(amount) as total 
         FROM platform_score_transactions 
         WHERE type IN ('earned', 'bonus')`
      );
      const totalCommission = parseFloat(totalCommissionResult[0]?.total || 0);

      // Get active tables/games count (playing or waiting tables)
      const activeTablesResult = await this.usersRepository.query(
        `SELECT COUNT(*) as count FROM game_tables WHERE status IN ('playing', 'waiting')`
      );
      const activeTables = parseInt(activeTablesResult[0]?.count || 0);

      // Get latest transactions (last 5)
      const latestTransactionsResult = await this.usersRepository.query(
        `SELECT 
          pst.id,
          pst.amount,
          pst.type,
          pst."createdAt",
          u.username,
          u.email
         FROM platform_score_transactions pst
         JOIN users u ON pst."userId" = u.id
         ORDER BY pst."createdAt" DESC
         LIMIT 5`
      );

      const latestTransactions = latestTransactionsResult.map(tx => ({
        id: tx.id,
        userName: tx.username || tx.email.split('@')[0],
        type: tx.type.toUpperCase(),
        date: new Date(tx.createdAt).toLocaleString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        }),
        amount: `$${parseFloat(tx.amount).toFixed(0)}`,
        status: parseFloat(tx.amount) > 0 ? 'Success' : 'Failed'
      }));

      // Get latest registered users (last 5)
      const latestUsersResult = await this.usersRepository.query(
        `SELECT 
          id,
          username,
          email,
          "bep20WalletAddress",
          status,
          "createdAt"
         FROM users
         ORDER BY "createdAt" DESC
         LIMIT 5`
      );

      const latestUsers = latestUsersResult.map(user => ({
        id: user.id,
        userName: user.username || user.email.split('@')[0],
        address: user.bep20WalletAddress ? 
          `${user.bep20WalletAddress.substring(0, 6)}...${user.bep20WalletAddress.substring(user.bep20WalletAddress.length - 4)}` : 
          'N/A',
        status: user.status === 'active' ? 'Active' : user.status === 'blocked' ? 'Blocked' : 'Pending',
        date: new Date(user.createdAt).toISOString().split('T')[0]
      }));

      return {
        totalUsers,
        totalTransactions,
        totalCommission: Math.round(totalCommission),
        activeTables,
        latestTransactions,
        latestUsers,
        revenueData: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Monthly data placeholder
        userGrowthData: [100, 120, 150, 180, 200, 250, 300, 350, 400, 450, 500, totalUsers],
        transactionTypes: [
          { type: 'Deposits', count: 45, percentage: 45 },
          { type: 'Withdrawals', count: 30, percentage: 30 },
          { type: 'Games', count: 25, percentage: 25 }
        ]
      };
    } catch (error) {
      this.logger.error('Error fetching dashboard stats:', error);
      return {
        totalUsers: 0,
        totalTransactions: 0,
        totalCommission: 0,
        activeTables: 0,
        latestTransactions: [],
        latestUsers: [],
        revenueData: [],
        userGrowthData: [],
        transactionTypes: []
      };
    }
  }

  async getSettings() {
    // TODO: Get platform settings
    const settings = await this.settingsRepository.findOne({ where: { id: 1 } });
    return settings || this.createDefaultSettings();
  }

  async updateSettings(updateSettingsDto: UpdatePlatformSettingsDto) {
    // TODO: Update platform settings
    throw new Error('Method not implemented');
  }

  async getUsers(page: number = 1, limit: number = 10, status?: string) {
    const queryBuilder = this.usersRepository.createQueryBuilder('user');

    // Apply status filter if provided
    if (status && status !== 'All Status') {
      let dbStatus: UserStatus;
      switch (status.toLowerCase()) {
        case 'active':
          dbStatus = UserStatus.ACTIVE;
          break;
        case 'pending':
          dbStatus = UserStatus.INACTIVE;
          break;
        case 'block':
        case 'blocked':
          dbStatus = UserStatus.BANNED;
          break;
        default:
          dbStatus = UserStatus.ACTIVE;
      }
      queryBuilder.where('user.status = :status', { status: dbStatus });
    }

    // Get all users (no pagination for now, can add later if needed)
    const users = await queryBuilder
      .orderBy('user.createdAt', 'DESC')
      .getMany();

    // Transform users to match frontend format
    return users.map((user) => {
      // Calculate win ratio
      const winRatio = user.totalGamesPlayed > 0 
        ? Math.round((user.totalGamesWon / user.totalGamesPlayed) * 100)
        : 0;

      // Format status for frontend
      let frontendStatus = 'Active';
      if (user.status === UserStatus.INACTIVE) {
        frontendStatus = 'Pending';
      } else if (user.status === UserStatus.BANNED) {
        frontendStatus = 'Block';
      } else if (user.status === UserStatus.SUSPENDED) {
        frontendStatus = 'Block';
      }

      // Get wallet address (prefer BEP20, fallback to TRC20 or ERC20)
      const walletAddress = user.bep20WalletAddress || user.trc20WalletAddress || user.erc20WalletAddress || 'N/A';
      
      // Format wallet address to show first 6 and last 6 characters
      const formattedWallet = walletAddress !== 'N/A' && walletAddress.length > 12
        ? `${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 6)}`
        : walletAddress;

      return {
        id: user.id,
        name: user.username,
        email: user.email,
        walletAddress: formattedWallet,
        platformScore: Number(user.platformScore) || 0,
        status: frontendStatus,
        registered: user.createdAt ? new Date(user.createdAt).toISOString().split('T')[0] : 'N/A',
        gamesPlayed: user.totalGamesPlayed || 0,
        winRatio: winRatio,
      };
    });
  }

  async getTransactions(page: number = 1, limit: number = 10) {
    const offset = (page - 1) * limit;
    
    try {
      // Get all wallet transactions with user info using raw query
      const transactionsResult = await this.usersRepository.query(`
        SELECT 
          wt.id,
          wt.type,
          wt.status,
          wt.network,
          wt.amount,
          wt."fromAddress",
          wt."toAddress",
          wt."txHash",
          wt."createdAt",
          u.id as "userId",
          u.username,
          u.email
        FROM wallet_transactions wt
        -- wallet_transactions.walletId is stored as varchar; wallets.id is uuid
        -- Cast to avoid operator error (character varying = uuid)
        JOIN wallets w ON wt."walletId"::uuid = w.id
        JOIN users u ON w."userId" = u.id
        ORDER BY wt."createdAt" DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);
      
      // Count total transactions
      const countResult = await this.usersRepository.query(`
        SELECT COUNT(*) as count FROM wallet_transactions
      `);
      const total = parseInt(countResult[0]?.count || '0');

      return {
        transactions: transactionsResult,
        total,
        page,
        limit
      };
    } catch (error) {
      this.logger.error('Error fetching transactions:', error);
      return {
        transactions: [],
        total: 0,
        page,
        limit
      };
    }
  }

  async getReports(startDate: string, endDate: string) {
    // TODO: Generate reports
    throw new Error('Method not implemented');
  }

  async getScoreTransactions(page: number = 1, limit: number = 100) {
    const offset = (page - 1) * limit;
    return this.platformScoreService.getAllScoreTransactions(limit, offset);
  }

  async getScoreStatistics() {
    return this.platformScoreService.getScoreStatistics();
  }

  /**
   * Get total MAINNET funds locked in the platform ecosystem
   * This represents the sum of all user balances (platform scores) across the platform
   */
  async getTotalLockedFunds() {
    try {
      // Get total platform score (sum of all user platform scores)
      // This represents the total USDT locked in the platform ecosystem
      const totalPlatformScoreResult = await this.usersRepository
        .createQueryBuilder('user')
        .select('SUM(user.platformScore)', 'total')
        .getRawOne();

      const totalPlatformScore = parseFloat(totalPlatformScoreResult?.total || '0');

      // Also get total user balance (sum of all user.balance)
      const totalUserBalanceResult = await this.usersRepository
        .createQueryBuilder('user')
        .select('SUM(user.balance)', 'total')
        .getRawOne();

      const totalUserBalance = parseFloat(totalUserBalanceResult?.total || '0');

      // Get total deposits and withdrawals for reference
      const depositsResult = await this.usersRepository.query(`
        SELECT SUM(amount) as total 
        FROM wallet_transactions 
        WHERE type = 'deposit' AND status = 'confirmed'
      `);
      const totalDeposits = parseFloat(depositsResult[0]?.total || '0');

      const withdrawalsResult = await this.usersRepository.query(`
        SELECT SUM(amount) as total 
        FROM wallet_transactions 
        WHERE type = 'withdrawal' AND status = 'confirmed'
      `);
      const totalWithdrawals = parseFloat(withdrawalsResult[0]?.total || '0');

      // Get active user count
      const activeUsers = await this.usersRepository.count({
        where: { status: UserStatus.ACTIVE }
      });

      return {
        totalLockedFunds: totalPlatformScore, // Total USDT locked in platform (Platform Score)
        totalUserBalance: totalUserBalance, // Total SEKA balance
        totalDeposits: totalDeposits,
        totalWithdrawals: totalWithdrawals,
        netLockedFunds: totalDeposits - totalWithdrawals, // Net funds in platform
        activeUsers: activeUsers,
        currency: 'USDT',
        network: 'MAINNET (BEP20/TRC20)',
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Error fetching total locked funds:', error);
      throw error;
    }
  }

  async updateScoreTransaction(id: string, updateData: { amount?: number; type?: string; description?: string }) {
    return this.platformScoreService.updateScoreTransaction(id, updateData);
  }

  async deleteScoreTransaction(id: string) {
    return this.platformScoreService.deleteScoreTransaction(id);
  }

  async getGameTables(page: number = 1, limit: number = 50, status?: string) {
    try {
      const offset = (page - 1) * limit;
      
      // Query games directly (works with both pending and saved tables)
      let gamesQuery = this.gamesRepository
        .createQueryBuilder('game')
        .leftJoinAndSelect('game.players', 'players')
        .orderBy('game.createdAt', 'DESC');

      // Apply status filter if provided
      if (status) {
        // Map frontend status to game status
        const gameStatus = status === 'playing' ? 'in_progress' : status;
        gamesQuery = gamesQuery.where('game.status = :status', { status: gameStatus });
      }

      const [games, total] = await gamesQuery
        .skip(offset)
        .take(limit)
        .getManyAndCount();

      // Format the response with detailed game information
      const formattedTables = await Promise.all(games.map(async (game) => {
        // Extract table ID and derive table name/creator from game data
        const tableId = game.tableId;
        const tableName = tableId.includes('pending-') ? 'Game Table' : 'Saved Table';
        
        // Get dealer (creator) info
        const creator = game.dealerId ? await this.usersRepository.findOne({ where: { id: game.dealerId } }) : null;
        
        // Get player details with user info
        const players = await Promise.all((game.players || []).map(async (player) => {
          const user = await this.usersRepository.findOne({ where: { id: player.userId } });
          // Calculate initial balance from ante
          const initialBalance = game.ante;
          // Calculate current balance as: initial - totalBet + winnings
          const currentBalance = initialBalance - parseFloat(String(player.totalBet || 0)) + parseFloat(String(player.winnings || 0));
          
          return {
            userId: player.userId,
            username: user?.username || user?.email?.split('@')[0] || 'Unknown',
            email: user?.email || '',
            position: player.position,
            status: player.status,
            initialBalance: parseFloat(String(initialBalance)),
            currentBalance: parseFloat(String(currentBalance)),
            totalBet: parseFloat(String(player.totalBet || 0)),
            isWinner: player.isWinner,
            winnings: parseFloat(String(player.winnings || 0)),
            hasSeenCards: player.hasSeenCards,
            handScore: player.handScore,
            handDescription: player.handDescription,
          };
        }));

        const winners = players.filter(p => p.isWinner);
        const losers = players.filter(p => !p.isWinner);

        // Calculate pot
        const initialPot = game.ante * players.length;
        const finalPot = players.reduce((sum, p) => sum + p.totalBet, 0);

        // Calculate game duration
        let gameDuration: number | null = null;
        if (game.createdAt) {
          const start = new Date(game.createdAt).getTime();
          const end = game.finishedAt ? new Date(game.finishedAt).getTime() : (game.updatedAt ? new Date(game.updatedAt).getTime() : Date.now());
          gameDuration = Math.round((end - start) / 1000); // Duration in seconds
        }

        // Determine table status from game status
        let tableStatus = 'waiting';
        if (game.status === 'in_progress') tableStatus = 'playing';
        if (game.status === 'completed' || game.status === 'finished') tableStatus = 'finished';

        const gameDetails = {
          gameId: game.id,
          gameStatus: game.status,
          initialPot: initialPot,
          finalPot: finalPot,
          // ✅ Tracking fields
          participantCount: game.participantCount || players.length,
          cardViewers: game.cardViewers || [],
          blindPlayers: game.blindPlayers || {},
          gameResults: game.gameResults || {},
          winners: winners.map(w => ({
            userId: w.userId,
            username: w.username,
            email: w.email,
            amountWon: w.winnings,
          })),
          losers: losers.map(l => ({
            userId: l.userId,
            username: l.username,
            email: l.email,
            amountLost: l.totalBet - l.winnings,
          })),
          players: players,
        };

        return {
          tableId: tableId,
          tableName: tableName,
          status: tableStatus, // 'waiting', 'playing', 'finished'
          network: 'BEP20', // Default network
          entryFee: parseFloat(String(game.ante)),
          currentPlayers: players.length,
          maxPlayers: game.maxPlayers || 6,
          creator: {
            userId: creator?.id,
            username: creator?.username || creator?.email?.split('@')[0] || 'Unknown',
            email: creator?.email || '',
          },
          game: gameDetails,
          gameDuration: gameDuration, // in seconds
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
        };
      }));

      return {
        tables: formattedTables,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error fetching game tables:', error);
      return {
        tables: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }
  }

  private async createDefaultSettings() {
    const settings = this.settingsRepository.create({
      platformFeePercentage: 5,
      minBetAmount: 10,
      maxBetAmount: 10000,
      minPlayersPerTable: 2,
      maxPlayersPerTable: 6,
    });
    return this.settingsRepository.save(settings);
  }
}

