/**
 * Wallet Service Interface for Game Module Integration
 * 
 * This interface defines the contract between the Game module (Developer 2)
 * and the Wallet module (Developer 3).
 * 
 * Developer 3 should implement this interface in the Wallet module.
 * 
 * Usage in Game module:
 * - Deduct balance when players bet
 * - Credit balance when players win
 * - Check balance before allowing bets
 */

export const WALLET_SERVICE = 'WALLET_SERVICE';

export interface IWalletService {
  /**
   * Deduct amount from user's wallet
   * 
   * @param userId - User ID
   * @param amount - Amount to deduct
   * @param metadata - Transaction metadata
   * @returns Transaction result
   * @throws InsufficientBalanceException if balance is insufficient
   */
  deductBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult>;

  /**
   * Add amount to user's wallet
   * 
   * @param userId - User ID
   * @param amount - Amount to add
   * @param metadata - Transaction metadata
   * @returns Transaction result
   */
  addBalance(
    userId: string,
    amount: number,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult>;

  /**
   * Get user's current balance
   * 
   * @param userId - User ID
   * @returns Current balance
   */
  getBalance(userId: string): Promise<number>;

  /**
   * Check if user has sufficient balance
   * 
   * @param userId - User ID
   * @param amount - Amount to check
   * @returns True if sufficient balance
   */
  hasSufficientBalance(userId: string, amount: number): Promise<boolean>;

  /**
   * Lock funds for a game (reserve without deducting)
   * Used for ante when game is created
   * 
   * @param userId - User ID
   * @param amount - Amount to lock
   * @param gameId - Game ID
   * @returns Lock result
   */
  lockFunds(userId: string, amount: number, gameId: string): Promise<WalletLockResult>;

  /**
   * Release locked funds (cancel lock)
   * Used when game is cancelled
   * 
   * @param userId - User ID
   * @param lockId - Lock ID from lockFunds
   * @returns Unlock result
   */
  releaseFunds(userId: string, lockId: string): Promise<void>;

  /**
   * Convert locked funds to deduction
   * Used when game actually starts
   * 
   * @param userId - User ID
   * @param lockId - Lock ID from lockFunds
   * @param metadata - Transaction metadata
   * @returns Transaction result
   */
  deductLockedFunds(
    userId: string,
    lockId: string,
    metadata: WalletTransactionMetadata,
  ): Promise<WalletTransactionResult>;
}

/**
 * Transaction metadata for tracking
 */
export interface WalletTransactionMetadata {
  type: WalletTransactionType;
  gameId?: string;
  tableId?: string;
  description?: string;
  timestamp?: Date;
}

/**
 * Transaction types
 */
export enum WalletTransactionType {
  GAME_ANTE = 'game_ante',
  GAME_BET = 'game_bet',
  GAME_RAISE = 'game_raise',
  GAME_CALL = 'game_call',
  GAME_ALL_IN = 'game_all_in',
  GAME_BLIND = 'game_blind',
  GAME_WINNINGS = 'game_winnings',
  GAME_REFUND = 'game_refund',
  TOURNAMENT_ENTRY = 'tournament_entry',
  TOURNAMENT_PRIZE = 'tournament_prize',
}

/**
 * Transaction result
 */
export interface WalletTransactionResult {
  success: boolean;
  transactionId: string;
  userId: string;
  amount: number;
  newBalance: number;
  timestamp: Date;
  metadata?: WalletTransactionMetadata;
}

/**
 * Lock result
 */
export interface WalletLockResult {
  success: boolean;
  lockId: string;
  userId: string;
  amount: number;
  gameId: string;
  expiresAt: Date;
}

/**
 * Exception thrown when insufficient balance
 */
export class InsufficientBalanceException extends Error {
  constructor(
    public readonly userId: string,
    public readonly required: number,
    public readonly available: number,
  ) {
    super(`Insufficient balance for user ${userId}. Required: ${required}, Available: ${available}`);
    this.name = 'InsufficientBalanceException';
  }
}

