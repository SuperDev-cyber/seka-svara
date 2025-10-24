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
import { GameService } from '../../game/game.service';
import { GameEngine } from '../../game/services/game-engine.service';
import { GameStateService } from '../../game/services/game-state.service';
import { WalletService } from '../../wallet/wallet.service';
import { EmailService } from '../../email/email.service';
import { GameStatus } from '../../game/types/game-state.types';

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

  // IN-MEMORY TABLE STORE (ephemeral - lost on restart)
  private activeTables = new Map<string, {
    id: string;
    tableName: string;
    entryFee: number;
    maxPlayers: number;
    players: Array<{ userId: string; email: string; username?: string; avatar?: string }>;
    status: 'waiting' | 'in_progress' | 'finished';
    creatorId: string;
    createdAt: Date;
    singlePlayerSince: Date | null; // Track when table became single-player for auto-delete
    gameId: string | null; // Database game ID when game starts
    lastWinnerId: string | null; // Previous winner (becomes dealer for next game)
    lastHeartbeat: Date; // For auto-termination when server dies
  }>();

  // Timer for periodic cleanup of idle single-player tables
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly gameService: GameService,
    private readonly gameEngine: GameEngine,
    private readonly gameStateService: GameStateService,
    private readonly walletService: WalletService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Start periodic cleanup of idle single-player tables
   * Runs every 2 minutes, deletes tables with 1 player idle for 10+ minutes
   */
  private startIdleTableCleanup() {
    if (this.cleanupInterval) return; // Already running

    this.logger.log('🧹 Starting idle single-player table cleanup (checks every 2 minutes)');
    
    this.cleanupInterval = setInterval(() => {
      const now = new Date().getTime();
      const TEN_MINUTES = 10 * 60 * 1000; // 10 minutes in milliseconds
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
        
        // Only check tables with exactly 1 player
        if (table.players.length === 1 && table.singlePlayerSince) {
          const idleTime = now - table.singlePlayerSince.getTime();
          
          if (idleTime >= TEN_MINUTES) {
            this.logger.log(`⏱️ Table "${table.tableName}" has been idle with 1 player for ${Math.round(idleTime / 60000)} minutes`);
            tablesToDelete.push(tableId);
          }
        }
      }

      // Delete idle tables
      for (const tableId of tablesToDelete) {
        const table = this.activeTables.get(tableId);
        if (table) {
          this.activeTables.delete(tableId);
          this.logger.log(`🗑️ Auto-deleted idle single-player table: ${table.tableName} (ID: ${table.id})`);
          
          // Notify lobby
          this.server.to('lobby').emit('table_removed', {
            id: table.id,
            reason: 'idle_timeout',
            timestamp: new Date(),
          });

          // Notify the remaining player if they're connected
          const player = table.players[0];
          if (player) {
            const socketId = this.userSockets.get(player.userId);
            if (socketId) {
              this.server.to(socketId).emit('table_closed', {
                tableId: table.id,
                tableName: table.tableName,
                reason: 'No other players joined within 10 minutes',
                timestamp: new Date(),
              });
            }
          }
        }
      }

      if (tablesToDelete.length > 0) {
        this.logger.log(`✅ Cleaned up ${tablesToDelete.length} idle single-player table(s)`);
      }
    }, 2 * 60 * 1000); // Check every 2 minutes
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
      
      // DON'T auto-remove from tables on disconnect
      // This prevents issues when players navigate between pages (causes brief disconnect)
      // Players are only removed via explicit 'leave_table' or by 10-minute idle cleanup
      
      // Just log which tables the user is still in
      for (const [tableId, table] of this.activeTables.entries()) {
        if (table.players.some(p => p.userId === userId)) {
          this.logger.log(`   📋 User ${userId} still in table: ${table.tableName} (${table.players.length}/${table.maxPlayers} players, status: ${table.status})`);
          this.logger.log(`   ℹ️ Player will remain in table (use 'leave_table' to remove or wait for 10-min idle timeout)`);
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
      
      // Send current game state to joining player
      const gameState = this.gameEngine.getGameState(game);
      client.emit('game_state_updated', gameState);
      
      return {
        success: true,
        gameState,
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
      
      // Broadcast action to all players in table
      this.server.to(`table:${tableId}`).emit('player_action_broadcast', {
        tableId,
        gameId,
        userId,
        action,
        amount,
        timestamp: new Date(),
      });
      
      // Broadcast updated game state
      this.server.to(`table:${tableId}`).emit('game_state_updated', gameState);
      
      // Check if game reached showdown
      if (gameState.phase === 'showdown' || gameState.phase === 'completed') {
        this.logger.log(`🏆 Game reached showdown phase. Broadcasting results...`);
        await this.broadcastShowdown(tableId, gameId);
        
        // Mark table as finished
        if (gameState.phase === 'completed') {
          table.status = 'finished';
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
      const gameState = await this.gameService.getGameState(data.gameId);
      
      client.emit('game_state_updated', gameState);
      
      return {
        success: true,
        gameState,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
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
  handleCreateTable(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      tableName: string;
      entryFee: number;
      maxPlayers?: number; // Optional, will be forced to 6
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
    
    // Automatically add creator to the table
    const creatorPlayer = {
      userId: data.creatorId,
      email: data.creatorEmail,
      username: data.creatorUsername || data.creatorEmail?.split('@')[0] || 'Player',
      avatar: data.creatorAvatar,
      balance: 1000, // Will be updated when game starts
      isActive: true,
      joinedAt: new Date(),
      socketId: client.id,
    };
    
    // Create table in memory with creator already joined
    const newTable = {
      id: tableId,
      tableName: data.tableName,
      entryFee: data.entryFee,
      maxPlayers: maxPlayers, // Always 6
      players: [creatorPlayer], // Creator automatically joins
      status: 'waiting' as const,
      creatorId: data.creatorId,
      createdAt: new Date(),
      singlePlayerSince: null, // Track for 10-minute idle timeout
      gameId: null as string | null, // Database game ID when game starts
      lastWinnerId: null as string | null, // Previous winner (becomes dealer)
      lastHeartbeat: new Date() // For auto-termination when server dies
    };
    
    this.activeTables.set(tableId, newTable);
    
    // Map user to socket for game events
    this.userSockets.set(data.creatorId, client.id);
    
    // Join the creator to the table room
    const gameRoom = `table:${tableId}`;
    client.join(gameRoom);
    
    this.logger.log(`✅ Table stored in memory: ${data.tableName} (${tableId}) - 6 players max`);
    this.logger.log(`   Creator ${data.creatorEmail} automatically joined the table`);
    this.logger.log(`   Total tables in memory: ${this.activeTables.size}`);
    this.logger.log(`   Online users in lobby: ${this.onlineUsers.size}`);
    
    // Get all clients in lobby room
    const lobbyRoom = this.server.sockets.adapter.rooms.get('lobby');
    this.logger.log(`   Clients in 'lobby' room: ${lobbyRoom ? lobbyRoom.size : 0}`);
    
    // Log all socket IDs in lobby
    if (lobbyRoom) {
      const lobbySocketIds = Array.from(lobbyRoom);
      this.logger.log(`   Lobby Socket IDs: ${lobbySocketIds.join(', ')}`);
    }
    
    // Create table broadcast payload
    const tableCreatedPayload = {
      id: tableId,
      tableName: data.tableName,
      entryFee: data.entryFee,
      currentPlayers: 1, // Creator is already in
      maxPlayers: maxPlayers, // Always 6
      status: 'waiting',
      creatorId: data.creatorId,
      creatorEmail: data.creatorEmail,
      timestamp: new Date(),
    };
    
    // Broadcast to ALL users in lobby (including creator)
    this.server.to('lobby').emit('table_created', tableCreatedPayload);
    
    this.logger.log(`📡 Broadcasted 'table_created' to lobby room (${lobbyRoom ? lobbyRoom.size : 0} clients)`);
    this.logger.log(`   Table data: ${JSON.stringify({ id: tableId, name: data.tableName, entryFee: data.entryFee, players: 1 })}`);
    
    // Also broadcast to all connected sockets (as backup)
    this.server.emit('table_created', tableCreatedPayload);
    this.logger.log(`📡 Also broadcasted to ALL connected sockets`);
    
    // Emit to creator directly to ensure they get it
    client.emit('table_created', tableCreatedPayload);
    
    return {
      success: true,
      tableId: tableId,
      message: 'Table created in memory',
    };
  }

  /**
   * Get all active tables (IN-MEMORY)
   * Also cleans up stale empty tables
   */
  @SubscribeMessage('get_active_tables')
  handleGetActiveTables(@ConnectedSocket() client: Socket) {
    this.logger.log(`📋 GET_ACTIVE_TABLES request from client ${client.id}`);
    this.logger.log(`   Total tables in memory: ${this.activeTables.size}`);
    
    // Debug: Log all table IDs
    if (this.activeTables.size > 0) {
      const tableIds = Array.from(this.activeTables.keys());
      this.logger.log(`   📝 Table IDs: ${JSON.stringify(tableIds)}`);
      Array.from(this.activeTables.values()).forEach(t => {
        this.logger.log(`   🎮 Table: ${t.tableName} | Status: ${t.status} | Players: ${t.players.length}`);
      });
    } else {
      this.logger.log(`   ⚠️ activeTables Map is EMPTY!`);
    }
    
    // Clean up empty tables older than 2 minutes
    const now = new Date().getTime();
    const staleTableIds: string[] = [];
    
    for (const [tableId, table] of this.activeTables.entries()) {
      const ageMinutes = (now - table.createdAt.getTime()) / 1000 / 60;
      
      if (table.players.length === 0 && ageMinutes > 2) {
        staleTableIds.push(tableId);
        this.logger.log(`   🗑️ Removing stale empty table: ${table.tableName} (age: ${ageMinutes.toFixed(1)} min)`);
      }
    }
    
    // Delete stale tables
    for (const tableId of staleTableIds) {
      this.activeTables.delete(tableId);
      
      // Broadcast removal
      this.server.to('lobby').emit('table_removed', {
        id: tableId,
        timestamp: new Date(),
      });
    }
    
    const tables = Array.from(this.activeTables.values()).map(table => ({
      id: table.id,
      tableName: table.tableName,
      entryFee: table.entryFee,
      currentPlayers: table.players.length,
      maxPlayers: table.maxPlayers,
      status: table.status,
      creatorId: table.creatorId,
    }));
    
    this.logger.log(`   Returning ${tables.length} tables to client`);
    if (tables.length > 0) {
      this.logger.log(`   Tables: ${JSON.stringify(tables.map(t => ({ id: t.id, name: t.tableName })))}`);
    }
    
    return {
      success: true,
      tables: tables,
    };
  }

  /**
   * Get specific table details (IN-MEMORY)
   */
  @SubscribeMessage('get_table_details')
  handleGetTableDetails(
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
        players: table.players.map((p, index) => ({
          userId: p.userId,
          email: p.email,
          position: index,
          balance: 1000, // Default balance
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
    this.logger.log(`👁️ Player ${data.userId} wants to view their cards in table ${data.tableId}`);
    
    const table = this.activeTables.get(data.tableId);
    if (!table || !table.gameId) {
      return { success: false, message: 'Table or game not found' };
    }
    
    try {
      const game = await this.gameService.findOne(table.gameId);
      await this.gameStateService.playerViewCards(game, data.userId);
      
      this.logger.log(`👁️ Player ${data.userId} has SEEN their cards (no longer blind)`);
      
      // Broadcast updated game state
      const gameState = await this.gameEngine.getGameState(game);
      this.server.to(`table:${data.tableId}`).emit('game_state_updated', gameState);
      
      return { success: true, message: 'Cards viewed successfully' };
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
    this.logger.log(`🎲 Player ${data.userId} playing blind: ${data.action} in table ${data.tableId}`);
    
    const table = this.activeTables.get(data.tableId);
    if (!table || !table.gameId) {
      return { success: false, message: 'Table or game not found' };
    }
    
    try {
      const game = await this.gameService.findOne(table.gameId);
      await this.gameStateService.playerPlayBlind(game, data.userId, data.action, data.amount);
      
      this.logger.log(`🎲 Player ${data.userId} played blind: ${data.action}`);
      
      // Broadcast updated game state
      const gameState = await this.gameEngine.getGameState(game);
      this.server.to(`table:${data.tableId}`).emit('game_state_updated', gameState);
      
      return { success: true, message: 'Blind action processed' };
    } catch (error) {
      this.logger.error(`❌ Error playing blind: ${error.message}`);
      return { success: false, message: 'Failed to process blind action' };
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
   * Get online users for the lobby
   */
  @SubscribeMessage('get_online_users')
  handleGetOnlineUsers(
    @ConnectedSocket() client: Socket,
  ) {
    this.logger.log(`👥 GET_ONLINE_USERS request from client ${client.id}`);
    
    // Get all online users from the lobby
    const onlineUsers = Array.from(this.onlineUsers).map(userId => {
      const userData = this.userData.get(userId);
      return {
        userId: userId,
        email: userData?.email || '',
        username: userData?.username || userData?.email?.split('@')[0] || 'Player',
        avatar: userData?.avatar || null,
        isOnline: true,
        lastSeen: new Date().toISOString()
      };
    });
    
    this.logger.log(`   Returning ${onlineUsers.length} online users`);
    
    return {
      success: true,
      onlineUsers,
      totalOnline: onlineUsers.length
    };
  }

  /**
   * Send game invitation to another user
   */
  @SubscribeMessage('send_game_invitation')
  async handleSendGameInvitation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      targetUserId: string;
      tableName: string;
      tableId: string;
      entryFee: number;
      gameUrl: string;
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

    const invitationData = {
      inviterId: inviterUserId,
      inviterName: inviterData?.username || inviterData?.email?.split('@')[0] || 'Anonymous',
      inviterEmail: inviterData?.email,
      tableName: data.tableName,
      tableId: data.tableId,
      entryFee: data.entryFee,
      gameUrl: data.gameUrl,
      timestamp: new Date().toISOString()
    };

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
        try {
          // Get target user data from the userData map
          const targetUserData = this.userData.get(data.targetUserId);
          const emailResult = await this.emailService.sendGameInvitation(
            targetUserData?.email || 'unknown@example.com',
            inviterData?.username || inviterData?.email?.split('@')[0] || 'Anonymous',
            data.tableName,
            data.entryFee,
            data.gameUrl
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
      this.logger.log(`📱 Sending real-time notification to ${data.targetUserId} (socket: ${targetUserSocketId})`);
      this.logger.log(`📱 Current userSockets map for ${data.targetUserId}:`, this.userSockets.get(data.targetUserId));
      this.logger.log(`📱 Invitation data:`, JSON.stringify(invitationData, null, 2));
      this.server.to(targetUserSocketId).emit('game_invitation', invitationData);
      
      // Confirm to sender
      client.emit('invitation_sent', {
        success: true,
        method: 'realtime',
        targetUserId: data.targetUserId
      });
    } else {
      // User is offline, send email
      this.logger.log(`📧 User ${data.targetUserId} is offline, sending email`);
      
      // Send email invitation using injected EmailService
      this.emailService.sendGameInvitation(
        invitationData.inviterEmail || 'unknown@example.com',
        invitationData.inviterName,
        invitationData.tableName,
        invitationData.entryFee,
        invitationData.gameUrl
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
   * Join table (IN-MEMORY) - Allows rejoining if previously left
   */
  @SubscribeMessage('join_table')
  handleJoinTable(
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
    let table = this.activeTables.get(data.tableId);
    
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
        singlePlayerSince: new Date(),
        gameId: null as string | null,
        lastWinnerId: null as string | null,
        lastHeartbeat: new Date()
      };
      
      this.activeTables.set(data.tableId, newTable);
      table = newTable;
      
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
    
    if (!table) {
      this.logger.log(`❌ Join failed: Table ${data.tableId} not found`);
      return {
        success: false,
        message: 'Table not found'
      };
    }
    
    // Check if already in table (allow rejoining - just update info)
    const existingPlayer = table.players.find(p => p.userId === data.userId);
    if (existingPlayer) {
      this.logger.log(`🔄 Player ${data.userEmail} already in table ${table.tableName} - rejoin allowed`);
      // Update player data in case it changed
      existingPlayer.email = data.userEmail;
      if (data.username) existingPlayer.username = data.username;
      if (data.avatar) existingPlayer.avatar = data.avatar;
      
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
          const timer = setTimeout(() => {
            this.autoStartGame(table.id);
            this.countdownTimers.delete(table.id); // Clean up timer reference
          }, 10000); // 10 seconds
          
          // Store timer to prevent duplicates
          this.countdownTimers.set(table.id, timer);
        } else {
          this.logger.log(`⏱️ Countdown already in progress for table ${table.tableName} (rejoin)`);
        }
      }
      
      return {
        success: true,
        message: 'Already in table - rejoined successfully'
      };
    }
    
    // Check if table is full
    if (table.players.length >= table.maxPlayers) {
      this.logger.log(`❌ Join failed: Table ${table.tableName} is full (${table.players.length}/${table.maxPlayers})`);
      return {
        success: false,
        message: 'Table is full'
      };
    }
    
    // Add player with real user data
    table.players.push({
      userId: data.userId,
      email: data.userEmail,
      username: data.username || data.userEmail.split('@')[0], // Fallback to email prefix
      avatar: data.avatar || undefined,
    });
    
    const isCreator = data.userId === table.creatorId;
    this.logger.log(`✅ Player ${data.userEmail} joined table ${table.tableName} (${table.players.length}/${table.maxPlayers})`);
    if (isCreator) {
      this.logger.log(`   👑 Creator joined`);
    }
    
    // CLEAR idle timeout if table had 1 player (now has 2+)
    if (table.players.length === 2 && table.singlePlayerSince) {
      this.logger.log(`   ⏰ Clearing idle timeout - table now has ${table.players.length} players`);
      table.singlePlayerSince = null;
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
    if (table.players.length === 2 && table.status === 'waiting') {
      // Check if countdown is already in progress for this table
      if (this.countdownTimers.has(table.id)) {
        this.logger.log(`⏱️ Countdown already in progress for table ${table.tableName}`);
        return {
          success: true,
          message: 'Joined table'
        };
      }
      
      this.logger.log(`🚀 AUTO-START: EXACTLY 2 players present - starting game with 10-second countdown!`);
      
      // Emit game_starting event to show countdown to all players
      this.server.to(`table:${table.id}`).emit('game_starting', {
        tableId: table.id,
        tableName: table.tableName,
        countdown: 10, // 10 seconds countdown
        message: 'Game is starting! Get ready...',
        timestamp: new Date(),
      });
      
      // Start game after 10-second delay
      const timer = setTimeout(() => {
        this.autoStartGame(table.id);
        this.countdownTimers.delete(table.id); // Clean up timer reference
      }, 10000); // 10 seconds
      
      // Store timer to prevent duplicates
      this.countdownTimers.set(table.id, timer);
    } else if (table.players.length === 1) {
      this.logger.log(`⏳ Waiting for more players... (${table.players.length}/${table.maxPlayers})`);
    } else if (table.players.length > 2) {
      this.logger.log(`👥 ${table.players.length} players in table, countdown already started`);
    }
    
    return {
      success: true,
      message: 'Joined table'
    };
  }

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
      return;
    }
    
    try {
      this.logger.log(`🎮 AUTO-STARTING game for table: ${table.tableName} with ${table.players.length} players`);
      table.status = 'in_progress';
      
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
    }
  }

  /**
   * Leave table (IN-MEMORY) - Only delete when COMPLETELY empty (0 players)
   */
  @SubscribeMessage('leave_table')
  handleLeaveTable(
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
    
    // ONLY delete if table is COMPLETELY EMPTY (0 players)
    if (table.players.length === 0) {
      this.activeTables.delete(data.tableId);
      this.logger.log(`🗑️ Table ${table.tableName} deleted - NO PLAYERS REMAINING`);
      
      // Broadcast table removal
      this.server.to('lobby').emit('table_removed', {
        id: table.id,
      timestamp: new Date(),
    });
      
      return {
        success: true,
        message: 'Left table - table deleted (empty)'
      };
    }
    
    // Table persists with remaining players
    this.logger.log(`✅ Table ${table.tableName} persists with ${table.players.length} player(s) - can rejoin`);
    
    // START idle timeout if table now has exactly 1 player
    if (table.players.length === 1) {
      table.singlePlayerSince = new Date();
      this.logger.log(`   ⏰ Started 10-minute idle timeout - table now has only 1 player`);
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
   * Player chooses to see their cards (ends blind betting for this player)
   */
  @SubscribeMessage('see_cards')
  async handleSeeCards(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tableId: string; userId: string },
  ) {
    const table = this.activeTables.get(data.tableId);
    
    if (!table || !table.gameId) {
      return { success: false, message: 'Game not found or not started' };
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
      await this.gameService.saveGame(game);
      
      this.logger.log(`👁️ Player ${data.userId} has SEEN their cards (no longer blind)`);
      
      // Get updated game state
      const gameState = await this.gameEngine.getGameState(game);
      
      // Broadcast to all players that this player has seen their cards
      this.server.to(`table:${data.tableId}`).emit('player_seen_cards', {
        tableId: data.tableId,
        userId: data.userId,
        gameState: gameState,
      timestamp: new Date(),
    });
      
      return { 
        success: true, 
        message: 'Cards revealed',
        hand: player.hand,
        gameState: gameState
      };
      
    } catch (error) {
      this.logger.error(`Error handling see_cards: ${error.message}`);
      return { success: false, message: error.message };
    }
  }

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
      
      this.server.to(socketId).emit('your_turn', {
        gameId,
        userId,
        availableActions,
        currentBet: game.state.currentBet,
        pot: game.state.pot,
        timeLimit: 30, // TODO: Make configurable
      timestamp: new Date(),
    });
      
      this.logger.log(`Notified ${userId} it's their turn in game ${gameId}`);
    }
  }

  /**
   * Broadcast showdown results
   */
  private async broadcastShowdown(tableId: string, gameId: string) {
    try {
      const game = await this.gameService.findOne(gameId);
      const gameState = await this.gameEngine.getGameState(game);
      
      this.logger.log(`🏆 Showdown - Phase: ${gameState.phase}, Winners: ${gameState.winners.join(', ')}`);
      
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
        pot: gameState.pot,
        timestamp: new Date(),
      };
      
      // Broadcast to all players in the table
      this.server.to(`table:${tableId}`).emit('showdown', showdownData);
      
      this.logger.log(`✅ Broadcasted showdown to table ${tableId}`);
      this.logger.log(`   Winners: ${gameState.winners.join(', ')}`);
      this.logger.log(`   Pot: ${gameState.pot}`);
      
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
    
    // Auto-remove players with insufficient balance after game ends
    await this.checkAndRemoveInsufficientPlayers(tableId);
  }
  
  /**
   * Check player balances and remove those who can't afford entry fee
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
        const availableBalance = balanceData.availableBalance;
        
        if (availableBalance < table.entryFee) {
          this.logger.log(`   ❌ ${player.email}: Balance ${availableBalance} < Entry fee ${table.entryFee} - REMOVING`);
          removedPlayers.push(player.userId);
          
          // Notify the player they were removed
          this.server.to(`table:${tableId}`).emit('player_removed_insufficient_balance', {
            tableId,
            userId: player.userId,
            balance: availableBalance,
            entryFee: table.entryFee,
            message: 'You have been removed from the table due to insufficient balance',
            timestamp: new Date(),
          });
        } else {
          this.logger.log(`   ✅ ${player.email}: Balance ${availableBalance} ≥ Entry fee ${table.entryFee} - OK`);
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
        // No players left - delete table
        this.activeTables.delete(tableId);
        this.logger.log(`🗑️ Table ${table.tableName} deleted - no players with sufficient balance`);
        
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
          this.logger.log(`🔄 CONTINUOUS CYCLING: ${table.players.length} players remain - auto-starting next game in 3 seconds...`);
          setTimeout(() => {
            this.autoStartGame(table.id);
          }, 3000); // 3 second delay between games
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
   */
  async broadcastGameStateUpdate(gameId: string) {
    try {
      const gameState = await this.gameService.getGameState(gameId);
      
      this.server.to(`game:${gameId}`).emit('game_state_updated', gameState);
      
      this.logger.log(`Broadcasted state update for game ${gameId}`);
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
