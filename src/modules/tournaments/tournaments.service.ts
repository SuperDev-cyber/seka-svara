import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { TournamentPlayer } from './entities/tournament-player.entity';
import { GameService } from '../game/game.service';

/**
 * Tournaments Service
 * 
 * Manages Seka Svara tournaments:
 * - Create tournaments (scheduled or sit-n-go)
 * - Player registration
 * - Multi-table management
 * - Elimination tracking
 * - Prize distribution
 * - Leaderboards
 */
@Injectable()
export class TournamentsService {
  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(TournamentPlayer)
    private readonly tournamentPlayersRepository: Repository<TournamentPlayer>,
    private readonly gameService: GameService,
  ) {}

  /**
   * Create a new tournament
   */
  async create(createDto: any): Promise<Tournament> {
    const tournament = this.tournamentsRepository.create({
      name: createDto.name,
      description: createDto.description,
      type: createDto.type || 'sit_n_go',
      maxPlayers: createDto.maxPlayers,
      minPlayers: createDto.minPlayers || 2,
      buyIn: createDto.buyIn,
      prizeDistribution: createDto.prizeDistribution || [50, 30, 20], // Default: 50% 1st, 30% 2nd, 20% 3rd
      scheduledStartTime: createDto.scheduledStartTime,
      startingChips: createDto.startingChips || 1000,
      playersPerTable: createDto.playersPerTable || 6,
      blindsLevel: createDto.blindsLevel || 10,
      blindsIncreaseInterval: createDto.blindsIncreaseInterval || 300,
      allowRebuys: createDto.allowRebuys || false,
      rebuyCount: createDto.rebuyCount || 0,
      status: 'registration',
    });

    return this.tournamentsRepository.save(tournament);
  }

  /**
   * Find all tournaments
   */
  async findAll(query: any) {
    const status = query.status || undefined;
    const type = query.type || undefined;

    const where: any = {};
    if (status) where.status = status;
    if (type) where.type = type;

    return this.tournamentsRepository.find({
      where,
      relations: ['players'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find one tournament by ID
   */
  async findOne(id: string): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['players'],
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  /**
   * Register a player for tournament
   */
  async register(tournamentId: string, userId: string): Promise<TournamentPlayer> {
    const tournament = await this.findOne(tournamentId);

    if (tournament.status !== 'registration') {
      throw new BadRequestException('Tournament registration is closed');
    }

    if (tournament.currentPlayers >= tournament.maxPlayers) {
      throw new BadRequestException('Tournament is full');
    }

    // Check if already registered
    const existing = await this.tournamentPlayersRepository.findOne({
      where: { tournamentId, userId },
    });

    if (existing) {
      throw new BadRequestException('Player already registered');
    }

    // Create tournament player
    const player = this.tournamentPlayersRepository.create({
      tournamentId,
      userId,
      chips: tournament.startingChips,
      position: 0,
      isEliminated: false,
    });

    await this.tournamentPlayersRepository.save(player);

    // Update tournament player count
    tournament.currentPlayers++;
    await this.tournamentsRepository.save(tournament);

    // TODO: Integrate with wallet service to collect buy-in
    // await this.walletService.deductBalance(userId, tournament.buyIn, {...});

    // Update prize pool
    tournament.prizePool += tournament.buyIn;
    await this.tournamentsRepository.save(tournament);

    // Check if sit-n-go should start
    if (
      tournament.type === 'sit_n_go' &&
      tournament.currentPlayers === tournament.maxPlayers
    ) {
      await this.start(tournamentId);
    }

    return player;
  }

  /**
   * Unregister a player from tournament
   */
  async unregister(tournamentId: string, userId: string): Promise<void> {
    const tournament = await this.findOne(tournamentId);

    if (tournament.status !== 'registration') {
      throw new BadRequestException('Cannot unregister after tournament starts');
    }

    const player = await this.tournamentPlayersRepository.findOne({
      where: { tournamentId, userId },
    });

    if (!player) {
      throw new NotFoundException('Player not registered');
    }

    await this.tournamentPlayersRepository.remove(player);

    // Update tournament
    tournament.currentPlayers--;
    tournament.prizePool -= tournament.buyIn;
    await this.tournamentsRepository.save(tournament);

    // TODO: Refund buy-in via wallet service
    // await this.walletService.addBalance(userId, tournament.buyIn, {...});
  }

  /**
   * Start the tournament
   */
  async start(tournamentId: string): Promise<Tournament> {
    const tournament = await this.findOne(tournamentId);

    if (tournament.status !== 'registration') {
      throw new BadRequestException('Tournament already started or completed');
    }

    if (tournament.currentPlayers < tournament.minPlayers) {
      throw new BadRequestException(
        `Need at least ${tournament.minPlayers} players to start`,
      );
    }

    // Update tournament status
    tournament.status = 'in_progress';
    tournament.startedAt = new Date();

    // Create initial tables
    const tables = await this.createTables(tournament);
    tournament.tables = tables.map(t => t.id);

    await this.tournamentsRepository.save(tournament);

    return tournament;
  }

  /**
   * Create tables for tournament
   */
  private async createTables(tournament: Tournament): Promise<any[]> {
    const players = await this.tournamentPlayersRepository.find({
      where: { tournamentId: tournament.id, isEliminated: false },
    });

    const tables: any[] = [];
    const playersPerTable = tournament.playersPerTable;

    // Divide players into tables
    for (let i = 0; i < players.length; i += playersPerTable) {
      const tablePlayers = players.slice(i, i + playersPerTable);
      
      if (tablePlayers.length >= 2) {
        // Create a game for this table
        const game = await this.gameService.createGame(
          `tournament-${tournament.id}-table-${tables.length + 1}`,
          tablePlayers.map(p => p.userId),
          tournament.blindsLevel, // Use blinds as ante
        );

        tables.push(game);

        // Update player current table
        for (const player of tablePlayers) {
          player.currentTableId = game.id;
          await this.tournamentPlayersRepository.save(player);
        }
      }
    }

    return tables;
  }

  /**
   * Handle player elimination
   */
  async eliminatePlayer(tournamentId: string, userId: string): Promise<void> {
    const player = await this.tournamentPlayersRepository.findOne({
      where: { tournamentId, userId },
    });

    if (!player) {
      throw new NotFoundException('Player not found in tournament');
    }

    player.isEliminated = true;
    player.eliminatedAt = new Date();
    await this.tournamentPlayersRepository.save(player);

    // Update tournament eliminated players list
    const tournament = await this.findOne(tournamentId);
    if (!tournament.eliminatedPlayers) {
      tournament.eliminatedPlayers = [];
    }
    tournament.eliminatedPlayers.push(userId);
    await this.tournamentsRepository.save(tournament);

    // Check if tournament should end
    await this.checkTournamentCompletion(tournamentId);
  }

  /**
   * Check if tournament is complete
   */
  private async checkTournamentCompletion(tournamentId: string): Promise<void> {
    const tournament = await this.findOne(tournamentId);
    
    const activePlayers = await this.tournamentPlayersRepository.find({
      where: { tournamentId, isEliminated: false },
    });

    if (activePlayers.length === 1) {
      // Tournament complete - one winner
      await this.completeTournament(tournamentId, activePlayers[0].userId);
    }
  }

  /**
   * Complete tournament and distribute prizes
   */
  private async completeTournament(tournamentId: string, winnerId: string): Promise<void> {
    const tournament = await this.findOne(tournamentId);
    
    tournament.status = 'completed';
    tournament.completedAt = new Date();
    await this.tournamentsRepository.save(tournament);

    // Assign positions
    const eliminatedPlayers = tournament.eliminatedPlayers || [];
    const totalPlayers = tournament.currentPlayers;

    // Winner is position 1
    const winner = await this.tournamentPlayersRepository.findOne({
      where: { tournamentId, userId: winnerId },
    });
    if (winner) {
      winner.position = 1;
      await this.tournamentPlayersRepository.save(winner);
    }

    // Assign positions to eliminated players (reverse order)
    for (let i = 0; i < eliminatedPlayers.length; i++) {
      const player = await this.tournamentPlayersRepository.findOne({
        where: { tournamentId, userId: eliminatedPlayers[i] },
      });
      if (player) {
        player.position = totalPlayers - i;
        await this.tournamentPlayersRepository.save(player);
      }
    }

    // Distribute prizes
    await this.distributePrizes(tournament);
  }

  /**
   * Distribute prizes based on prize distribution
   */
  private async distributePrizes(tournament: Tournament): Promise<void> {
    const players = await this.tournamentPlayersRepository.find({
      where: { tournamentId: tournament.id },
      order: { position: 'ASC' },
    });

    const prizePool = tournament.prizePool;
    const distribution = tournament.prizeDistribution;

    for (let i = 0; i < Math.min(players.length, distribution.length); i++) {
      const player = players[i];
      const percentage = distribution[i];
      const winnings = (prizePool * percentage) / 100;

      player.winnings = winnings;
      await this.tournamentPlayersRepository.save(player);

      // TODO: Credit winnings via wallet service
      // await this.walletService.addBalance(player.userId, winnings, {
      //   type: WalletTransactionType.TOURNAMENT_PRIZE,
      //   tournamentId: tournament.id,
      //   description: `Prize for finishing ${player.position}${this.getOrdinalSuffix(player.position)} place`,
      // });
    }
  }

  /**
   * Get tournament leaderboard
   */
  async getLeaderboard(tournamentId: string) {
    const players = await this.tournamentPlayersRepository.find({
      where: { tournamentId },
      order: { position: 'ASC', chips: 'DESC' },
    });

    return players.map(p => ({
      userId: p.userId,
      position: p.position,
      chips: p.chips,
      isEliminated: p.isEliminated,
      winnings: p.winnings,
    }));
  }

  /**
   * Get ordinal suffix (1st, 2nd, 3rd, etc.)
   */
  private getOrdinalSuffix(position: number): string {
    const lastDigit = position % 10;
    const lastTwoDigits = position % 100;

    if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
      return 'th';
    }

    switch (lastDigit) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
}

