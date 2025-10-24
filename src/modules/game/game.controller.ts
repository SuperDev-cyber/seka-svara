import { 
  Controller, 
  Get, 
  Post, 
  Delete,
  Body, 
  Param, 
  Query,
  UseGuards, 
  Request,
  Inject,
  forwardRef 
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GameService } from './game.service';
import { GameGateway } from '../websocket/gateways/game.gateway';

/**
 * Game Controller - REST API Endpoints
 * 
 * All endpoints for frontend integration
 * For development: JwtAuthGuard is optional (can be removed)
 */
@ApiTags('games')
@Controller('games')
// @UseGuards(JwtAuthGuard) // Commented out for frontend testing
export class GameController {
  constructor(
    private readonly gameService: GameService,
    @Inject(forwardRef(() => GameGateway))
    private readonly gameGateway: GameGateway,
  ) {}

  /**
   * Create a new game
   * POST /games
   */
  @Post()
  @ApiOperation({ summary: 'Create a new game' })
  async createGame(
    @Body() createDto: {
      tableId: string;
      playerIds: string[];
      ante?: number;
      maxPlayers?: number;
    },
  ) {
    const game = await this.gameService.createGame(
      createDto.tableId,
      createDto.playerIds,
      createDto.ante || 0,
      createDto.maxPlayers || 10,
    );
    
    console.log(`[GameController] Game created: ${game.id}, status: ${game.status}, players: ${game.players.length}`);
    
    // Broadcast to lobby for real-time game discovery
    await this.gameGateway.broadcastGameCreated(game.id);
    
    console.log(`[GameController] Broadcast complete for game ${game.id}`);
    
    return game;
  }

  /**
   * Add a player to an existing game
   * POST /games/:id/players
   */
  @Post(':id/players')
  @ApiOperation({ summary: 'Add a player to an existing game' })
  async addPlayer(
    @Param('id') id: string,
    @Body() body: { userId: string },
  ) {
    const game = await this.gameService.addPlayerToGame(id, body.userId);
    
    // Broadcast to lobby to update player count
    await this.gameGateway.broadcastGameUpdated(id);
    
    return game;
  }

  /**
   * Get all pending games (for game discovery)
   * GET /games/pending
   * ⚠️ IMPORTANT: Must be BEFORE @Get(':id') to avoid route conflict
   */
  @Get('pending')
  @ApiOperation({ summary: 'Get all pending games waiting for players' })
  async getPendingGames() {
    return this.gameService.getPendingGames();
  }

  /**
   * Clean up old pending games (admin endpoint)
   * DELETE /games/cleanup
   */
  @Delete('cleanup')
  @ApiOperation({ summary: 'Cancel all old pending games' })
  async cleanupOldGames() {
    return this.gameService.cleanupOldGames();
  }

  /**
   * Get user game history
   * GET /users/:userId/games/history
   * ⚠️ IMPORTANT: Must be BEFORE @Get(':id') to avoid route conflict
   */
  @Get('users/:userId/history')
  @ApiOperation({ summary: 'Get user game history' })
  async getUserGameHistory(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
  ) {
    return this.gameService.getUserGameHistory(userId, limit || 20);
  }

  /**
   * Get user active games
   * GET /users/:userId/games/active
   * ⚠️ IMPORTANT: Must be BEFORE @Get(':id') to avoid route conflict
   */
  @Get('users/:userId/active')
  @ApiOperation({ summary: 'Get user active games' })
  async getUserActiveGames(@Param('userId') userId: string) {
    return this.gameService.getUserActiveGames(userId);
  }

  /**
   * Get game by ID with enriched player data
   * GET /games/:id
   * ⚠️ IMPORTANT: Must be AFTER specific routes like /pending, /users/:userId/history
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get game by ID with player details' })
  async getGame(@Param('id') id: string) {
    const game = await this.gameService.findOne(id);
    
    // Enrich players with email and balance (from URL params passed by frontend)
    // For now, return game with players - frontend will handle enrichment
    // TODO: Integrate with user service to fetch real email/balance
    
    return {
      ...game,
      players: game.players.map(p => ({
        userId: p.userId,
        position: p.position,
        status: p.status,
        betAmount: p.betAmount,
        totalBet: p.totalBet,
        balance: 0, // Will be fetched from wallet
        email: null, // Will be enriched by frontend from URL params
      })),
    };
  }

  /**
   * Get current game state
   * GET /games/:id/state
   */
  @Get(':id/state')
  @ApiOperation({ summary: 'Get current game state' })
  async getGameState(@Param('id') id: string) {
    return this.gameService.getGameState(id);
  }

  /**
   * Perform game action (BET, RAISE, CALL, FOLD, CHECK, ALL_IN)
   * POST /games/:id/actions
   */
  @Post(':id/actions')
  @ApiOperation({ summary: 'Perform game action' })
  async performAction(
    @Param('id') id: string,
    @Body() body: {
      userId: string;
      action: { type: string; amount?: number };
    },
  ) {
    return this.gameService.performAction(id, body.userId, body.action);
  }

  /**
   * Get available actions for a player
   * GET /games/:id/players/:userId/actions
   */
  @Get(':id/players/:userId/actions')
  @ApiOperation({ summary: 'Get available actions for player' })
  async getAvailableActions(
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.gameService.getAvailableActions(id, userId);
  }

  /**
   * Start a game
   * POST /games/:id/start
   */
  @Post(':id/start')
  @ApiOperation({ summary: 'Start a game' })
  async startGame(
    @Param('id') id: string,
    @Body() body: { ante?: number },
  ) {
    const game = await this.gameService.startGame(id, body.ante || 0);
    
    // Broadcast to lobby that game started (will remove from available games)
    await this.gameGateway.broadcastGameUpdated(id);
    
    return game;
  }

  /**
   * Cancel/end a game
   * DELETE /games/:id
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Cancel a game' })
  async cancelGame(@Param('id') id: string) {
    return this.gameService.cancelGame(id);
  }
}
