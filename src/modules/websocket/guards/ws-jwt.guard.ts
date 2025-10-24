import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket JWT Authentication Guard
 * 
 * Validates JWT tokens for WebSocket connections.
 * 
 * Usage:
 * @UseGuards(WsJwtGuard)
 * 
 * The token can be provided in:
 * 1. Socket handshake auth: socket.handshake.auth.token
 * 2. Socket handshake headers: socket.handshake.headers.authorization
 * 3. Query parameters: socket.handshake.query.token
 * 
 * Once validated, the user ID is attached to socket.data.userId
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractToken(client);

      if (!token) {
        throw new WsException('No authentication token provided');
      }

      // TODO: Integrate with actual JWT service from auth module
      // For now, we'll validate token format and extract userId
      const userId = await this.validateToken(token);

      if (!userId) {
        throw new WsException('Invalid authentication token');
      }

      // Attach userId to socket for use in handlers
      client.data.userId = userId;
      client.data.authenticated = true;

      this.logger.log(`WebSocket client authenticated: ${userId}`);

      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${error.message}`);
      throw new WsException('Authentication failed');
    }
  }

  /**
   * Extract token from socket connection
   */
  private extractToken(client: Socket): string | null {
    // Try to get token from auth object
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Try to get from authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to get from query parameters
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    return null;
  }

  /**
   * Validate JWT token and extract user ID
   * 
   * TODO: Replace with actual JWT validation from auth service
   * 
   * @param token - JWT token
   * @returns User ID if valid, null otherwise
   */
  private async validateToken(token: string): Promise<string | null> {
    try {
      // TODO: Integrate with actual auth service
      // Example:
      // const payload = await this.authService.validateToken(token);
      // return payload.userId;

      // Temporary validation (for development only)
      // In production, this MUST use proper JWT validation
      if (!token || token.length < 10) {
        return null;
      }

      // Extract user ID from token (temporary mock)
      // In real implementation, decode JWT and verify signature
      // For now, just return a placeholder
      this.logger.warn('Using mock JWT validation - REPLACE WITH REAL AUTH SERVICE');
      
      // Mock: assume token format is "userId-randomstring"
      // In production, use proper JWT decode
      return 'mock-user-id';
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return null;
    }
  }
}

/**
 * Optional JWT Guard (allows connection without token, but validates if provided)
 * 
 * Use this for endpoints that are public but can benefit from authentication
 */
@Injectable()
export class WsJwtOptionalGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtOptionalGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      const token = this.extractToken(client);

      if (token) {
        const userId = await this.validateToken(token);
        if (userId) {
          client.data.userId = userId;
          client.data.authenticated = true;
          this.logger.log(`WebSocket client authenticated (optional): ${userId}`);
        }
      }

      // Always return true (optional auth)
      return true;
    } catch (error) {
      this.logger.warn(`Optional authentication failed: ${error.message}`);
      return true; // Still allow connection
    }
  }

  private extractToken(client: Socket): string | null {
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    return null;
  }

  private async validateToken(token: string): Promise<string | null> {
    try {
      // TODO: Same as above - integrate with real auth service
      if (!token || token.length < 10) {
        return null;
      }
      return 'mock-user-id';
    } catch (error) {
      return null;
    }
  }
}

