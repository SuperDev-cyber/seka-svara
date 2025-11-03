import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';

@Injectable()
export class LeaderboardService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async getTopWinners(limit: number = 10) {
    const topWinners = await this.usersRepository.find({
      select: ['id', 'username', 'avatar', 'totalWinnings', 'totalGamesWon'],
      order: { totalWinnings: 'DESC' },
      take: limit,
    });

    return topWinners;
  }

  async getTopPlayers(limit: number = 10) {
    const topPlayers = await this.usersRepository.find({
      select: ['id', 'username', 'avatar', 'totalGamesWon', 'totalGamesPlayed'],
      order: { totalGamesWon: 'DESC' },
      take: limit,
    });

    return topPlayers.map((player) => ({
      ...player,
      winRate:
        player.totalGamesPlayed > 0
          ? ((player.totalGamesWon / player.totalGamesPlayed) * 100).toFixed(0)
          : 0,
    }));
  }

  async getMostActive(limit: number = 10) {
    const mostActive = await this.usersRepository.find({
      select: ['id', 'username', 'avatar', 'totalGamesPlayed', 'totalGamesWon'],
      order: { totalGamesPlayed: 'DESC' },
      take: limit,
    });

    return mostActive;
  }

  async getStatistics() {
    // TODO: Implement overall platform statistics
    const totalUsers = await this.usersRepository.count();
    const totalWinnings = await this.usersRepository
      .createQueryBuilder('user')
      .select('SUM(user.totalWinnings)', 'total')
      .getRawOne();

    return {
      totalUsers,
      totalGames: 0, // TODO: Get from games table
      totalWinnings: totalWinnings.total || 0,
      activePlayers: 0, // TODO: Get active players count
    };
  }
}

