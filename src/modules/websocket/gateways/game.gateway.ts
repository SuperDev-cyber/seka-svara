import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameService } from '../../game/game.service';
import { GameEngine } from '../../game/services/game-engine.service';
import { GameStateService } from '../../game/services/game-state.service';
import { WalletService } from '../../wallet/wallet.service';
import { EmailService } from '../../email/email.service';
import { GameStatus } from '../../game/types/game-state.types';
import { User } from '../../users/entities/user.entity';
import { GameTable } from '../../tables/entities/game-table.entity';
import { Invitation } from '../../tables/entities/invitation.entity';

/**
 * WebSocket Gateway for real-time Seka Svara game communication
 * 
 * Features:
 * - Real-time game state updates
 * - Player action broadcasts
 * - Turn notifications
 * - Showdown results
 * - Chat messages
 * - Player connect/disconnect handling
 * 
 * Based on official Seka Svara rules from seka-ru.com
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private logger = new Logger('GameGateway');
  
  // Map: socketId -> userId
  private connectedPlayers = new Map<string, string>();
  
  // Map: userId -> socketId
  private userSockets = new Map<string, string>();
  
  // Map: gameId -> Set<socketId>
  private gameRooms = new Map<string, Set<string>>();
  
  // Set: Online users in lobby
  private onlineUsers = new Set<string>();
  
  // Map: userId -> user data (email, etc)
  private userData = new Map<string, { userId: string; email?: string; username?: string; avatar?: string; socketId: string }>();
  
  // Map: tableId -> countdown timer (prevents multiple timers for same table)
  private countdownTimers = new Map<string, NodeJS.Timeout>();
  
  // Map: tableId -> cleanup timer for single-player tables
  private cleanupTimers = new Map<string, NodeJS.Timeout>();

  // Map: tableId -> Set of userIds currently joining (prevents race conditions)
  private joiningPlayers = new Map<string, Set<string>>();

  // IN-MEMORY TABLE STORE (ephemeral - lost on restart)
  private activeTables = new Map<string, {
    id: string;
    tableName: string;
    entryFee: number;
    maxPlayers: number;
    players: Array<{ 
      userId: string; 
      email: string; 
      username?: string; 
      avatar?: string | null;  // ✅ Allow null to match database type
      balance?: number;
      isActive?: boolean;
      joinedAt?: Date;
      socketId?: string | null; // ✅ Allow null for disconnected players
    }>;
    status: 'waiting' | 'in_progress' | 'finished';
    privacy?: string;
    isPrivate?: boolean;
    invitedPlayers?: string[];
    creatorId: string;
    createdAt: Date;
    singlePlayerSince: Date | null; // Track when table became single-player for auto-delete
    gameId: string | null; // Database game ID when game starts
    lastWinnerId: string | null; // Previous winner (becomes dealer for next game)
    lastHeartbeat: Date; // For auto-termination when server dies
    modalClosedPlayers?: Set<string>; // ✅ Track players who closed winner modal
    restartGameTimer?: NodeJS.Timeout; // ✅ Timer for restarting game after all modals closed
  }>();

  // Timer for periodic cleanup of idle single-player tables
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly gameEngine: GameEngine,
    private readonly gameStateService: GameStateService,
    private readonly walletService: WalletService,
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(GameTable)
    private readonly gameTablesRepository: Repository<GameTable>,
    @InjectRepository(Invitation)
    private readonly invitationsRepository: Repository<Invitation>,
  ) {}

  // ❌ REMOVED: Bot registration code (onModuleInit and addBotToOnlineUsers)
  // Bots are no longer used in this system

  /**
   * Start periodic cleanup of idle single-player tables
   * Runs every 30 seconds, deletes tables with 1 player idle for 20+ seconds
   */
  private startIdleTableCleanup() {
    if (this.cleanupInterval) return; // Already running

    this.logger.log('🧹 Starting idle single-player table cleanup (checks every 30 seconds, removes after 20 seconds idle)');
    
    this.cleanupInterval = setInterval(async () => {
      const now = new Date().getTime();
      const TWENTY_SECONDS = 20 * 1000; // 20 seconds in milliseconds
      const HEARTBEAT_TIMEOUT = 30 * 1000; // 30 seconds for heartbeat timeout
      const tablesToDelete: string[] = [];

      for (const [tableId, table] of this.activeTables.entries()) {
        // Auto-terminate games if no heartbeat for 30 seconds (server crash detection)
        if (table.status === 'in_progress' && table.lastHeartbeat) {
          const heartbeatAge = now - table.lastHeartbeat.getTime();
          if (heartbeatAge >= HEARTBEAT_TIMEOUT) {
            this.logger.warn(`💀 Auto-terminating game ${table.gameId} - no heartbeat for ${Math.round(heartbeatAge/1000)}s`);
            this.autoTerminateGame(tableId, 'Server heartbeat timeout');
            tablesToDelete.push(tableId);
            continue;
          }
        }
        
        // ✅ FIX: Remove empty tables from memory only (preserve in database)
        if (table.players.length === 0) {
          this.logger.log(`🗑️ Found empty table "${table.tableName}" in cleanup - removing from memory (preserving in database)`);
          tablesToDelete.push(tableId);
          continue;
        }
        
        // Only check tables with exactly 1 player (CHANGED: from 1 minute to 20 seconds)
        if (table.players.length === 1) {
          // If singlePlayerSince is not set, set it now (for old tables)
          if (!table.singlePlayerSince) {
            table.singlePlayerSince = new Date();
            this.logger.log(`⏱️ Setting idle timer for existing single-player table: ${table.tableName}`);
          } else {
            const idleTime = now - table.singlePlayerSince.getTime();
            
            if (idleTime >= TWENTY_SECONDS) {
              this.logger.log(`⏱️ Table "${table.tableName}" has been idle with 1 player for ${Math.round(idleTime / 1000)} seconds`);
              tablesToDelete.push(tableId);
            }
          }
        } else if (table.players.length > 1 && table.singlePlayerSince) {
          // If table now has multiple players, clear the idle timer
          table.singlePlayerSince = null;
        }
      }

      // Delete idle tables from memory only (preserve in database for restart recovery)
      for (const tableId of tablesToDelete) {
        const table = this.activeTables.get(tableId);
        if (table) {
          this.activeTables.delete(tableId);
          this.logger.log(`🗑️ Auto-removed idle table from memory: ${table.tableName} (ID: ${table.id})`);
          
          // ✅ PRESERVE IN DATABASE: Update status instead of deleting
          // This allows tables to be reloaded on server restart
          try {
            await this.gameTablesRepository.update(tableId, {
              currentPlayers: table.players.length,
              status: 'waiting', // Keep as waiting status
              updatedAt: new Date(),
            });
            this.logger.log(`💾 ✅ Preserved table ${tableId} in database (available for restart recovery)`);
          } catch (error) {
            this.logger.error(`❌ Failed to update table in database: ${error.message}`);
          }
          
          // Notify lobby
          this.server.to('lobby').emit('table_removed', {
            id: table.id,
            reason: 'idle_timeout',
            timestamp: new Date(),
          });

          // Notify the remaining player if they're connected (for single-player tables)
          if (table.players.length > 0) {
            const player = table.players[0];
            if (player) {
              const socketId = this.userSockets.get(player.userId);
              if (socketId) {
                this.server.to(socketId).emit('table_closed', {
                  tableId: table.id,
                  tableName: table.tableName,
                  reason: 'No other players joined within 20 seconds',
                  timestamp: new Date(),
                });
              }
            }
          }
        }
      }

      if (tablesToDelete.length > 0) {
        this.logger.log(`✅ Cleaned up ${tablesToDelete.length} idle single-player table(s)`);
      }
    }, 30 * 1000); // Check every 30 seconds
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(client: Socket) {
    this.logger.log(`🔌 Client connected: ${client.id}`);
    
    // Start idle table cleanup (only runs once)
    this.startIdleTableCleanup();
    
    // Join global lobby room for game discovery
    client.join('lobby');
    this.logger.log(`   ✅ Client ${client.id} joined 'lobby' room`);
    
    const lobbyRoom = this.server.sockets.adapter.rooms.get('lobby');
    this.logger.log(`   Total clients in lobby: ${lobbyRoom ? lobbyRoom.size : 0}`);
    
    // Send welcome message
    client.emit('connected', {
      message: 'Connected to Seka Svara Game Server',
      socketId: client.id,
      timestamp: new Date(),
    });
  }

  /**
   * Send invitation request (DB-first) and auto-join inviter
   */
  @SubscribeMessage('invite_request')
  async handleInviteRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      targetUserId: string;
      existingTableId?: string; // ✅ NEW: Optional existing table ID
      tableSettings: { tableName: string; entryFee: number; maxPlayers?: number; isPrivate?: boolean; network?: string };
      creator: { userId: string; email?: string; username?: string; avatar?: string };
    },
  ) {
    try {
      const tableName = data.tableSettings.tableName || 'Game Table';
      const maxPlayers = data.tableSettings.maxPlayers || 6;
      const entryFee = data.tableSettings.entryFee || 0;
      const network = data.tableSettings.network || 'BEP20';
      const isPrivate = !!data.tableSettings.isPrivate;

      let dbTable: GameTable;

      // ✅ FIX: Use existing table if provided, otherwise create new one
      if (data.existingTableId) {
        this.logger.log(`🔄 Using existing table: ${data.existingTableId}`);
        dbTable = await this.gameTablesRepository.findOne({ 
          where: { id: data.existingTableId }
        }) as unknown as GameTable;
        
        if (!dbTable) {
          this.logger.error(`❌ Existing table ${data.existingTableId} not found! Creating new one...`);
          // Fallback: create new table if existing one not found
          dbTable = await this.gameTablesRepository.save(
            this.gameTablesRepository.create({
              name: tableName,
              creatorId: data.creator.userId,
              status: 'waiting',
              network,
              buyInAmount: entryFee,
              minBet: entryFee,
              maxBet: entryFee,
              minPlayers: 2,
              maxPlayers,
              currentPlayers: 0, // ✅ FIX: Start with 0 players (inviter hasn't joined yet)
              isPrivate,
            } as any)
          ) as unknown as GameTable;
        } else {
          this.logger.log(`✅ Found existing table: ${dbTable.name} (${dbTable.id})`);
        }
      } else {
        // Create new table
        this.logger.log(`📋 Creating NEW table: ${tableName}`);
        dbTable = await this.gameTablesRepository.save(
          this.gameTablesRepository.create({
            name: tableName,
            creatorId: data.creator.userId,
            status: 'waiting',
            network,
            buyInAmount: entryFee,
            minBet: entryFee,
            maxBet: entryFee,
            minPlayers: 2,
            maxPlayers,
            currentPlayers: 0, // ✅ FIX: Start with 0 players (inviter hasn't joined yet)
            isPrivate,
          } as any)
        ) as unknown as GameTable;
        this.logger.log(`✅ Created new table: ${dbTable.id}`);
      }

      // 2) ✅ REMOVED: Do NOT auto-join inviter - they must click "JOIN TABLE" button
      // Inviter will be added to table_players only when they call join_table
      this.logger.log(`📋 Table created - inviter NOT auto-joined (must click JOIN TABLE)`);

      // 2.5) ✅ ADD TABLE TO MEMORY so it's immediately available for join_table
      if (!data.existingTableId) {
        // Only add to memory if this is a NEW table (not reusing existing)
        const memoryTable = {
          id: dbTable.id,
          tableName: tableName,
          entryFee: entryFee,
          maxPlayers: maxPlayers,
          players: [], // Empty - inviter hasn't joined yet
          status: 'waiting' as const,
          privacy: isPrivate ? 'private' : 'public',
          isPrivate: isPrivate,
          invitedPlayers: [data.targetUserId], // Track invited player
          creatorId: data.creator.userId,
          createdAt: new Date(),
          singlePlayerSince: null, // Will be set when first player joins
          gameId: null,
          lastWinnerId: null,
          lastHeartbeat: new Date()
        };
        this.activeTables.set(dbTable.id, memoryTable);
        this.logger.log(`✅ Added table to activeTables map: ${dbTable.id}`);
      } else {
        this.logger.log(`⏭️ Skipped adding to activeTables (existing table will be loaded on join)`);
      }

      // 3) Create invitation row
      const invite = this.invitationsRepository.create({
        tableId: dbTable.id,
        inviterId: data.creator.userId,
        inviteeId: data.targetUserId,
        status: 'pending',
      });
      await this.invitationsRepository.save(invite);

      // 4) Emit invitation to invitee (if online)
      const targetSocketId = this.userSockets.get(data.targetUserId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('game_invitation', {
          id: invite.id,
          tableId: dbTable.id,
          tableName,
          entryFee,
          maxPlayers,
          inviterId: data.creator.userId,
          inviterName: data.creator.username || (data.creator.email ? data.creator.email.split('@')[0] : 'Player'),
          timestamp: new Date(),
        });
      }

      // 5) ✅ FIX: Only broadcast table_created for NEW tables (not when reusing existing)
      const completeTableData = {
        id: dbTable.id,
        tableName: tableName,
        entryFee: entryFee,
        currentPlayers: dbTable.currentPlayers, // ✅ Use actual count from database
        maxPlayers: maxPlayers,
        status: 'waiting', // ✅ FIX: Include status
        creatorId: data.creator.userId,
        creatorEmail: data.creator.email,
        isPrivate: isPrivate, // ✅ FIX: Include privacy setting
        network: network,
        timestamp: new Date(),
      };
      
      // ✅ FIX: Only broadcast to lobby if this is a NEW table (not reusing existing)
      if (!data.existingTableId) {
        this.server.to('lobby').emit('table_created', completeTableData);
        this.logger.log(`📢 Broadcasted table_created to lobby for NEW invitation table: ${dbTable.id}`);
      } else {
        this.logger.log(`⏭️ Skipped table_created broadcast (reusing existing table: ${dbTable.id})`);
      }
      
      return { success: true, table: completeTableData };
    } catch (error) {
      this.logger.error(`invite_request failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Accept invitation (DB-first) and join table
   */
  @SubscribeMessage('invite_accept')
  async handleInviteAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { invitationId: string; userId: string },
  ) {
    try {
      const invitation = await this.invitationsRepository.findOne({ where: { id: data.invitationId } });
      if (!invitation || invitation.status !== 'pending') {
        return { success: false, message: 'Invalid or expired invitation' };
      }

      // Add invitee to table_players
      try {
        await this.gameTablesRepository.query(
          `INSERT INTO table_players (id, "tableId", "userId", "seatNumber", chips, "isReady", status, "joinedAt")
           VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT DO NOTHING`,
          [invitation.tableId, data.userId, 1, 0, false, 'active'],
        );
      } catch {}

      // Increment currentPlayers
      await this.gameTablesRepository.query(
        `UPDATE game_tables SET "currentPlayers" = "currentPlayers" + 1, "updatedAt" = NOW() WHERE id = $1`,
        [invitation.tableId],
      );

      // Mark invitation accepted
      invitation.status = 'accepted';
      await this.invitationsRepository.save(invitation);

      // Respond success with tableId
      client.emit('invite_accepted', { tableId: invitation.tableId });
      return { success: true, tableId: invitation.tableId };
    } catch (error) {
      this.logger.error(`invite_accept failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Handle client disconnect
   */
  async handleDisconnect(client: Socket) {
    const userId = this.connectedPlayers.get(client.id);
    
    this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);
    
    if (userId) {
      // Remove from online users
      if (this.onlineUsers.has(userId)) {
        this.onlineUsers.delete(userId);
        
        // Broadcast to lobby that user left
        this.server.to('lobby').emit('user_left_lobby', {
          userId,
          timestamp: new Date(),
        });
        
        this.logger.log(`User ${userId} left lobby`);
      }
      
      // CRITICAL: Remove from socket mappings to prevent sending to old socket
      this.userSockets.delete(userId);
      this.connectedPlayers.delete(client.id);
      this.logger.log(`Removed user ${userId} from socket mapping`);
      
      // Auto-remove from WAITING tables on disconnect to keep counts correct
      for (const [tableId, table] of this.activeTables.entries()) {
        if (table.players.some(p => p.userId === userId) && table.status === 'waiting') {
          const before = table.players.length;
          table.players = table.players.filter(p => p.userId !== userId);
          const after = table.players.length;
          if (after !== before) {
            this.logger.log(`   👋 Removed ${userId} from waiting table ${table.tableName} on disconnect (${after}/${table.maxPlayers})`);
            // Update DB count
            try {
              await this.gameTablesRepository.update(table.id, { currentPlayers: after });
            } catch (err) {
              this.logger.error(`   ❌ Failed updating DB player count: ${err.message}`);
            }
            // Remove table from memory if empty, but preserve in database
            if (after === 0) {
              this.activeTables.delete(tableId);
              this.logger.log(`   🗑️ Removed empty table ${table.tableName} from memory (preserved in database)`);
              // ✅ PRESERVE IN DATABASE: Update status instead of deleting
              try {
                await this.gameTablesRepository.update(tableId, {
                  currentPlayers: 0,
                  status: 'waiting',
                  updatedAt: new Date(),
                });
                this.logger.log(`   💾 ✅ Preserved table ${tableId} in database`);
              } catch (err) {
                this.logger.error(`   ❌ Failed to preserve table in database: ${err.message}`);
              }
              this.server.to('lobby').emit('table_removed', { id: tableId, timestamp: new Date(), reason: 'all_players_left' });
            } else {
              this.server.to('lobby').emit('table_updated', {
                id: table.id,
                tableName: table.tableName,
                entryFee: table.entryFee,
                currentPlayers: table.players.length,
                maxPlayers: table.maxPlayers,
                status: table.status,
                timestamp: new Date(),
              });
            }
          }
        }
      }
      
      // Find all games this user is in
      for (const [gameId, socketIds] of this.gameRooms.entries()) {
        if (socketIds.has(client.id)) {
          // Notify other players
          this.server.to(`game:${gameId}`).emit('player_disconnected', {
            gameId,
            userId,
            timestamp: new Date(),
          });
          
          socketIds.delete(client.id);
        }
      }
      
      this.userSockets.delete(userId);
    }
    
    this.connectedPlayers.delete(client.id);
  }

  /**
   * Authenticate user with JWT token
   */
  @SubscribeMessage('authenticate')
  async handleAuthenticate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; token: string },
  ) {
    try {
      // TODO: Validate JWT token with auth service
      // For now, just store the userId
      
    this.connectedPlayers.set(client.id, data.userId);
      this.userSockets.set(data.userId, client.id);
      
      this.logger.log(`User authenticated: ${data.userId} (socket: ${client.id})`);
      
      return {
        success: true,
        userId: data.userId,
        message: 'Authentication successful',
      };
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      return {
        success: false,
        error: 'Authentication failed',
      };
    }
  }

  /**
   * Join a game room
   */
  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    try {
      const { gameId, userId } = data;
      
      // Validate game exists
      const game = await this.gameService.findOne(gameId);
      
      // Validate user is in game
      const player = game.players.find(p => p.userId === userId);
      if (!player) {
        return {
          success: false,
          error: 'User is not in this game',
        };
      }
      
      // Join socket room
      client.join(`game:${gameId}`);
      
      // Track in game room
      if (!this.gameRooms.has(gameId)) {
        this.gameRooms.set(gameId, new Set());
      }
      this.gameRooms.get(gameId)!.add(client.id);
      
      this.logger.log(`User ${userId} joined game ${gameId}`);
      
      // Notify other players
      client.to(`game:${gameId}`).emit('player_joined', {
        gameId,
        userId,
      timestamp: new Date(),
    });
      
      // Send current game state to joining player (sanitized - no cards visible yet)
      const sanitizedState = await this.gameStateService.getSanitizedGameStateForUser(game, userId);
      client.emit('game_state_updated', sanitizedState);
      
      return {
        success: true,
        gameState: sanitizedState,
      };
    } catch (error) {
      this.logger.error(`Error joining game: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Leave a game room
   */
  @SubscribeMessage('leave_game')
  handleLeaveGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string },
  ) {
    const { gameId, userId } = data;
    
    client.leave(`game:${gameId}`);
    
    // Remove from tracking
    if (this.gameRooms.has(gameId)) {
      this.gameRooms.get(gameId)!.delete(client.id);
    }
    
    this.logger.log(`User ${userId} left game ${gameId}`);
    
    // Notify other players
    this.server.to(`game:${gameId}`).emit('player_left', {
      gameId,
      userId,
      timestamp: new Date(),
    });
    
    return { success: true };
  }

  /**
   * Process player action (BET, RAISE, CALL, FOLD, CHECK, ALL_IN)
   */
  @SubscribeMessage('player_action')
  async handlePlayerAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      tableId: string;
      userId: string;
      action: string; // 'fold', 'check', 'call', 'raise', 'all_in'
      amount?: number;
    },
  ) {
    try {
      const { tableId, userId, action, amount } = data;
      
      // Get table and its associated game
      const table = this.activeTables.get(tableId);
      if (!table || !table.gameId) {
        return { success: false, message: 'Game not found or not started' };
      }
      
      const gameId = table.gameId;
      
      this.logger.log(
        `🎲 Player action: ${userId} ${action} ${amount || ''} in game ${gameId} (table: ${table.tableName})`,
      );
      
      // Process action through game service
      const result = await this.gameService.performAction(gameId, userId, { type: action, amount });
      
      // Get updated game state
      const game = await this.gameService.findOne(gameId);
      const gameState = await this.gameEngine.getGameState(game);
      
      this.logger.log(`   Updated game state - Phase: ${gameState.phase}, Current player: ${gameState.currentPlayerId}`);
      
      // Broadcast action to all players in table WITH gameState for immediate UI update
      this.server.to(`table:${tableId}`).emit('player_action_broadcast', {
        tableId,
        gameId,
        userId,
        action,
        amount,
        gameState: {
          pot: gameState.pot,
          currentBet: gameState.currentBet,
          currentPlayerId: gameState.currentPlayerId,
          phase: gameState.phase,
          players: gameState.players, // Include updated player data
          cardViewers: game.cardViewers || [], // ✅ FIX: Include cardViewers to maintain badge visibility
        },
        timestamp: new Date(),
      });
      
      // 🔒 SECURE: Broadcast sanitized game state to each player
      await this.broadcastSanitizedGameState(game, tableId);
      
      // Check if game reached showdown
      if (gameState.phase === 'showdown' || gameState.phase === 'completed') {
        this.logger.log(`🏆 Game reached showdown phase. Broadcasting results...`);
        await this.broadcastShowdown(tableId, gameId);
        
        // Mark table as finished
        if (gameState.phase === 'completed') {
          table.status = 'finished';
          
          // ✅ UPDATE DATABASE status to 'finished' (ALL tables)
          try {
            await this.gameTablesRepository.update(tableId, {
              status: 'finished',
            });
            this.logger.log(`💾 ✅ Database updated: Table ${tableId} status changed to 'finished'`);
          } catch (error) {
            this.logger.error(`❌ Failed to update table status in database: ${error.message}`);
          }
        }
      }
      
      return {
        success: true,
        gameState,
      };
    } catch (error) {
      this.logger.error(`Error processing action: ${error.message}`);
      
      // Send error to the player who sent the action
      client.emit('action_error', {
        error: error.message,
      timestamp: new Date(),
    });
      
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send chat message (legacy - for game rooms)
   */
  @SubscribeMessage('chat_message')
  handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string; userId: string; message: string },
  ) {
    const { gameId, userId, message } = data;
    
    // TODO: Validate message (profanity filter, length, etc.)
    
    // Broadcast to all players in game
    this.server.to(`game:${gameId}`).emit('chat_message', {
      gameId,
      userId,
      message,
      timestamp: new Date(),
    });
    
    this.logger.log(`Chat message from ${userId} in game ${gameId}: ${message}`);
    
    return { success: true };
  }

  /**
   * Send chat message in table room
   */
  @SubscribeMessage('send_table_chat')
  handleTableChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      tableId: string; 
      userId: string; 
      username: string;
      message: string;
    },
  ) {
    const { tableId, userId, username, message } = data;
    
    this.logger.log(`💬 Chat message from ${username} (${userId}) in table ${tableId}: ${message}`);
    
    // Validate message
    if (!message || message.trim().length === 0) {
      return { success: false, error: 'Message cannot be empty' };
    }
    
    if (message.length > 500) {
      return { success: false, error: 'Message too long (max 500 characters)' };
    }
    
    // Broadcast to all players in table room
    const tableRoom = `table:${tableId}`;
    this.server.to(tableRoom).emit('table_chat_message', {
      tableId,
      userId,
      username,
      message: message.trim(),
      timestamp: new Date(),
    });
    
    this.logger.log(`📡 Broadcasted chat to table room: ${tableRoom}`);
    
    return { success: true };
  }

  /**
   * Request current game state
   */
  @SubscribeMessage('get_game_state')
  async handleGetGameState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { gameId: string },
  ) {
    try {
      // Get requesting user ID from socket
      const userId = this.connectedPlayers.get(client.id);
      if (!userId) {
        return {
          success: false,
          error: 'User not authenticated',
        };
      }
      
      // Get game from database
      const game = await this.gameService.findOne(data.gameId);
      
      // Send sanitized game state (only includes requester's cards if they've viewed them)
      const sanitizedState = await this.gameStateService.getSanitizedGameStateForUser(game, userId);
      client.emit('game_state_updated', sanitizedState);
      
      return {
        success: true,
        gameState: sanitizedState,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * ✅ Handle player closing winner modal
   * Once ALL players close, wait 10 seconds and restart the game
   */
  @SubscribeMessage('player_modal_closed')
  async handlePlayerModalClosed(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; userId: string },
  ) {
    const { tableId, userId } = data;
    
    this.logger.log(`🎯 Player ${userId} closed winner modal in table ${tableId}`);
    
    const table = this.activeTables.get(tableId);
    if (!table) {
      return { success: false, error: 'Table not found' };
    }
    
    // Initialize tracking set if not exists
    if (!table.modalClosedPlayers) {
      table.modalClosedPlayers = new Set<string>();
    }
    
    // Add player to set of closed modals
    table.modalClosedPlayers.add(userId);
    
    this.logger.log(`   ${table.modalClosedPlayers.size}/${table.players.length} players closed modal`);
    
    // Check if ALL players have closed the modal
    const allPlayersClosed = table.players.every(p => table.modalClosedPlayers?.has(p.userId));
    
    if (allPlayersClosed) {
      this.logger.log(`✅ ALL PLAYERS CLOSED MODAL - Starting 10s countdown for table ${tableId}`);
      
      // Clear any existing restart timer
      if (table.restartGameTimer) {
        clearTimeout(table.restartGameTimer);
      }
      
      // Broadcast countdown to all players
      this.server.to(`table:${tableId}`).emit('game_restart_countdown', {
        tableId,
        secondsRemaining: 10,
        message: 'Next game starting in 10 seconds...',
        timestamp: new Date(),
      });
      
      // Start 10-second countdown
      let countdown = 10;
      const countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          this.server.to(`table:${tableId}`).emit('game_restart_countdown', {
            tableId,
            secondsRemaining: countdown,
            message: `Next game starting in ${countdown} second${countdown === 1 ? '' : 's'}...`,
            timestamp: new Date(),
          });
        }
      }, 1000);
      
      // After 10 seconds, restart the game
      table.restartGameTimer = setTimeout(async () => {
        clearInterval(countdownInterval);
        
        this.logger.log(`🔄 RESTARTING GAME for table ${tableId}`);
        
        // Reset modal tracking
        table.modalClosedPlayers = new Set<string>();
        
        // Check if all players still have sufficient balance
        // This will remove players with insufficient balance and restart if enough players remain
        await this.checkAndRemoveInsufficientPlayers(tableId);
        
      }, 10000);
    }
    
    return { success: true, allClosed: allPlayersClosed };
  }

  /**
   * User announces they're online in the lobby
   */
  @SubscribeMessage('user_online')
  handleUserOnline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string; email?: string; username?: string; avatar?: string },
  ) {
    const { userId, email, username, avatar } = data;
    
    // CRITICAL: Join client to 'lobby' room for broadcasts
    client.join('lobby');
    this.logger.log(`   ✅ Client ${client.id} joined 'lobby' room`);
    
    // Get lobby size for debugging
    const lobbySize = this.server.sockets.adapter.rooms.get('lobby')?.size || 0;
    this.logger.log(`   Total clients in lobby: ${lobbySize}`);
    
    // Add to online users
    this.onlineUsers.add(userId);
    
    // Clean up any old socket mappings for this user first
    const oldSocketId = this.userSockets.get(userId);
    if (oldSocketId && oldSocketId !== client.id) {
      this.logger.log(`[UserOnline] Cleaning up old socket mapping: User ${userId} was mapped to ${oldSocketId}, now mapping to ${client.id}`);
      this.connectedPlayers.delete(oldSocketId);
    }
    
    // Store user mapping
    this.connectedPlayers.set(client.id, userId);
    this.userSockets.set(userId, client.id);
    this.logger.log(`[UserOnline] Updated socket mapping: User ${userId} -> Socket ${client.id}`);
    
    // Store user data
    this.userData.set(userId, {
      userId,
      email,
      username,
      avatar,
      socketId: client.id,
    });
    
    this.logger.log(`User ${userId} (${email}) is online in lobby. Total online: ${this.onlineUsers.size}`);
    
    // Broadcast to all lobby users that someone joined
    this.server.to('lobby').emit('user_joined_lobby', {
      userId,
      email,
      timestamp: new Date(),
    });
    
    // Send current online users list to the new user
    const onlineUsersList = Array.from(this.onlineUsers).map(id => this.userData.get(id) || { userId: id });
    client.emit('users_online', onlineUsersList);
    
    // Broadcast updated online users to all
    this.server.to('lobby').emit('users_online', onlineUsersList);
    
    return {
      success: true,
      onlineCount: this.onlineUsers.size,
    };
  }

  /**
   * Send game invite to another user
   */
  @SubscribeMessage('send_invite')
  handleSendInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      fromUserId: string;
      fromEmail: string;
      toUserId: string;
      toEmail: string;
      tableName: string;
      entryFee: number;
      maxPlayers: number;
      gameId: string;
      timestamp: Date;
    },
  ) {
    const { toUserId } = data;
    
    // Get recipient's socket
    const recipientSocketId = this.userSockets.get(toUserId);
    
    if (recipientSocketId) {
      // Send invite to recipient
      this.server.to(recipientSocketId).emit('game_invite', data);
      
      this.logger.log(`Invite sent from ${data.fromUserId} to ${toUserId} for game ${data.gameId}`);
      
      return {
        success: true,
        message: 'Invite sent successfully',
      };
    } else {
      this.logger.warn(`Cannot send invite: user ${toUserId} not connected`);
      return {
        success: false,
        message: 'User is not online',
      };
    }
  }

  /**
   * Accept a game invite
   */
  @SubscribeMessage('accept_invite')
  handleAcceptInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      inviteId: string;
      fromUserId: string;
      userId: string;
    },
  ) {
    const { fromUserId, userId } = data;
    
    // Notify the inviter that their invite was accepted
    const inviterSocketId = this.userSockets.get(fromUserId);
    
    if (inviterSocketId) {
      this.server.to(inviterSocketId).emit('invite_accepted', {
        userId,
        inviteId: data.inviteId,
        timestamp: new Date(),
      });
      
      this.logger.log(`User ${userId} accepted invite from ${fromUserId}`);
    }
    
    return {
      success: true,
      message: 'Invite accepted',
    };
  }

  /**
   * Decline a game invite
   */
  @SubscribeMessage('decline_invite')
  handleDeclineInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      inviteId: string;
      fromUserId: string;
      userId: string;
    },
  ) {
    const { fromUserId, userId } = data;
    
    // Notify the inviter that their invite was declined
    const inviterSocketId = this.userSockets.get(fromUserId);
    
    if (inviterSocketId) {
      this.server.to(inviterSocketId).emit('invite_declined', {
        userId,
        inviteId: data.inviteId,
        timestamp: new Date(),
      });
      
      this.logger.log(`User ${userId} declined invite from ${fromUserId}`);
    }
    
    return {
      success: true,
      message: 'Invite declined',
    };
  }

  /**
   * Create table (IN-MEMORY ONLY)
   */
  @SubscribeMessage('create_table')
  async handleCreateTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      tableName: string;
      entryFee: number;
      maxPlayers?: number; // Optional, will be forced to 6
      privacy?: string; // 'public' or 'private'
      creatorId: string;
      creatorEmail: string;
      creatorUsername?: string;
      creatorAvatar?: string;
    },
  ) {
    this.logger.log(`🎮 CREATE_TABLE received from ${data.creatorEmail}`);
    this.logger.log(`   Data: ${JSON.stringify(data)}`);
    
    // Generate unique table ID
    const tableId = `table_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // FORCE maxPlayers to 6 (all tables are 6-player)
    const maxPlayers = 6;
    
    // ✅ FIX: Fetch creator's platformScore from database to set initial balance
    let creatorBalance = 0;
    try {
      const userRecord = await this.usersRepository.findOne({ where: { id: data.creatorId } });
      if (userRecord && userRecord.platformScore !== null && userRecord.platformScore !== undefined) {
        creatorBalance = Math.round(Number(userRecord.platformScore));
        this.logger.log(`💰 Fetched creator platformScore for ${data.creatorEmail}: ${creatorBalance} SEKA`);
      } else {
        this.logger.warn(`⚠️ No platformScore found for creator ${data.creatorEmail}, defaulting to 0`);
      }
    } catch (error) {
      this.logger.error(`❌ Error fetching creator platformScore: ${error.message}`);
    }
    
    // ✅ NEW: Check if creator has sufficient balance (2x entry fee required)
    const requiredBalance = data.entryFee * 2;
    if (creatorBalance < requiredBalance) {
      this.logger.warn(`❌ Creator ${data.creatorEmail} has insufficient balance: ${creatorBalance} < ${requiredBalance} (2x entry fee)`);
      return {
        success: false,
        message: `Insufficient balance. You need at least ${requiredBalance} SEKA (2x entry fee of ${data.entryFee}) to create this table. Your current balance: ${creatorBalance} SEKA`,
        balance: creatorBalance,
        requiredBalance: requiredBalance,
        entryFee: data.entryFee,
      };
    }
    
    // Automatically add creator to the table
    const creatorPlayer = {
      userId: data.creatorId,
      email: data.creatorEmail,
      username: data.creatorUsername || data.creatorEmail?.split('@')[0] || 'Player',
      avatar: data.creatorAvatar,
      balance: creatorBalance, // ✅ Set from platformScore
      isActive: true,
      joinedAt: new Date(),
      socketId: client.id,
    };
    
    // ✅ Determine privacy setting
    const isPrivate = data.privacy === 'private';
    
    // Create table in memory with creator already joined
    const newTable = {
      id: tableId,
      tableName: data.tableName,
      entryFee: data.entryFee,
      maxPlayers: maxPlayers, // Always 6
      players: [creatorPlayer], // Creator automatically joins
      status: 'waiting' as const,
      privacy: data.privacy || 'public', // 'public' or 'private'
      isPrivate: isPrivate, // Boolean for easy checks
      invitedPlayers: [] as string[], // Array of invited user IDs
      creatorId: data.creatorId,
      createdAt: new Date(),
      singlePlayerSince: null as Date | null, // Track for idle timeout
      gameId: null as string | null, // Database game ID when game starts
      lastWinnerId: null as string | null, // Previous winner (becomes dealer)
      lastHeartbeat: new Date() // For auto-termination when server dies
    };
    
    this.activeTables.set(tableId, newTable);
    
    // ✅ SAVE ALL TABLES TO DATABASE IMMEDIATELY (including pending tables)
    const dbTable = this.gameTablesRepository.create({
      id: tableId,
      name: data.tableName,
      creatorId: data.creatorId,
      status: 'waiting', // Initial status
      network: 'BEP20', // Default network
      buyInAmount: data.entryFee,
      minBet: data.entryFee,
      maxBet: data.entryFee * 10,
      minPlayers: 2,
      maxPlayers: 6,
      currentPlayers: 1, // Creator already joined
      isPrivate: isPrivate, // ✅ Use privacy setting from frontend
      platformFee: 5,
    });
    
    (async () => {
      try {
        await this.gameTablesRepository.save(dbTable);
        this.logger.log(`💾 ✅ Table saved to database: ${tableId} (status: waiting)`);
      } catch (error) {
        this.logger.error(`❌ Failed to save table to database: ${error.message}`);
      }
    })();
    
    // Map user to socket for game events
    this.userSockets.set(data.creatorId, client.id);
    
    // Join the creator to the table room
    const gameRoom = `table:${tableId}`;
    client.join(gameRoom);
    
    this.logger.log(`✅ Table stored in memory: ${data.tableName} (${tableId}) - 6 players max`);
    this.logger.log(`   Privacy: ${isPrivate ? 'PRIVATE' : 'PUBLIC'}`);
    this.logger.log(`   Creator ${data.creatorEmail} automatically joined the table`);
    this.logger.log(`   Total tables in memory: ${this.activeTables.size}`);
    this.logger.log(`   Online users in lobby: ${this.onlineUsers.size}`);
    
    // 🆕 Start 20-second cleanup timer for single-player table
    this.logger.log(`⏱️ Starting 20-second cleanup timer for newly created table ${data.tableName}`);
    newTable.singlePlayerSince = new Date();
    
    const cleanupTimer = setTimeout(() => {
      const currentTable = this.activeTables.get(tableId);
      if (currentTable && currentTable.players.length === 1) {
        this.logger.log(`🗑️ Auto-cleaning up table ${data.tableName} - only 1 player after 20 seconds`);
        
        // Notify the single player
        this.server.to(`table:${tableId}`).emit('table_cleanup', {
          message: 'Table closed - no other players joined',
          tableId: tableId,
        });
        
        // Remove from memory
        this.activeTables.delete(tableId);
        
        // Mark as finished in database
        this.gameTablesRepository.update(tableId, { 
          status: 'finished',
          currentPlayers: 0
        });
        
        // Broadcast to lobby
        this.server.to('lobby').emit('table_removed', { tableId: tableId });
      }
    }, 20000); // 20 seconds
    
    // Store cleanup timer
    this.cleanupTimers.set(tableId, cleanupTimer);
    
    // Create table broadcast payload
    const tableCreatedPayload = {
      id: tableId,
      tableName: data.tableName,
      entryFee: data.entryFee,
      currentPlayers: 1, // Creator is already in
      maxPlayers: maxPlayers, // Always 6
      status: 'waiting',
      privacy: data.privacy || 'public',
      isPrivate: isPrivate,
      creatorId: data.creatorId,
      creatorEmail: data.creatorEmail,
      timestamp: new Date(),
    };
    
    // ✅ PRIVATE TABLE: Only notify the creator, NOT the lobby
    if (isPrivate) {
      this.logger.log(`🔒 PRIVATE table created - NOT broadcasting to lobby`);
      this.logger.log(`   Only creator will see this table`);
      
      // Emit only to creator directly
      client.emit('table_created', tableCreatedPayload);
      this.logger.log(`📡 Sent 'table_created' to creator only: ${data.creatorEmail}`);
    } 
    // ✅ PUBLIC TABLE: Broadcast to everyone in lobby
    else {
      const lobbyRoom = this.server.sockets.adapter.rooms.get('lobby');
      this.logger.log(`   Clients in 'lobby' room: ${lobbyRoom ? lobbyRoom.size : 0}`);
      
      // Broadcast to ALL users in lobby
      this.server.to('lobby').emit('table_created', tableCreatedPayload);
      
      this.logger.log(`📡 Broadcasted 'table_created' to lobby room (${lobbyRoom ? lobbyRoom.size : 0} clients)`);
      this.logger.log(`   Table data: ${JSON.stringify({ id: tableId, name: data.tableName, entryFee: data.entryFee, players: 1 })}`);
      
      // Also broadcast to all connected sockets (as backup)
      this.server.emit('table_created', tableCreatedPayload);
      this.logger.log(`📡 Also broadcasted to ALL connected sockets`);
      
      // Emit to creator directly to ensure they get it
      client.emit('table_created', tableCreatedPayload);
    }
    
    return {
      success: true,
      tableId: tableId,
      message: 'Table created in memory',
    };
  }

  /**
   * Get all active tables (DATABASE-FIRST)
   * - Returns only tables that exist in DB
   * - Automatically deletes DB rows with 0 participants
   */
  @SubscribeMessage('get_active_tables')
  async handleGetActiveTables(
    @ConnectedSocket() client: Socket,
    @MessageBody() data?: { userId?: string },
  ) {
    this.logger.log(`📋 GET_ACTIVE_TABLES request from client ${client.id}`);

    // ✅ FIX: Don't delete empty tables - preserve them for server restart recovery
    // Empty tables are now preserved in database with currentPlayers = 0
    // They will be filtered out from active_tables response but remain available for restart
    this.logger.log(`📋 Preserving empty tables in database for restart recovery`);

    // 2) Return tables from DB only (currentPlayers > 0)
    const dbTables = await this.gameTablesRepository
      .createQueryBuilder('t')
      .where('t.currentPlayers > 0')
      .orderBy('t.createdAt', 'DESC')
      .getMany();

    const payload = dbTables.map(t => ({
      id: t.id,
      tableName: t.name,
      entryFee: Number(t.buyInAmount || 0),
      currentPlayers: t.currentPlayers,
      maxPlayers: t.maxPlayers,
      status: t.status,
      privacy: t.isPrivate ? 'private' : 'public',
      isPrivate: t.isPrivate,
      creatorId: t.creatorId,
      network: t.network,
      createdAt: t.createdAt,
    }));

    this.logger.log(`   Returning ${payload.length} DB tables`);
    client.emit('active_tables', payload);
    return { success: true, tables: payload };
  }

  /**
   * Get specific table details (IN-MEMORY)
   */
  @SubscribeMessage('get_table_details')
  async handleGetTableDetails(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string },
  ) {
    this.logger.log(`🔍 GET_TABLE_DETAILS request for table ${data.tableId}`);
    
    const table = this.activeTables.get(data.tableId);
    
    if (!table) {
      this.logger.log(`   ❌ Table not found: ${data.tableId}`);
      return {
        success: false,
        message: 'Table not found',
      };
    }
    
    this.logger.log(`   ✅ Found table: ${table.tableName}`);
    this.logger.log(`   Players: ${table.players.length}/${table.maxPlayers}`);
    
    // JOIN the table's game room to receive game events
    const gameRoom = `table:${table.id}`;
    client.join(gameRoom);
    this.logger.log(`   🎮 Client ${client.id} joined game room: ${gameRoom}`);
    
    return {
      success: true,
      table: {
        id: table.id,
        tableName: table.tableName,
        entryFee: table.entryFee,
        maxPlayers: table.maxPlayers,
        currentPlayers: table.players.length,
        status: table.status,
        creatorId: table.creatorId,
        players: await Promise.all(table.players.map(async (p, index) => {
          // Fetch real platformScore from database
          try {
            const user = await this.usersRepository.findOne({ where: { id: p.userId } });
            return {
          userId: p.userId,
          email: p.email,
          position: index,
              balance: user?.platformScore || 0, // Dynamic Sekasvara Score from database
            };
          } catch (error) {
            this.logger.warn(`Failed to fetch balance for user ${p.userId}, using 0`);
            return {
              userId: p.userId,
              email: p.email,
              position: index,
              balance: 0,
            };
          }
        })),
      },
    };
  }

  /**
   * Player views their cards (exits blind mode)
   */
  @SubscribeMessage('player_view_cards')
  async handlePlayerViewCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; userId: string },
  ) {
    console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@', data.userId);
    this.logger.log(`👁️ Player ${data.userId} wants to view their cards in table ${data.tableId}`);
    
    let table = this.activeTables.get(data.tableId);
    
    // ✅ FIX: If table not in memory, try loading from database
    if (!table) {
      this.logger.log(`🔍 Table ${data.tableId} not in memory for card viewing, checking database...`);
      try {
        const dbTable = await this.gameTablesRepository.findOne({ 
          where: { id: data.tableId },
          relations: ['players']
        });
        
        if (dbTable && dbTable.currentGameId) {
          this.logger.log(`✅ Found table in database with active game, loading into memory...`);
          
          // Load existing players from database
          const existingPlayers: Array<any> = [];
          if (dbTable.players && dbTable.players.length > 0) {
            for (const dbPlayer of dbTable.players) {
              try {
                const user = await this.usersRepository.findOne({ where: { id: dbPlayer.userId } });
                if (user) {
                  existingPlayers.push({
                    userId: dbPlayer.userId,
                    email: user.email,
                    username: user.username || user.email?.split('@')[0] || 'Player',
                    avatar: user.avatar || null,
                    balance: user.platformScore ? Math.round(Number(user.platformScore)) : 0,
                    isActive: dbPlayer.status === 'active',
                    joinedAt: dbPlayer.joinedAt,
                    socketId: this.userSockets.get(dbPlayer.userId) || null,
                  });
                }
              } catch (err) {
                this.logger.error(`   ❌ Failed to load player ${dbPlayer.userId}: ${err.message}`);
              }
            }
          }
          
          // Load table into memory
          table = {
            id: dbTable.id,
            tableName: dbTable.name,
            entryFee: Number(dbTable.buyInAmount),
            maxPlayers: dbTable.maxPlayers,
            players: existingPlayers,
            status: 'in_progress' as const,
            privacy: dbTable.isPrivate ? 'private' : 'public',
            isPrivate: dbTable.isPrivate,
            invitedPlayers: [],
            creatorId: dbTable.creatorId,
            createdAt: new Date(dbTable.createdAt),
            singlePlayerSince: null,
            gameId: dbTable.currentGameId,
            lastWinnerId: null,
            lastHeartbeat: new Date()
          };
          this.activeTables.set(data.tableId, table);
          this.logger.log(`✅ Table loaded for card viewing with ${existingPlayers.length} player(s)`);
        }
      } catch (error) {
        this.logger.error(`❌ Error loading table for card viewing: ${error.message}`);
      }
    }
    
    if (!table || !table.gameId) {
      return { success: false, message: 'Table or game not found' };
    }
    
    try {
      const game = await this.gameService.findOne(table.gameId);
      const player = game.players.find(p => p.userId === data.userId);
      
      if (!player) {
        return { success: false, message: 'Player not found in game' };
      }
      
      if (player.hasSeenCards) {
        return { success: false, message: 'You have already seen your cards' };
      }
      
      // Mark player as having seen their cards
      player.hasSeenCards = true;
      
      // ✅ NEW: Track in database - Add to cardViewers array
      if (!game.cardViewers) {
        game.cardViewers = [];
      }
      if (!game.cardViewers.includes(data.userId)) {
        game.cardViewers.push(data.userId);
        this.logger.log(`📊 Added ${data.userId} to cardViewers array. Total viewers: ${game.cardViewers.length}`);
      }
      
      await this.gameService.saveGame(game);
      
      this.logger.log(`👁️ Player ${data.userId} has SEEN their cards (no longer blind)`);
      this.logger.log(`   🎴 Cards: ${JSON.stringify(player.hand)}`);
      this.logger.log(`   🎯 Score: ${player.handScore} - ${player.handDescription}`);
      this.logger.log(`   📋 CardViewers in DB: ${JSON.stringify(game.cardViewers)}`);
      
      // ✅ Broadcast player_seen_cards event to ALL players in table
      // This notifies all clients that this player has viewed their cards
      const gameStateForBroadcast = await this.gameStateService.getSanitizedGameStateForUser(game, data.userId);
      this.server.to(`table:${data.tableId}`).emit('player_seen_cards', {
        userId: data.userId,
        gameState: gameStateForBroadcast,
        timestamp: new Date(),
      });
      
      this.logger.log(`📢 Broadcasted player_seen_cards event for ${data.userId}`);
      
      // 🔒 SECURE: Broadcast sanitized game state to each player
      // Each player only sees their own cards (if they've viewed them)
      await this.broadcastSanitizedGameState(game, data.tableId);
      
      // ✅ ONLY send card details to the requesting player (no broadcast)
      // This prevents other players' screens from flipping
      const sanitizedState = await this.gameStateService.getSanitizedGameStateForUser(game, data.userId);
      
      return { 
        success: true, 
        message: 'Cards viewed successfully',
        hand: player.hand,
        handScore: player.handScore,
        handDescription: player.handDescription,
        gameState: sanitizedState, // Include sanitized game state for client
      };
    } catch (error) {
      this.logger.error(`❌ Error viewing cards: ${error.message}`);
      return { success: false, message: 'Failed to view cards' };
    }
  }

  /**
   * Player plays blind (without seeing cards)
   */
  @SubscribeMessage('player_play_blind')
  async handlePlayerPlayBlind(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      tableId: string; 
      userId: string; 
      action: string; 
      amount?: number;
    },
  ) {
    this.logger.log(`🎲 Player ${data.userId} playing blind: ${data.action} (amount: ${data.amount}) in table ${data.tableId}`);
    
    const table = this.activeTables.get(data.tableId);
    if (!table || !table.gameId) {
      this.logger.error(`❌ Table or game not found for blind action`);
      return { success: false, message: 'Table or game not found' };
    }
    
    try {
      const game = await this.gameService.findOne(table.gameId);
      
      // Check if player is in the game
      const player = game.players.find(p => p.userId === data.userId);
      if (!player) {
        this.logger.error(`❌ Player ${data.userId} not found in game`);
        return { success: false, message: 'You are not in this game' };
      }
      
      // Check if it's player's turn
      if (game.state.currentPlayerId !== data.userId) {
        this.logger.error(`❌ Not player ${data.userId}'s turn. Current turn: ${game.state.currentPlayerId}`);
        return { success: false, message: 'It is not your turn' };
      }
      
      // Mark player as playing blind (not seeing cards)
      if (!player.hasSeenCards) {
        this.logger.log(`👁️ Player ${data.userId} is playing blind (hasn't seen cards)`);
        
        // ✅ NEW: Track in database - Add to blindPlayers object
        if (!game.blindPlayers) {
          game.blindPlayers = {};
        }
        if (!game.blindPlayers[data.userId]) {
          game.blindPlayers[data.userId] = { count: 0, totalAmount: 0 };
        }
        game.blindPlayers[data.userId].count += 1;
        game.blindPlayers[data.userId].totalAmount += (data.amount || 0);
        
        this.logger.log(`📊 Blind bet tracked for ${data.userId}:`);
        this.logger.log(`   Blind count: ${game.blindPlayers[data.userId].count}`);
        this.logger.log(`   Total blind amount: ${game.blindPlayers[data.userId].totalAmount}`);
      }
      
      // Validate and cast action to BettingAction enum
      const validActions = ['check', 'bet', 'call', 'raise', 'fold', 'all_in'];
      if (!validActions.includes(data.action)) {
        this.logger.error(`❌ Invalid action: ${data.action}`);
        return { success: false, message: `Invalid action: ${data.action}` };
      }
      
      // 🎲 BLIND BETTING RULE: When playing blind, next player must bet 2x the pot
      const currentPot = game.state.pot;
      const wasBlind = !player.hasSeenCards;
      
      this.logger.log(`🎲 BLIND BETTING: Current pot = ${currentPot}, Player is ${wasBlind ? 'BLIND' : 'SEEING'}`);
      
      // Process the blind action as a regular betting action
      await this.gameEngine.processPlayerAction(game, data.userId, data.action as any, data.amount);
      
      // ✅ APPLY BLIND BETTING RULE: Set minimum bet for next player to 2x pot
      if (wasBlind && data.action !== 'fold') {
        const blindMinimumBet = currentPot * 2;
        game.state.currentBet = Math.max(game.state.currentBet, blindMinimumBet);
        await this.gameService.saveGame(game);
        
        this.logger.log(`🎲 BLIND BETTING RULE APPLIED: Next player must bet at least ${blindMinimumBet} (2x ${currentPot})`);
      }
      
      this.logger.log(`✅ Player ${data.userId} played blind: ${data.action} ${data.amount || ''}`);
      
      // 🔒 SECURE: Broadcast sanitized game state to each player
      await this.broadcastSanitizedGameState(game, data.tableId);
      
      return { success: true, message: 'Blind action processed' };
    } catch (error) {
      this.logger.error(`❌ Error playing blind: ${error.message}`, error.stack);
      return { success: false, message: error.message || 'Failed to process blind action' };
    }
  }

  /**
   * Heartbeat to keep games alive and detect server crashes
   */
  @SubscribeMessage('heartbeat')
  handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId?: string; userId?: string },
  ) {
    // Update heartbeat for all tables if no specific table
    if (data.tableId) {
      const table = this.activeTables.get(data.tableId);
      if (table) {
        table.lastHeartbeat = new Date();
      }
    } else {
      // Update heartbeat for all tables
      this.activeTables.forEach(table => {
        table.lastHeartbeat = new Date();
      });
    }
    
    return { success: true, timestamp: new Date().toISOString() };
  }

  /**
   * ✅ Force showdown when all players have called
   * This is triggered by the frontend when it detects all active players have called
   */
  @SubscribeMessage('force_showdown')
  async handleForceShowdown(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; reason?: string },
  ) {
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('🎯 FORCE SHOWDOWN REQUEST');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`   Table ID: ${data.tableId}`);
    this.logger.log(`   Reason: ${data.reason || 'Frontend detected all players called'}`);
    
    try {
      const table = this.activeTables.get(data.tableId);
      if (!table) {
        this.logger.warn(`❌ Table ${data.tableId} not found`);
        return { success: false, message: 'Table not found' };
      }
      
      if (!table.gameId) {
        this.logger.warn(`❌ No active game in table ${data.tableId}`);
        return { success: false, message: 'No active game' };
      }
      
      const game = await this.gameService.findOne(table.gameId);
      if (!game) {
        this.logger.warn(`❌ Game ${table.gameId} not found`);
        return { success: false, message: 'Game not found' };
      }
      
      this.logger.log('✅ Requesting game engine to execute showdown...');
      
      // Force the game engine to execute showdown
      await this.gameEngine.executeShowdown(game);
      
      this.logger.log('✅ Showdown executed - broadcasting results...');
      
      // Broadcast showdown results to all players
      await this.broadcastShowdown(data.tableId, table.gameId);
      
      this.logger.log('✅ Force showdown complete');
      this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      return { success: true, message: 'Showdown executed' };
    } catch (error) {
      this.logger.error(`❌ Error forcing showdown: ${error.message}`, error.stack);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get online users for the lobby
   */
  @SubscribeMessage('get_online_users')
  handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`👥 GET_ONLINE_USERS request from client ${client.id}`);
    this.logger.log(`   Total in onlineUsers set: ${this.onlineUsers.size}`);
    
    // Get all online users from the lobby (including bots!)
    const onlineUsers = Array.from(this.onlineUsers).map(userId => {
      const userData = this.userData.get(userId);
      const isBot = userData?.email?.includes('@bot.ai') || false;
      
      return {
        userId: userId,
        email: userData?.email || '',
        username: userData?.username || userData?.email?.split('@')[0] || 'Player',
        avatar: userData?.avatar || null,
        isOnline: true,
        isBot, // ✅ Mark bots so frontend can show indicator
        lastSeen: new Date().toISOString()
      };
    });
    
    const botCount = onlineUsers.filter(u => u.isBot).length;
    const humanCount = onlineUsers.length - botCount;
    
    this.logger.log(`   📊 Returning ${onlineUsers.length} online users (${humanCount} humans, ${botCount} bots)`);
    
    return {
      success: true,
      onlineUsers,
      totalOnline: onlineUsers.length,
      humanCount,
      botCount,
    };
  }

  /**
   * Send game invitation to another user
   * ✅ NEW: Support pending invites (table created on accept)
   */
  @SubscribeMessage('send_game_invitation')
  async handleSendGameInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      targetUserId: string;
      tableName: string;
      tableId?: string; // ✅ Optional now
      entryFee: number;
      gameUrl?: string;
      pending?: boolean; // ✅ New: marks invitation as pending (table created on accept)
      tableSettings?: any; // ✅ New: settings for creating table on accept
    }
  ) {
    const inviterUserId = this.connectedPlayers.get(client.id);
    if (!inviterUserId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    const inviterData = this.userData.get(inviterUserId);
    const targetUserSocketId = this.userSockets.get(data.targetUserId);

    this.logger.log(`🎯 Game invitation from ${inviterUserId} to ${data.targetUserId}`);
    this.logger.log(`   Pending: ${data.pending ? 'YES (table will be created on accept)' : 'NO (table already exists)'}`);

    // ❌ REMOVED: Bot auto-accept code - Bots are no longer used

    const invitationData = {
      inviterId: inviterUserId,
      inviterName: inviterData?.username || inviterData?.email?.split('@')[0] || 'Anonymous',
      inviterEmail: inviterData?.email,
      tableName: data.tableName,
      tableId: data.tableId, // May be undefined for pending invites
      entryFee: data.entryFee,
      gameUrl: data.gameUrl,
      pending: data.pending || false,
      tableSettings: data.tableSettings, // For creating table on accept
      timestamp: new Date().toISOString()
    };

    // ✅ Add invited player to table's invitedPlayers array (ONLY if table already exists)
    if (data.tableId && !data.pending) {
      const table: any = this.activeTables.get(data.tableId);
      if (table) {
        if (!table.invitedPlayers) {
          table.invitedPlayers = [];
        }
        
        // Add to invited players if not already there
        if (!table.invitedPlayers.includes(data.targetUserId)) {
          table.invitedPlayers.push(data.targetUserId);
          this.logger.log(`✅ Added ${data.targetUserId} to invited players for table ${data.tableId}`);
          
          // If this is a private table, send table_created event to the invited player
          if (table.isPrivate && targetUserSocketId) {
            const tableCreatedPayload = {
              id: table.id,
              tableName: table.tableName,
              entryFee: table.entryFee,
              currentPlayers: table.players.length,
              maxPlayers: table.maxPlayers,
              status: table.status,
              privacy: table.privacy,
              isPrivate: table.isPrivate,
              creatorId: table.creatorId,
              timestamp: new Date(),
            };
            
            this.server.to(targetUserSocketId).emit('table_created', tableCreatedPayload);
            this.logger.log(`📡 Sent private table visibility to invited player ${data.targetUserId}`);
          }
        }
      }
    } else if (data.pending) {
      this.logger.log(`📋 Pending invitation - table will be created when ${data.targetUserId} accepts`);
    }

    // Check if target user is online and verify socket is still connected
    if (targetUserSocketId && this.onlineUsers.has(data.targetUserId)) {
      // Verify the socket is still connected
      const targetSocket = this.server.sockets.sockets.get(targetUserSocketId);
      if (!targetSocket || !targetSocket.connected) {
        this.logger.warn(`📱 Target socket ${targetUserSocketId} is no longer connected, cleaning up mapping`);
        this.userSockets.delete(data.targetUserId);
        this.connectedPlayers.delete(targetUserSocketId);
        this.onlineUsers.delete(data.targetUserId);
        
        // Fall back to email
        this.logger.log(`📧 Falling back to email for ${data.targetUserId}`);
        
        // ✅ Skip email for pending invites (no gameUrl yet)
        if (data.pending) {
          this.logger.log(`⏭️ Skipping email for pending invite (table will be created on accept)`);
          return;
        }
        
        try {
          // Get target user data from the userData map
          const targetUserData = this.userData.get(data.targetUserId);
          const emailResult = await this.emailService.sendGameInvitation(
            targetUserData?.email || 'unknown@example.com',
            inviterData?.username || inviterData?.email?.split('@')[0] || 'Anonymous',
            data.tableName,
            data.entryFee,
            data.gameUrl || ''
          );
          
          client.emit('invitation_sent', {
            success: true,
            method: 'email',
            messageId: emailResult.messageId,
            targetUserId: data.targetUserId
          });
        } catch (error) {
          this.logger.error(`📧 Email fallback failed:`, error);
          client.emit('invitation_sent', {
            success: false,
            method: 'email',
            error: error.message,
            targetUserId: data.targetUserId
          });
        }
        return;
      }
      
      // Send real-time notification
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📤 SENDING GAME INVITATION VIA SOCKET.IO');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📨 FROM:`, inviterData?.username || inviterData?.email || inviterUserId);
      console.log(`📨 TO:`, data.targetUserId);
      console.log(`📨 TO Socket ID:`, targetUserSocketId);
      console.log(`📨 Table:`, data.tableName);
      console.log(`📨 Entry Fee:`, data.entryFee, 'SEKA');
      console.log(`📨 Table ID:`, data.tableId);
      console.log(`📨 Game URL:`, data.gameUrl);
      console.log(`📨 Event Name:`, 'game_invitation');
      console.log(`📨 Data:`, JSON.stringify(invitationData, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      this.server.to(targetUserSocketId).emit('game_invitation', invitationData);
      
      console.log('✅ Socket.IO emit() called successfully!');
      console.log('📡 Invitation should now be in transit to recipient...\n');
      
      // Confirm to sender
      client.emit('invitation_sent', {
        success: true,
        method: 'realtime',
        targetUserId: data.targetUserId
      });
    } else {
      // User is offline, send email
      this.logger.log(`📧 User ${data.targetUserId} is offline, sending email`);
      
      // ✅ Skip email for pending invites (no gameUrl yet)
      if (data.pending) {
        this.logger.log(`⏭️ Skipping email for pending invite (table will be created on accept)`);
        client.emit('invitation_sent', {
          success: false,
          method: 'none',
          error: 'User offline and pending invite (no email sent)',
          targetUserId: data.targetUserId
        });
        return;
      }
      
      // Send email invitation using injected EmailService
      this.emailService.sendGameInvitation(
        invitationData.inviterEmail || 'unknown@example.com',
        invitationData.inviterName,
        invitationData.tableName,
        invitationData.entryFee,
        invitationData.gameUrl || ''
      ).then(() => {
        client.emit('invitation_sent', {
          success: true,
          method: 'email',
          targetUserId: data.targetUserId
        });
      }).catch((error) => {
        this.logger.error(`Failed to send email invitation: ${error.message}`);
        client.emit('invitation_sent', {
          success: false,
          method: 'email',
          error: error.message,
          targetUserId: data.targetUserId
        });
      });
    }
  }

  @SubscribeMessage('debug_socket_id')
  handleDebugSocketId(@ConnectedSocket() client: Socket) {
    const userId = this.connectedPlayers.get(client.id);
    this.logger.log(`[Debug] Client ${client.id} (User ${userId}) requested its socket ID.`);
    client.emit('debug_socket_id_response', { socketId: client.id, userId: userId });
  }

  /**
   * Respond to game invitation
   */
  @SubscribeMessage('respond_to_invitation')
  handleRespondToInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      notificationId: string;
      response: 'accepted' | 'declined';
      tableId: string;
      inviterId: string;
    }
  ) {
    const responderUserId = this.connectedPlayers.get(client.id);
    if (!responderUserId) {
      client.emit('error', { message: 'Not authenticated' });
      return;
    }

    this.logger.log(`📨 Invitation response from ${responderUserId}: ${data.response}`);

    // Notify the inviter about the response
    const inviterSocketId = this.userSockets.get(data.inviterId);
    if (inviterSocketId) {
      this.server.to(inviterSocketId).emit('invitation_response', {
        notificationId: data.notificationId,
        responderId: responderUserId,
        response: data.response,
        tableId: data.tableId,
        timestamp: new Date().toISOString()
      });
    }

    // Confirm response to responder
    client.emit('response_sent', {
      success: true,
      response: data.response,
      tableId: data.tableId
    });
  }

  /**
   * Get user's current table (for auto-redirect)
   */
  @SubscribeMessage('get_user_current_table')
  handleGetUserCurrentTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    this.logger.log(`🔍 Checking if user ${data.userId} is in a table...`);
    
    for (const [tableId, table] of this.activeTables.entries()) {
      const playerInTable = table.players.find(p => p.userId === data.userId);
      if (playerInTable) {
        this.logger.log(`✅ User is in table: ${tableId} (${table.tableName})`);
        return {
          success: true,
          inTable: true,
          table: {
            id: tableId,
            tableName: table.tableName,
            entryFee: table.entryFee,
            players: table.players.length,
            maxPlayers: table.maxPlayers,
            status: table.status,
          }
        };
      }
    }
    
    this.logger.log(`❌ User is not in any table`);
    return {
      success: true,
      inTable: false,
      table: null
    };
  }

  /**
   * Join table (IN-MEMORY) - Allows rejoining if previously left
   */
  @SubscribeMessage('join_table')
  async handleJoinTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      tableId: string;
      userId: string;
      userEmail: string;
      username?: string;
      avatar?: string;
      tableName?: string;
      entryFee?: number;
    },
  ) {
    // 1️⃣ Check if player is already in ANOTHER table
    for (const [tableId, existingTable] of this.activeTables.entries()) {
      const playerInTable = existingTable.players.find(p => p.userId === data.userId);
      if (playerInTable && tableId !== data.tableId) {
        this.logger.log(`⚠️ Player ${data.userEmail} is already in table ${tableId}, redirecting...`);
        return {
          success: false,
          message: 'You are already in another table',
          redirect: tableId,
          currentTable: {
            id: tableId,
            tableName: existingTable.tableName,
            entryFee: existingTable.entryFee,
            players: existingTable.players.length,
            maxPlayers: existingTable.maxPlayers,
          }
        };
      }
    }

    let table = this.activeTables.get(data.tableId);
    
    // 2️⃣ If table not in memory, try loading from database
    if (!table) {
      this.logger.log(`🔍 Table ${data.tableId} not in memory, checking database...`);
      try {
        const dbTable = await this.gameTablesRepository.findOne({ 
          where: { id: data.tableId },
          relations: ['players']
        });
        
        // ✅ FIX: Load tables with 'waiting' OR 'playing' status (not just 'waiting')
        if (dbTable && (dbTable.status === 'waiting' || dbTable.status === 'playing')) {
          this.logger.log(`✅ Found table in database (status: ${dbTable.status}), loading into memory...`);
          this.logger.log(`   Database has ${dbTable.players?.length || 0} players`);
          this.logger.log(`   Database currentPlayers: ${dbTable.currentPlayers || 0}`);
          
          // ✅ FIX: Load existing players from database
          const existingPlayers: Array<{ 
            userId: string; 
            email: string; 
            username?: string; 
            avatar?: string | null;
            balance?: number;
            isActive?: boolean;
            joinedAt?: Date;
            socketId?: string | null;
          }> = [];
          
          // Load players from table_players relation
          if (dbTable.players && dbTable.players.length > 0) {
            for (const dbPlayer of dbTable.players) {
              try {
                // Fetch user data for each player
                const user = await this.usersRepository.findOne({ where: { id: dbPlayer.userId } });
                if (user) {
                  const playerBalance = user.platformScore ? Math.round(Number(user.platformScore)) : 0;
                  existingPlayers.push({
                    userId: dbPlayer.userId,
                    email: user.email,
                    username: user.username || user.email?.split('@')[0] || 'Player',
                    avatar: user.avatar || null,
                    balance: playerBalance,
                    isActive: dbPlayer.status === 'active',
                    joinedAt: dbPlayer.joinedAt,
                    socketId: this.userSockets.get(dbPlayer.userId) || null, // Try to reconnect socket
                  });
                  this.logger.log(`   ✅ Loaded player: ${user.email} (balance: ${playerBalance})`);
                }
              } catch (err) {
                this.logger.error(`   ❌ Failed to load player ${dbPlayer.userId}: ${err.message}`);
              }
            }
          }
          
          // ✅ FIX: If database says there are more players than we loaded, try to sync
          if (dbTable.currentPlayers > existingPlayers.length) {
            this.logger.warn(`⚠️ Database shows ${dbTable.currentPlayers} players but only loaded ${existingPlayers.length} - attempting to sync`);
            // This will be handled by the join logic below
          }
          
          // Load table into memory WITH existing players
          table = {
            id: dbTable.id,
            tableName: dbTable.name,
            entryFee: Number(dbTable.buyInAmount),
            maxPlayers: dbTable.maxPlayers,
            players: existingPlayers, // ✅ FIX: Use loaded players instead of empty array
            status: (dbTable.status === 'playing' ? 'in_progress' : 'waiting') as 'waiting' | 'in_progress', // ✅ FIX: Use actual status from DB
            privacy: dbTable.isPrivate ? 'private' : 'public',
            isPrivate: dbTable.isPrivate,
            invitedPlayers: [],
            creatorId: dbTable.creatorId,
            createdAt: new Date(dbTable.createdAt),
            singlePlayerSince: existingPlayers.length === 1 ? new Date() : null, // Start cleanup timer if only 1 player
            gameId: dbTable.currentGameId || null, // ✅ FIX: Load existing gameId if present
            lastWinnerId: null,
            lastHeartbeat: new Date()
          };
          this.activeTables.set(data.tableId, table);
          this.logger.log(`✅ Table loaded with ${existingPlayers.length} player(s) from database`);
        }
      } catch (error) {
        this.logger.error(`❌ Error loading table from database: ${error.message}`);
      }
    }
    
    // If table doesn't exist and it's a "pending" table from invitation, create it automatically
    if (!table && data.tableId.startsWith('pending-')) {
      this.logger.log(`🔧 Auto-creating pending table: ${data.tableId}`);
      
      // Create table with first player as creator
      const newTable = {
        id: data.tableId,
        tableName: data.tableName || 'Invited Game',
        entryFee: data.entryFee || 10,
        maxPlayers: 6, // Always 6-player tables
        players: [{
          userId: data.userId,
          email: data.userEmail,
          username: data.username || data.userEmail?.split('@')[0] || 'Player',
          avatar: data.avatar,
        }],
        status: 'waiting' as const,
        creatorId: data.userId,
        createdAt: new Date(),
        singlePlayerSince: new Date() as Date | null,
        gameId: null as string | null,
        lastWinnerId: null as string | null,
        lastHeartbeat: new Date()
      };
      
      this.activeTables.set(data.tableId, newTable);
      table = newTable;
      
      // ✅ SAVE PENDING TABLE TO DATABASE IMMEDIATELY
      const dbTable = this.gameTablesRepository.create({
        id: data.tableId,
        name: newTable.tableName,
        creatorId: data.userId,
        status: 'waiting', // Initial status
        network: 'BEP20',
        buyInAmount: newTable.entryFee,
        minBet: newTable.entryFee,
        maxBet: newTable.entryFee * 10,
        minPlayers: 2,
        maxPlayers: 6,
        currentPlayers: 1,
        isPrivate: false,
        platformFee: 5,
      });
      
      (async () => {
        try {
          await this.gameTablesRepository.save(dbTable);
          this.logger.log(`💾 ✅ Pending table saved to database: ${data.tableId} (status: waiting)`);
        } catch (error) {
          this.logger.error(`❌ Failed to save pending table to database: ${error.message}`);
        }
      })();
      
      // Map user socket
      this.userSockets.set(data.userId, client.id);
      
      // Join game room
      const gameRoom = `table:${data.tableId}`;
      client.join(gameRoom);
      
      this.logger.log(`✅ Auto-created table ${newTable.tableName} (ID: ${data.tableId})`);
      this.logger.log(`   📊 Current activeTables size: ${this.activeTables.size}`);
      
      // Broadcast table_created to lobby (triple broadcast for reliability)
      const tableCreatedData = {
        id: data.tableId,
        tableName: newTable.tableName,
        entryFee: newTable.entryFee,
        currentPlayers: 1,
        maxPlayers: 6,
        status: 'waiting',
        creatorId: data.userId,
        creatorEmail: data.userEmail,
        timestamp: new Date(),
      };
      
      this.server.to('lobby').emit('table_created', tableCreatedData);
      this.server.emit('table_created', tableCreatedData);
      client.emit('table_created', tableCreatedData);
      
      this.logger.log(`📢 Broadcasted table_created for auto-created table`);
      
      return {
        success: true,
        message: 'Table created and joined'
      };
    }
    
    // ✅ TypeScript type guard: ensure table exists
    if (!table) {
      this.logger.log(`❌ Join failed: Table ${data.tableId} not found`);
      return {
        success: false,
        message: 'Table not found'
      };
    }
    
    // ✅ FIX RACE CONDITION: Check both in-memory AND database to prevent duplicate joins
    const existingPlayer = table.players.find(p => p.userId === data.userId);
    
    // Also check database to catch race conditions where player was added but table not yet synced
    let dbPlayerExists = false;
    try {
      const dbTable = await this.gameTablesRepository.findOne({ 
        where: { id: data.tableId },
        relations: ['players']
      });
      if (dbTable?.players) {
        dbPlayerExists = dbTable.players.some(p => p.userId === data.userId);
      }
    } catch (error) {
      this.logger.error(`Error checking database for existing player: ${error.message}`);
    }
    
    // ✅ FIX: If player exists in DB but not in memory, add them to memory
    if (dbPlayerExists && !existingPlayer) {
      this.logger.log(`🔄 Player ${data.userEmail} exists in database but not in memory - adding to memory`);
      
      // Fetch user's platformScore from database
      let userBalance = 0;
      try {
        const userRecord = await this.usersRepository.findOne({ where: { id: data.userId } });
        if (userRecord && userRecord.platformScore !== null && userRecord.platformScore !== undefined) {
          userBalance = Math.round(Number(userRecord.platformScore));
          this.logger.log(`💰 Fetched platformScore for ${data.userEmail}: ${userBalance} SEKA`);
        }
      } catch (error) {
        this.logger.error(`❌ Error fetching user platformScore: ${error.message}`);
      }
      
      // Add player to in-memory table
      table.players.push({
        userId: data.userId,
        email: data.userEmail,
        username: data.username || data.userEmail.split('@')[0],
        avatar: data.avatar || null,
        balance: userBalance,
        isActive: true,
        joinedAt: new Date(),
        socketId: client.id,
      });
      
      this.logger.log(`✅ Added player ${data.userEmail} to in-memory table (now ${table.players.length} players)`);
      
      // Update database currentPlayers count
      try {
        await this.gameTablesRepository.update(data.tableId, {
          currentPlayers: table.players.length,
        });
        this.logger.log(`💾 ✅ Database updated: Table ${data.tableId} now has ${table.players.length} players`);
      } catch (error) {
        this.logger.error(`❌ Failed to update table in database: ${error.message}`);
      }
      
      // Broadcast updated player list
      this.server.to(`table:${table.id}`).emit('player_list_updated', {
        tableId: table.id,
        players: table.players.map(p => ({
          userId: p.userId,
          email: p.email,
          username: p.username,
          avatar: p.avatar,
          balance: p.balance,
          isActive: p.isActive,
          joinedAt: p.joinedAt
        })),
        timestamp: new Date(),
      });
      
      // Join the Socket.IO room
      const gameRoom = `table:${data.tableId}`;
      client.join(gameRoom);
      this.logger.log(`🎮 Client ${client.id} joined game room: ${gameRoom}`);
      
      // Update userSockets map
      this.userSockets.set(data.userId, client.id);
      
      // Return success with full player list
      return {
        success: true,
        message: 'Joined table successfully (synced from database)',
        players: table.players.map(p => ({
          userId: p.userId,
          email: p.email,
          username: p.username,
          avatar: p.avatar,
          balance: p.balance,
          isActive: p.isActive,
          joinedAt: p.joinedAt
        })),
        currentPlayers: table.players.length,
        maxPlayers: table.maxPlayers,
        tableName: table.tableName,
        entryFee: table.entryFee
      };
    }
    
    if (existingPlayer || dbPlayerExists) {
      this.logger.log(`🔄 Player ${data.userEmail} already in table ${table.tableName} - rejoin allowed`);
      this.logger.log(`   Current table state: ${table.players.length} players`);
      
      // ✅ Update player data and socketId (CRITICAL for reconnects!)
      const playerToUpdate = existingPlayer || table.players.find(p => p.userId === data.userId);
      if (playerToUpdate) {
        playerToUpdate.email = data.userEmail;
        playerToUpdate.socketId = client.id; // Update socket ID
        if (data.username) playerToUpdate.username = data.username;
        if (data.avatar) playerToUpdate.avatar = data.avatar;
        
        // Update balance if needed
        if (playerToUpdate.balance === undefined || playerToUpdate.balance === null) {
          try {
            const userRecord = await this.usersRepository.findOne({ where: { id: data.userId } });
            if (userRecord && userRecord.platformScore !== null && userRecord.platformScore !== undefined) {
              playerToUpdate.balance = Math.round(Number(userRecord.platformScore));
            }
          } catch (error) {
            this.logger.error(`❌ Error fetching balance for update: ${error.message}`);
          }
        }
      }
      
      // ✅ Update userSockets map
      this.userSockets.set(data.userId, client.id);
      
      // ✅ ENSURE they're in the Socket.IO room (in case they reconnected)
      const gameRoom = `table:${data.tableId}`;
      client.join(gameRoom);
      this.logger.log(`🎮 Client ${client.id} rejoined game room: ${gameRoom}`);
      
      // ✅ Log all players in table for debugging
      for (const p of table.players) {
        this.logger.log(`   Player: ${p.email}, socketId: ${p.socketId || 'null'}, connected: ${p.socketId ? 'YES' : 'NO'}`);
      }
      
      // ✅ Broadcast updated player list to all players in table (critical for syncing)
      this.server.to(`table:${table.id}`).emit('player_list_updated', {
        tableId: table.id,
        players: table.players.map(p => ({
          userId: p.userId,
          email: p.email,
          username: p.username,
          avatar: p.avatar,
          balance: p.balance,
          isActive: p.isActive,
          joinedAt: p.joinedAt
        })),
        timestamp: new Date(),
      });
      this.logger.log(`📢 Broadcasted player list to table room (${table.players.length} players)`);
      
      // IMPORTANT: Still check for auto-start even on rejoin!
      // The second player might have joined while this player was navigating
      // ONLY start countdown when EXACTLY 2 players
      if (table.players.length === 2 && table.status === 'waiting') {
        // Check if countdown is already in progress for this table
        if (!this.countdownTimers.has(table.id)) {
          this.logger.log(`🚀 AUTO-START: EXACTLY 2 players present (rejoin triggered check) - starting game with 10-second countdown!`);
          
          // Emit game_starting event to show countdown to all players
          this.server.to(`table:${table.id}`).emit('game_starting', {
            tableId: table.id,
            tableName: table.tableName,
            countdown: 10, // 10 seconds countdown
            message: 'Game is starting! Get ready...',
            timestamp: new Date(),
          });
          
          // Start game after 10-second delay
          const tableIdForTimer = table.id;
          const timer = setTimeout(() => {
            const currentTable = this.activeTables.get(tableIdForTimer);
            if (currentTable) {
              this.autoStartGame(currentTable.id);
              this.countdownTimers.delete(currentTable.id); // Clean up timer reference
            }
          }, 10000); // 10 seconds
          
          // Store timer to prevent duplicates
          this.countdownTimers.set(tableIdForTimer, timer);
        } else {
          this.logger.log(`⏱️ Countdown already in progress for table ${table.tableName} (rejoin)`);
        }
      }
      
      // ✅ FIX: Return full player list on rejoin for immediate sync
      return {
        success: true,
        message: 'Already in table - rejoined successfully',
        players: table.players.map(p => ({
          userId: p.userId,
          email: p.email,
          username: p.username,
          avatar: p.avatar,
          balance: p.balance,
          isActive: p.isActive,
          joinedAt: p.joinedAt
        })),
        currentPlayers: table.players.length,
        maxPlayers: table.maxPlayers,
        tableName: table.tableName,
        entryFee: table.entryFee
      };
    }
    
    // ✅ FIX RACE CONDITION: Use joining lock to prevent simultaneous joins
    if (!this.joiningPlayers.has(data.tableId)) {
      this.joiningPlayers.set(data.tableId, new Set<string>());
    }
    const joiningSet = this.joiningPlayers.get(data.tableId)!;
    
    // Check if this user is already in the process of joining
    if (joiningSet.has(data.userId)) {
      this.logger.warn(`⚠️ Player ${data.userEmail} is already joining table ${data.tableId} - blocking duplicate join`);
      return {
        success: false,
        message: 'You are already joining this table. Please wait...',
      };
    }
    
    // Add to joining set (lock)
    joiningSet.add(data.userId);
    this.logger.log(`🔒 Lock acquired for ${data.userEmail} joining table ${data.tableId}`);
    
    try {
      // ✅ FIX: Fetch user's platformScore from database to set initial balance
      let userBalance = 0;
      try {
        const userRecord = await this.usersRepository.findOne({ where: { id: data.userId } });
        if (userRecord && userRecord.platformScore !== null && userRecord.platformScore !== undefined) {
          userBalance = Math.round(Number(userRecord.platformScore));
          this.logger.log(`💰 Fetched platformScore for ${data.userEmail}: ${userBalance} SEKA`);
        } else {
          this.logger.warn(`⚠️ No platformScore found for ${data.userEmail}, defaulting to 0`);
        }
      } catch (error) {
        this.logger.error(`❌ Error fetching user platformScore: ${error.message}`);
      }
      
      // ✅ FIX RACE CONDITION: Double-check player doesn't exist right before adding (atomic check with lock)
      // Re-fetch table to ensure we have latest state
      const currentTable = this.activeTables.get(data.tableId);
      if (!currentTable) {
        joiningSet.delete(data.userId);
        return {
          success: false,
          message: 'Table not found'
        };
      }
      
      // ✅ NEW: Check if user has sufficient balance (2x entry fee required)
      const requiredBalance = currentTable.entryFee * 2;
      if (userBalance < requiredBalance) {
        this.logger.warn(`❌ User ${data.userEmail} has insufficient balance: ${userBalance} < ${requiredBalance} (2x entry fee)`);
        joiningSet.delete(data.userId);
        return {
          success: false,
          message: `Insufficient balance. You need at least ${requiredBalance} SEKA (2x entry fee of ${currentTable.entryFee}) to join this table. Your current balance: ${userBalance} SEKA`,
          balance: userBalance,
          requiredBalance: requiredBalance,
          entryFee: currentTable.entryFee,
        };
      }
      
      const duplicateCheck = currentTable.players.find(p => p.userId === data.userId);
      if (duplicateCheck) {
        this.logger.warn(`⚠️ Race condition detected: Player ${data.userEmail} already in table (duplicate join attempt blocked)`);
        joiningSet.delete(data.userId);
        return {
          success: false,
          message: 'You are already in this table',
          players: currentTable.players.map(p => ({
            userId: p.userId,
            email: p.email,
            username: p.username,
            avatar: p.avatar,
            balance: p.balance,
            isActive: p.isActive,
            joinedAt: p.joinedAt
          })),
          currentPlayers: currentTable.players.length,
          maxPlayers: currentTable.maxPlayers,
          tableName: currentTable.tableName,
          entryFee: currentTable.entryFee
        };
      }
      
      // Check if table is still not full (could have changed while we were fetching)
      if (currentTable.players.length >= currentTable.maxPlayers) {
        this.logger.log(`❌ Join failed: Table ${currentTable.tableName} is full (${currentTable.players.length}/${currentTable.maxPlayers})`);
        joiningSet.delete(data.userId);
        return {
          success: false,
          message: 'Table is full'
        };
      }
    
      // Add player with real user data and balance
      currentTable.players.push({
        userId: data.userId,
        email: data.userEmail,
        username: data.username || data.userEmail.split('@')[0], // Fallback to email prefix
        avatar: data.avatar || null, // ✅ Use null instead of undefined to match type definition
        balance: userBalance, // ✅ Set from platformScore
        isActive: true,
        joinedAt: new Date(),
        socketId: client.id,
      });
      
      // Update table reference for rest of function
      table = currentTable;
    } finally {
      // Release lock
      joiningSet.delete(data.userId);
      if (joiningSet.size === 0) {
        this.joiningPlayers.delete(data.tableId);
      }
      this.logger.log(`🔓 Lock released for ${data.userEmail} joining table ${data.tableId}`);
    }
    
      // ✅ CRITICAL FIX: Join the Socket.IO room to receive game events!
      const gameRoom = `table:${data.tableId}`;
      client.join(gameRoom);
      this.logger.log(`🎮 Client ${client.id} joined game room: ${gameRoom}`);
      
      // ✅ UPDATE DATABASE with new player count AND ensure player is in table_players
      (async () => {
        try {
          // Update currentPlayers count
          await this.gameTablesRepository.update(data.tableId, {
            currentPlayers: table.players.length,
          });
          this.logger.log(`💾 ✅ Database updated: Table ${data.tableId} now has ${table.players.length} players`);
          
          // ✅ FIX: Ensure player is in table_players table (for invitations)
          try {
            await this.gameTablesRepository.query(
              `INSERT INTO table_players (id, "tableId", "userId", "seatNumber", chips, "isReady", status, "joinedAt")
               VALUES (uuid_generate_v4(), $1, $2, $3, $4, $5, $6, NOW())
               ON CONFLICT ("tableId", "userId") DO UPDATE SET status = 'active', "joinedAt" = NOW()`,
              [data.tableId, data.userId, 1, 0, false, 'active'],
            );
            this.logger.log(`💾 ✅ Ensured player ${data.userId} is in table_players`);
          } catch (dbError) {
            this.logger.warn(`⚠️ Could not ensure player in table_players: ${dbError.message}`);
          }
        } catch (error) {
          this.logger.error(`❌ Failed to update table in database: ${error.message}`);
        }
      })();

    
    const isCreator = data.userId === table.creatorId;
    this.logger.log(`✅ Player ${data.userEmail} joined table ${table.tableName} (${table.players.length}/${table.maxPlayers})`);
    if (isCreator) {
      this.logger.log(`   👑 Creator joined`);
    }
    
    // 3️⃣ Single player cleanup timer management
    if (table.players.length === 1) {
      // Start 20-second cleanup timer for single-player table
      this.logger.log(`⏱️ Starting 20-second cleanup timer for single-player table ${table.tableName}`);
      table.singlePlayerSince = new Date();
      
      const cleanupTimer = setTimeout(() => {
        const currentTable = this.activeTables.get(data.tableId);
        if (currentTable && currentTable.players.length === 1) {
          this.logger.log(`🗑️ Auto-cleaning up table ${table.tableName} - only 1 player after 20 seconds`);
          
          // Notify the single player
          this.server.to(`table:${data.tableId}`).emit('table_cleanup', {
            message: 'Table closed - no other players joined',
            tableId: data.tableId,
          });
          
          // Remove from memory
          this.activeTables.delete(data.tableId);
          
          // Mark as finished in database
          this.gameTablesRepository.update(data.tableId, { 
            status: 'finished',
            currentPlayers: 0
          });
          
          // Broadcast to lobby
          this.server.to('lobby').emit('table_removed', { tableId: data.tableId });
        }
      }, 20000); // 20 seconds
      
      // Store cleanup timer (if you have a Map for it)
      if (!this.cleanupTimers) {
        this.cleanupTimers = new Map();
      }
      this.cleanupTimers.set(data.tableId, cleanupTimer);
    } else if (table.players.length === 2 && table.singlePlayerSince) {
      // CLEAR idle timeout if table had 1 player (now has 2+)
      this.logger.log(`   ⏰ Clearing cleanup timeout - table now has ${table.players.length} players`);
      table.singlePlayerSince = null;
      
      // Cancel cleanup timer
      if (this.cleanupTimers && this.cleanupTimers.has(data.tableId)) {
        clearTimeout(this.cleanupTimers.get(data.tableId));
        this.cleanupTimers.delete(data.tableId);
      }
    }
    
    // Broadcast update to lobby AND to players in the table
    this.server.to('lobby').emit('table_updated', {
      id: table.id,
      tableName: table.tableName,
      entryFee: table.entryFee,
      currentPlayers: table.players.length,
      maxPlayers: table.maxPlayers,
      status: table.status,
      timestamp: new Date(),
    });
    
    // Broadcast player list update to everyone in the table
    this.server.to(`table:${table.id}`).emit('player_list_updated', {
      tableId: table.id,
      players: table.players,
      timestamp: new Date(),
    });
    
    // AUTO-START: ONLY start countdown when EXACTLY 2 players join (not 1, not on subsequent joins)
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`🎮 AUTO-START CHECK: ${table.players.length} players, status: ${table.status}`);
    this.logger.log(`   Table ID: ${table.id}`);
    this.logger.log(`   Countdown timer exists: ${this.countdownTimers.has(table.id)}`);
    
    if (table.players.length === 2 && table.status === 'waiting') {
      // Check if countdown is already in progress for this table
      if (this.countdownTimers.has(table.id)) {
        this.logger.log(`⏱️ Countdown already in progress for table ${table.tableName}`);
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return {
          success: true,
          message: 'Joined table'
        };
      }
      
      this.logger.log(`🚀 AUTO-START: EXACTLY 2 players present - starting game with 10-second countdown!`);
      this.logger.log(`   📋 Player 1: ${table.players[0]?.email || table.players[0]?.userId}`);
      this.logger.log(`   📋 Player 2: ${table.players[1]?.email || table.players[1]?.userId}`);
      
      // Emit game_starting event to show countdown to all players
      const gameStartingPayload = {
        tableId: table.id,
        tableName: table.tableName,
        countdown: 10, // 10 seconds countdown
        message: 'Game is starting! Get ready...',
        timestamp: new Date(),
      };
      this.logger.log(`📢 Broadcasting 'game_starting' event to room: table:${table.id}`);
      this.logger.log(`   Payload:`, JSON.stringify(gameStartingPayload));
      this.server.to(`table:${table.id}`).emit('game_starting', gameStartingPayload);
      this.logger.log(`✅ 'game_starting' event broadcasted successfully`);
      
      // Start game after 10-second delay
      const timer = setTimeout(() => {
        this.logger.log(`⏰ 10-second countdown finished for table ${table.tableName} - calling autoStartGame`);
        this.autoStartGame(table.id);
        this.countdownTimers.delete(table.id); // Clean up timer reference
      }, 10000); // 10 seconds
      
      // Store timer to prevent duplicates
      this.countdownTimers.set(table.id, timer);
      this.logger.log(`✅ Countdown timer set for table ${table.id}`);
    } else if (table.players.length === 1) {
      this.logger.log(`⏳ Waiting for more players... (${table.players.length}/${table.maxPlayers})`);
    } else if (table.players.length > 2) {
      this.logger.log(`👥 ${table.players.length} players in table, countdown already started`);
    } else {
      this.logger.log(`⚠️ Auto-start conditions not met:`);
      this.logger.log(`   Players: ${table.players.length}, Status: ${table.status}`);
    }
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    // ✅ FIX: Return full player list to joining player for immediate sync
    return {
      success: true,
      message: 'Joined table',
      players: table.players.map(p => ({
        userId: p.userId,
        email: p.email,
        username: p.username,
        avatar: p.avatar,
        balance: p.balance,
        isActive: p.isActive,
        joinedAt: p.joinedAt
      })),
      currentPlayers: table.players.length,
      maxPlayers: table.maxPlayers,
      tableName: table.tableName,
      entryFee: table.entryFee
    };
  }

  /**
   * Invite a bot to join a table
   * Bots auto-join immediately and are ready to play
   */
  // ❌ REMOVED: handleInviteBotToTable - Bots are no longer used

  /**
   * AUTO-START GAME (called internally when 2+ players join)
   */
  private async autoStartGame(tableId: string) {
    const table = this.activeTables.get(tableId);
    
    if (!table) {
      this.logger.warn(`⚠️ Cannot auto-start: table ${tableId} not found`);
      return;
    }
    
    if (table.status !== 'waiting') {
      this.logger.warn(`⚠️ Cannot auto-start: table ${table.tableName} status is ${table.status}`);
      return;
    }
    
    if (table.players.length < 2) {
      this.logger.warn(`⚠️ Cannot auto-start: only ${table.players.length} player(s) in table ${table.tableName}`);
      this.logger.warn(`   📋 Players in memory:`, table.players.map(p => p.email || p.userId));
      this.logger.warn(`   💡 TIP: Second player may not have called join_table yet`);
      
      // Cancel countdown timer if it exists
      if (this.countdownTimers.has(tableId)) {
        clearTimeout(this.countdownTimers.get(tableId));
        this.countdownTimers.delete(tableId);
        this.logger.log(`⏱️ Cleared countdown timer for table ${tableId}`);
      }
      
      return;
    }
    
    // ✅ CHECK PLAYER BALANCES BEFORE STARTING
    this.logger.log(`💰 Checking player balances before auto-start (Entry fee: ${table.entryFee})...`);
    const playersWithInsufficientBalance: string[] = [];
    
    for (const player of table.players) {
      try {
        const balanceData = await this.walletService.getBalance(player.userId);
        const availableBalance = balanceData.platformScore; // Use platformScore for gameplay
        
        this.logger.log(`   Player ${player.email}: Balance ${availableBalance}, Required ${table.entryFee}`);
        
        if (availableBalance < table.entryFee) {
          this.logger.warn(`   ❌ ${player.email} has insufficient balance (${availableBalance} < ${table.entryFee})`);
          playersWithInsufficientBalance.push(player.userId);
        }
      } catch (error) {
        this.logger.error(`❌ Error checking balance for ${player.email}: ${error.message}`);
        playersWithInsufficientBalance.push(player.userId);
      }
    }
    
    // Remove players with insufficient balance
    if (playersWithInsufficientBalance.length > 0) {
      this.logger.warn(`🚫 Removing ${playersWithInsufficientBalance.length} player(s) with insufficient balance`);
      
      for (const userId of playersWithInsufficientBalance) {
        const playerIndex = table.players.findIndex(p => p.userId === userId);
        if (playerIndex !== -1) {
          const removedPlayer = table.players[playerIndex];
          table.players.splice(playerIndex, 1);
          this.logger.log(`   🚫 Removed ${removedPlayer.email} from table ${table.tableName}`);
          
          // Notify the removed player
          const playerSocketId = this.userSockets.get(userId);
          if (playerSocketId) {
            this.server.to(playerSocketId).emit('player_removed_insufficient_balance', {
              tableId: table.id,
              tableName: table.tableName,
              entryFee: table.entryFee,
              message: `You have been removed from the table due to insufficient balance. Required: ${table.entryFee}`,
              timestamp: new Date(),
            });
          }
        }
      }
      
      // Update database player count (ALL tables)
      try {
        await this.gameTablesRepository.update(table.id, {
          currentPlayers: table.players.length,
        });
        this.logger.log(`💾 ✅ Database updated: Table ${table.id} player count = ${table.players.length}`);
      } catch (error) {
        this.logger.error(`❌ Failed to update table player count: ${error.message}`);
      }
      
      // Check if we still have enough players after removal
      if (table.players.length < 2) {
        this.logger.warn(`⚠️ Not enough players remaining after balance check (${table.players.length}). Cancelling auto-start.`);
        table.status = 'waiting';
        
        // Notify remaining players
        this.server.to(`table:${table.id}`).emit('table_updated', {
          id: table.id,
          tableName: table.tableName,
          entryFee: table.entryFee,
          currentPlayers: table.players.length,
          maxPlayers: table.maxPlayers,
          status: table.status,
          message: 'Game cancelled - not enough players with sufficient balance',
          timestamp: new Date(),
        });
        
        return;
      }
      
      this.logger.log(`✅ ${table.players.length} players remaining with sufficient balance - proceeding with game start`);
    }
    
    try {
      this.logger.log(`🎮 AUTO-STARTING game for table: ${table.tableName} with ${table.players.length} players`);
      table.status = 'in_progress';
      
      // ✅ UPDATE DATABASE status to 'playing' (ALL tables)
      try {
        await this.gameTablesRepository.update(table.id, {
          status: 'playing',
        });
        this.logger.log(`💾 ✅ Database updated: Table ${table.id} status changed to 'playing'`);
      } catch (error) {
        this.logger.error(`❌ Failed to update table status in database: ${error.message}`);
      }
      
      // Create game in database and initialize with game engine
      const playerIds = table.players.map(p => p.userId);
      const game = await this.gameService.createGame(
        table.id,
        playerIds,
        table.entryFee,
        6 // Always 6-player tables
      );
      
      // Set dealer: if this is the first game, dealer is the creator
      // Otherwise, dealer is the previous winner (stored in table.lastWinnerId)
      if (!table.lastWinnerId) {
        game.dealerId = table.creatorId;
        this.logger.log(`👑 First game - dealer is creator: ${table.creatorId}`);
      } else {
        game.dealerId = table.lastWinnerId;
        this.logger.log(`👑 Next game - dealer is previous winner: ${table.lastWinnerId}`);
      }
      
      // Initialize game with blind system (but don't deal cards yet)
      await this.gameEngine.initializeGame(game, table.entryFee);
      
      // Store game ID in table
      table.gameId = game.id;
      
      this.logger.log(`✅ Game ${game.id} initialized with blind system - starting in 5 seconds`);
      
      // Start the game with delay and blind posting
      await this.gameStateService.startGameAfterDelay(game);
      
      this.logger.log(`🎮 Game ${game.id} started with blinds posted and cards dealt`);
      
      // Get full game state with dealt cards
      const gameState = await this.gameEngine.getGameState(game);
      
      this.logger.log(`🃏 Cards dealt. Current player: ${gameState.currentPlayerId}`);
      
      // Broadcast game started event with full state
      this.server.to(`table:${table.id}`).emit('game_started', {
        tableId: table.id,
        tableName: table.tableName,
        gameId: game.id,
        gameState: gameState,
        autoStarted: true,
      timestamp: new Date(),
    });
      
      this.logger.log(`✅ AUTO-START complete for table ${table.tableName}`);
      
    } catch (error) {
      this.logger.error(`❌ Error auto-starting game: ${error.message}`, error.stack);
      table.status = 'waiting'; // Revert status on error
      
      // ✅ FIX: Notify players that game failed to start
      this.server.to(`table:${table.id}`).emit('game_start_failed', {
        tableId: table.id,
        tableName: table.tableName,
        message: 'Failed to start game. Please try again or contact support.',
        error: error.message,
        timestamp: new Date(),
      });
      
      // Update table status in database
      try {
        await this.gameTablesRepository.update(table.id, {
          status: 'waiting',
        });
        this.logger.log(`💾 ✅ Database updated: Table ${table.id} status reverted to 'waiting'`);
      } catch (dbError) {
        this.logger.error(`❌ Failed to revert table status in database: ${dbError.message}`);
      }
      
      // Broadcast table update to lobby
      this.server.to('lobby').emit('table_updated', {
        id: table.id,
        tableName: table.tableName,
        entryFee: table.entryFee,
        currentPlayers: table.players.length,
        maxPlayers: table.maxPlayers,
        status: 'waiting',
        timestamp: new Date(),
      });
    }
  }

  /**
   * Leave table (IN-MEMORY) - Only delete when COMPLETELY empty (0 players)
   */
  @SubscribeMessage('leave_table')
  async handleLeaveTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      tableId: string;
      userId: string;
    },
  ) {
    const table = this.activeTables.get(data.tableId);
    
    if (!table) {
      this.logger.log(`❌ Leave failed: Table ${data.tableId} not found`);
      return {
        success: false,
        message: 'Table not found'
      };
    }
    
    // Check if game has started
    if (table.status === 'in_progress') {
      this.logger.log(`❌ Cannot leave: Game is in progress for table ${table.tableName}`);
      return {
        success: false,
        message: 'Cannot leave while game is in progress'
      };
    }
    
    const playersBefore = table.players.length;
    
    // Remove player
    table.players = table.players.filter(p => p.userId !== data.userId);
    
    const playersAfter = table.players.length;
    
    if (playersBefore === playersAfter) {
      this.logger.log(`⚠️ Player ${data.userId} was not in table ${table.tableName}`);
      return {
        success: false,
        message: 'Player not in table'
      };
    }
    
    this.logger.log(`👋 Player ${data.userId} left table ${table.tableName} (${playersAfter}/${table.maxPlayers} remaining)`);
    
    // ✅ FIX: Remove from memory when empty, but KEEP in database for server restart recovery
    if (table.players.length === 0) {
      this.logger.log(`🗑️ Table ${table.tableName} is now empty - removing from memory (preserving in database)`);
      
      // Delete from memory only (not from database)
      this.activeTables.delete(data.tableId);
      this.logger.log(`🗑️ Table ${table.tableName} removed from memory (no players)`);
      
      // ✅ PRESERVE IN DATABASE: Update table status instead of deleting
      // This allows tables to be reloaded on server restart
      try {
        await this.gameTablesRepository.update(data.tableId, {
          currentPlayers: 0,
          status: 'waiting', // Keep as waiting status
          updatedAt: new Date(),
        });
        this.logger.log(`💾 ✅ Preserved table ${data.tableId} in database (empty but available for restart recovery)`);
      } catch (error) {
        this.logger.error(`❌ Failed to update table in database: ${error.message}`);
      }
      
      // Broadcast table removal from lobby (since it's not active anymore)
      this.server.to('lobby').emit('table_removed', {
        id: table.id,
        reason: 'all_players_left',
        timestamp: new Date(),
      });
      this.logger.log(`📢 Broadcasted table_removed to lobby for empty table ${table.tableName}`);
      
      return {
        success: true,
        message: 'Left table - table removed from active lobby (preserved for restart)'
      };
    }
    
    // Table persists with remaining players
    this.logger.log(`✅ Table ${table.tableName} persists with ${table.players.length} player(s) - can rejoin`);
    
    // START idle timeout if table now has exactly 1 player
    if (table.players.length === 1) {
      table.singlePlayerSince = new Date();
      this.logger.log(`   ⏰ Started 1-minute idle timeout - table now has only 1 player`);
    }
    
    // ✅ UPDATE DATABASE with reduced player count (ALL tables)
    try {
      await this.gameTablesRepository.update(data.tableId, {
        currentPlayers: table.players.length,
      });
      this.logger.log(`💾 ✅ Database updated: Table ${data.tableId} now has ${table.players.length} players`);
    } catch (error) {
      this.logger.error(`❌ Failed to update table in database: ${error.message}`);
    }
    
    // Broadcast table update
    this.server.to('lobby').emit('table_updated', {
      id: table.id,
      tableName: table.tableName,
      entryFee: table.entryFee,
      currentPlayers: table.players.length,
      maxPlayers: table.maxPlayers,
      status: table.status,
      timestamp: new Date(),
    });
    
    return {
      success: true,
      message: `Left table - ${table.players.length} player(s) remaining`
    };
  }

  // ==================== GAME LOGIC HANDLERS ====================

  /**
   * ❌ REMOVED: handleSeeCards was a duplicate of handlePlayerViewCards
   * 
   * This handler listened to 'see_cards' event but performed the exact same
   * function as handlePlayerViewCards (listens to 'player_view_cards').
   * 
   * To reduce code duplication, we now only use handlePlayerViewCards.
   * Frontend should emit 'player_view_cards' event.
   */

  /**
   * Start game - DEPRECATED: Now uses auto-start when 2+ players join
   * Keeping for backward compatibility but will just call autoStartGame
   */
  @SubscribeMessage('start_game')
  async handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string },
  ) {
    // Games now auto-start when 2+ players join
    // This handler is kept for backward compatibility
    this.logger.log(`⚠️ Manual start_game called for table ${data.tableId} - auto-start is now enabled`);
    
    const table = this.activeTables.get(data.tableId);
    if (!table) {
      return { success: false, message: 'Table not found' };
    }
    
    if (table.status !== 'waiting') {
      return { success: false, message: 'Game already in progress' };
    }
    
    if (table.players.length < 2) {
      return { success: false, message: 'Need at least 2 players to start' };
    }
    
    // Trigger auto-start immediately
    await this.autoStartGame(data.tableId);
    
    return { success: true, message: 'Game started (auto-start)', gameId: table.gameId };
  }

  // ==================== SERVER-SIDE BROADCAST METHODS ====================

  /**
   * Notify a specific player it's their turn
   */
  private async notifyPlayerTurn(gameId: string, userId: string) {
    const socketId = this.userSockets.get(userId);
    
    if (socketId) {
      const game = await this.gameService.findOne(gameId);
      const availableActions = this.gameEngine.getAvailableActions(game, userId);
      
      // ❌ REMOVED: Bot auto-play code - Bots are no longer used
      
      // Send turn notification
      this.server.to(socketId).emit('your_turn', {
        gameId,
        userId,
        availableActions,
        currentBet: game.state.currentBet,
        pot: game.state.pot,
        timeLimit: 30, // TODO: Make configurable
      timestamp: new Date(),
    });
      
      this.logger.log(`📢 Notified ${userId} it's their turn in game ${gameId}`);
    }
  }

  /**
   * Helper method to find a user's socket by userId
   */
  private async findUserSocket(userId: string): Promise<any> {
    const socketId = this.userSockets.get(userId);
    if (socketId) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket && socket.connected) {
        return socket;
      }
    }
    return null;
  }

  /**
   * Broadcast showdown results
   */
  private async broadcastShowdown(tableId: string, gameId: string) {
    try {
      const game = await this.gameService.findOne(gameId);
      const gameState = await this.gameEngine.getGameState(game);
      
      this.logger.log(`🏆 Showdown - Phase: ${gameState.phase}, Winners: ${gameState.winners.join(', ')}`);
      
      // ✅ Use finalPot (saved before distribution) to show correct pot amount
      const potAmount = gameState.finalPot || gameState.pot || 0;
      this.logger.log(`💰 Showdown Pot - finalPot: ${gameState.finalPot}, current pot: ${gameState.pot}, using: ${potAmount}`);
      
      // Prepare showdown data with all hands revealed
      const showdownData = {
        tableId,
        gameId,
        phase: gameState.phase,
        players: gameState.players.map(p => ({
          userId: p.userId,
          email: this.userData.get(p.userId)?.email || p.userId,
          hand: p.hand, // Now visible
          handScore: p.handScore, // ✅ Include score for dynamic display
          handDescription: p.handDescription, // ✅ Include description
          evaluatedHand: (p as any).evaluatedHand, // Legacy field
          totalBet: p.totalBet,
          balance: p.balance,
          isWinner: p.isWinner,
          winnings: p.winnings || 0,
          hasSeenCards: true, // All cards seen in showdown
        })),
        winners: gameState.winners,
        pot: potAmount, // ✅ Use saved final pot amount
        timestamp: new Date(),
      };
      
      // Broadcast to all players in the table
      this.server.to(`table:${tableId}`).emit('showdown', showdownData);
      
      this.logger.log(`✅ Broadcasted showdown to table ${tableId}`);
      this.logger.log(`   Winners: ${gameState.winners.join(', ')}`);
      this.logger.log(`   Pot: ${gameState.pot}`);
      
      // ✅ FIX: Update in-memory player balances immediately when winnings are distributed
      // This ensures checkAndRemoveInsufficientPlayers uses correct balances
      const table = this.activeTables.get(tableId);
      if (table) {
        const updatedBalances = (gameState as any).updatedBalances;
        if (updatedBalances && Array.isArray(updatedBalances)) {
          this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          this.logger.log(`💰 UPDATING IN-MEMORY BALANCES FROM WINNINGS`);
          this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          
          for (const balanceUpdate of updatedBalances) {
            const { userId, balance } = balanceUpdate;
            this.logger.log(`   → User ${userId}: ${balance} SEKA`);
            
            // Update in-memory balance for this player
            const player = table.players.find(p => p.userId === userId);
            if (player) {
              const oldBalance = player.balance || 0;
              player.balance = balance;
              this.logger.log(`   ✅ Updated in-memory balance for ${userId}: ${oldBalance} → ${balance}`);
            } else {
              this.logger.warn(`   ⚠️ Player ${userId} not found in table ${tableId} - cannot update balance`);
            }
            
            // Emit to specific user's socket
            const userSocket = await this.findUserSocket(userId);
            if (userSocket) {
              userSocket.emit('balance_updated', {
                userId,
                platformScore: balance,
                reason: 'game_win',
                timestamp: new Date()
              });
              this.logger.log(`   ✅ Sent balance update to ${userId}`);
            } else {
              this.logger.warn(`   ⚠️ Socket not found for user ${userId}`);
            }
          }
          
          this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        }
      }
      
      // If game completed, send completion event
      if (gameState.status === 'completed') {
        this.broadcastGameCompleted(tableId, gameState);
      }
      
    } catch (error) {
      this.logger.error(`❌ Error broadcasting showdown: ${error.message}`, error.stack);
    }
  }

  /**
   * Broadcast game completion and handle post-game cleanup
   */
  private async broadcastGameCompleted(tableId: string, gameState: any) {
    const platformFee = gameState.pot * 0.05; // 5% platform fee
    const totalWinnings = gameState.pot - platformFee;
    
    const completionData = {
      tableId,
      gameId: gameState.id,
      status: 'completed',
      winners: gameState.winners,
      finalPot: gameState.pot,
      platformFee,
      totalWinnings,
      winnings: gameState.players
        .filter(p => p.isWinner)
        .reduce((acc, p) => {
          acc[p.userId] = p.winnings;
          return acc;
        }, {}),
      finishedAt: gameState.finishedAt,
      timestamp: new Date(),
    };
    
    this.server.to(`table:${tableId}`).emit('game_completed', completionData);
    
    this.logger.log(`✅ Broadcasted game completion for table ${tableId}`);
    
    // Update lastWinnerId for dealer rotation
    const table = this.activeTables.get(tableId);
    if (table && gameState.winners && gameState.winners.length > 0) {
      table.lastWinnerId = gameState.winners[0]; // First winner becomes dealer
      this.logger.log(`👑 Next dealer will be: ${table.lastWinnerId}`);
    }
    
    // ✅ FIX: Wait a brief moment to ensure database writes are committed
    // Then refresh balances from database before checking
    await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
    
    // Refresh all player balances from database to ensure we have latest values
    const tableForCheck = this.activeTables.get(tableId);
    if (tableForCheck) {
      this.logger.log(`💰 Refreshing player balances from database before checking...`);
      for (const player of tableForCheck.players) {
        try {
          const balanceData = await this.walletService.getBalance(player.userId);
          const platformScore = balanceData.platformScore || 0;
          const oldBalance = player.balance || 0;
          player.balance = platformScore;
          this.logger.log(`   Player ${player.email}: ${oldBalance} → ${platformScore} SEKA`);
        } catch (error) {
          this.logger.error(`Error refreshing balance for ${player.userId}: ${error.message}`);
        }
      }
    }
    
    // Auto-remove players with insufficient balance after game ends
    await this.checkAndRemoveInsufficientPlayers(tableId);
  }
  
  /**
   * Check player balances and remove those who can't afford entry fee
   * ✅ FIX: Uses platformScore for gameplay balance (not wallet availableBalance)
   */
  private async checkAndRemoveInsufficientPlayers(tableId: string) {
    const table = this.activeTables.get(tableId);
    if (!table) return;
    
    this.logger.log(`💰 Checking player balances for table ${table.tableName} (Entry fee: ${table.entryFee})`);
    
    const removedPlayers: string[] = [];
    
    // Check each player's balance
    for (const player of table.players) {
      try {
        const balanceData = await this.walletService.getBalance(player.userId);
        // ✅ FIX: Use platformScore for gameplay, not availableBalance (wallet balance)
        const platformScore = balanceData.platformScore || 0;
        
        // ✅ FIX: Also update in-memory balance to keep it in sync
        player.balance = platformScore;
        
        this.logger.log(`   Player ${player.email}: platformScore=${platformScore}, Entry fee=${table.entryFee}`);
        
        if (platformScore < table.entryFee) {
          this.logger.log(`   ❌ ${player.email}: Balance ${platformScore} < Entry fee ${table.entryFee} - REMOVING`);
          removedPlayers.push(player.userId);
          
          // Notify the player they were removed
          this.server.to(`table:${tableId}`).emit('player_removed_insufficient_balance', {
            tableId,
            userId: player.userId,
            balance: platformScore,
            entryFee: table.entryFee,
            message: `You have been removed from the table. Your balance (${platformScore}) is less than the entry fee (${table.entryFee}).`,
            timestamp: new Date(),
          });
        } else {
          this.logger.log(`   ✅ ${player.email}: Balance ${platformScore} ≥ Entry fee ${table.entryFee} - OK`);
        }
      } catch (error) {
        this.logger.error(`Error checking balance for ${player.userId}: ${error.message}`);
      }
    }
    
    // Remove players with insufficient balance
    if (removedPlayers.length > 0) {
      table.players = table.players.filter(p => !removedPlayers.includes(p.userId));
      this.logger.log(`🗑️ Removed ${removedPlayers.length} player(s) with insufficient balance`);
      this.logger.log(`   Remaining players: ${table.players.length}/${table.maxPlayers}`);
      
      // Reset table status to waiting if there are remaining players
      if (table.players.length > 0) {
        table.status = 'waiting';
        table.gameId = null;
        
        // No need to reset ready status - removed ready system
        
        this.logger.log(`🔄 Table ${table.tableName} reset to waiting status`);
        
        // Broadcast updated player list
        this.server.to(`table:${tableId}`).emit('player_list_updated', {
          tableId: table.id,
          players: table.players,
          timestamp: new Date(),
        });
        
        // Broadcast table update to lobby
        this.server.to('lobby').emit('table_updated', {
          id: table.id,
          tableName: table.tableName,
          entryFee: table.entryFee,
          currentPlayers: table.players.length,
          maxPlayers: table.maxPlayers,
          status: table.status,
          timestamp: new Date(),
        });
      } else {
        // No players left - remove from memory but preserve in database
        this.activeTables.delete(tableId);
        this.logger.log(`🗑️ Table ${table.tableName} removed from memory - no players with sufficient balance`);
        
        // ✅ PRESERVE IN DATABASE: Update status instead of deleting
        try {
          await this.gameTablesRepository.update(tableId, {
            currentPlayers: 0,
            status: 'waiting',
            updatedAt: new Date(),
          });
          this.logger.log(`💾 ✅ Preserved table ${tableId} in database (available for restart recovery)`);
        } catch (error) {
          this.logger.error(`❌ Failed to update table in database: ${error.message}`);
        }
        
        this.server.to('lobby').emit('table_removed', {
          id: table.id,
          timestamp: new Date(),
        });
      }
    } else {
      // All players have sufficient balance - reset table for next game
      if (table.players.length > 0) {
        table.status = 'waiting';
        table.gameId = null;
        
        this.logger.log(`✅ All players have sufficient balance - table ready for next game`);
        
        // Broadcast table reset
        this.server.to(`table:${tableId}`).emit('table_reset_for_new_game', {
          tableId: table.id,
          players: table.players,
          message: 'Ready for next game!',
          timestamp: new Date(),
        });
        
        // Update lobby
        this.server.to('lobby').emit('table_updated', {
          id: table.id,
          tableName: table.tableName,
          entryFee: table.entryFee,
          currentPlayers: table.players.length,
          maxPlayers: table.maxPlayers,
          status: table.status,
          timestamp: new Date(),
        });
        
        // CONTINUOUS CYCLING: Auto-start next game if 2+ players remain
        if (table.players.length >= 2) {
          this.logger.log(`🔄 CONTINUOUS CYCLING: ${table.players.length} players remain - auto-starting next game NOW (already had 10s countdown)...`);
          // ✅ FIX: Start immediately - we already had a 10-second countdown from modal close
          // No need for another delay
          const currentTable = this.activeTables.get(table.id);
          if (currentTable && currentTable.players.length >= 2) {
            this.logger.log(`🎮 AUTO-STARTING next game for table ${currentTable.tableName}...`);
            this.autoStartGame(table.id);
          } else {
            this.logger.log(`⏸️ Auto-start cancelled - not enough players (${currentTable?.players.length || 0})`);
          }
        } else {
          this.logger.log(`⏸️ Only ${table.players.length} player remaining - waiting for more players to join`);
        }
      }
    }
  }

  /**
   * Auto-terminate a game due to server crash or timeout
   */
  private async autoTerminateGame(tableId: string, reason: string) {
    const table = this.activeTables.get(tableId);
    if (!table || !table.gameId) return;
    
    try {
      // Mark game as cancelled in database
      const game = await this.gameService.findOne(table.gameId);
      if (game) {
        game.status = GameStatus.CANCELLED;
        game.finishedAt = new Date();
        await this.gameService.saveGame(game);
      }
      
      // Broadcast termination to all players
      this.server.to(`table:${tableId}`).emit('game_terminated', {
        reason,
        message: 'Game terminated due to server issues. Please rejoin.',
        timestamp: new Date().toISOString()
      });
      
      this.logger.log(`💀 Game ${table.gameId} terminated: ${reason}`);
      
      // Reset table status
      table.status = 'waiting';
      table.gameId = null;
      table.lastHeartbeat = new Date();
      
    } catch (error) {
      this.logger.error(`❌ Error terminating game: ${error.message}`);
    }
  }

  /**
   * Broadcast game start (called from game service)
   */
  broadcastGameStart(gameId: string, gameData: any) {
    this.server.to(`game:${gameId}`).emit('game_started', {
      gameId,
      ...gameData,
      timestamp: new Date(),
    });
    
    this.logger.log(`Broadcasted game start for ${gameId}`);
  }

  /**
   * Broadcast turn change (called from game service)
   */
  async broadcastTurnChange(gameId: string, nextPlayerId: string) {
    this.server.to(`game:${gameId}`).emit('turn_changed', {
      gameId,
      nextPlayerId,
      timestamp: new Date(),
    });
    
    // Notify the specific player
    await this.notifyPlayerTurn(gameId, nextPlayerId);
    
    this.logger.log(`Broadcasted turn change to ${nextPlayerId} in game ${gameId}`);
  }

  /**
   * Broadcast game state update (called from game service)
   * 🔒 SECURE: Sends sanitized state to each player
   */
  async broadcastGameStateUpdate(gameId: string) {
    try {
      const game = await this.gameService.findOne(gameId);
      const tableId = game.tableId;
      
      // 🔒 SECURE: Broadcast sanitized game state to each player
      await this.broadcastSanitizedGameState(game, tableId);
      
      this.logger.log(`Broadcasted sanitized state update for game ${gameId}`);
    } catch (error) {
      this.logger.error(`Error broadcasting game state: ${error.message}`);
    }
  }

  /**
   * Broadcast error to specific game
   */
  broadcastGameError(gameId: string, error: string) {
    this.server.to(`game:${gameId}`).emit('game_error', {
      gameId,
      error,
      timestamp: new Date(),
    });
  }

  /**
   * Get connected player count for a game
   */
  getConnectedPlayerCount(gameId: string): number {
    return this.gameRooms.get(gameId)?.size || 0;
  }

  /**
   * Check if user is connected
   */
  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * 🔒 SECURE: Broadcast sanitized game state to each player individually
   * Each player only receives card data they're allowed to see
   */
  private async broadcastSanitizedGameState(game: any, tableId: string) {
    try {
      // Get all players in the game
      const playerUserIds = game.players.map(p => p.userId);
      
      // For each player, send their personalized game state
      for (const userId of playerUserIds) {
        const socketId = this.userSockets.get(userId);
        if (socketId) {
          // Get sanitized game state for this specific user
          const sanitizedState = await this.gameStateService.getSanitizedGameStateForUser(game, userId);
          
          // Send personalized state to this user only
          this.server.to(socketId).emit('game_state_updated', sanitizedState);
          
          this.logger.log(`🔒 Sent sanitized game state to ${userId} (has cards: ${game.players.find(p => p.userId === userId)?.hasSeenCards})`);
        }
      }
    } catch (error) {
      this.logger.error(`❌ Error broadcasting sanitized game state: ${error.message}`);
    }
  }

  /**
   * Broadcast new game created to lobby (for game discovery)
   */
  async broadcastGameCreated(gameId: string) {
    try {
      const game = await this.gameService.findOne(gameId);
      
      const lobbySize = this.server.sockets.adapter.rooms.get('lobby')?.size || 0;
      const lobbyClients = Array.from(this.server.sockets.adapter.rooms.get('lobby') || []);
      
      this.logger.log(`🔔 Broadcasting game ${gameId}:`);
      this.logger.log(`   Status: ${game.status}`);
      this.logger.log(`   Players: ${game.players.length}`);
      this.logger.log(`   Lobby size: ${lobbySize}`);
      this.logger.log(`   Lobby clients: ${lobbyClients.join(', ')}`);
      
      // Only broadcast if game is pending (waiting for players)
      if (game.status === 'pending') {
        const gameData = {
          id: game.id,
          tableId: game.tableId,
          status: game.status,
          pot: game.pot,
          players: game.players.map(p => ({
            userId: p.userId,
            position: p.position,
            status: p.status,
          })),
          state: game.state,
          createdAt: game.createdAt,
        };
        
        this.logger.log(`📤 EMITTING 'game_created' to lobby with data:`, JSON.stringify(gameData, null, 2));
        this.server.to('lobby').emit('game_created', gameData);
        
        this.logger.log(`✅ Broadcasted game_created event for ${gameId} to ${lobbySize} clients in lobby`);
      } else {
        this.logger.warn(`⚠️  Game ${gameId} status is '${game.status}', not broadcasting to lobby`);
      }
    } catch (error) {
      this.logger.error(`❌ Error broadcasting game created: ${error.message}`);
    }
  }

  /**
   * Broadcast game updated to lobby (player joined, game started, etc.)
   */
  async broadcastGameUpdated(gameId: string) {
    try {
      const game = await this.gameService.findOne(gameId);
      
      this.server.to('lobby').emit('game_updated', {
        id: game.id,
        tableId: game.tableId,
        status: game.status,
        pot: game.pot,
        players: game.players.map(p => ({
          userId: p.userId,
          position: p.position,
          status: p.status,
        })),
        state: game.state,
      });
      
      this.logger.log(`Broadcasted game update ${gameId} to lobby`);
    } catch (error) {
      this.logger.error(`Error broadcasting game updated: ${error.message}`);
    }
  }
}
