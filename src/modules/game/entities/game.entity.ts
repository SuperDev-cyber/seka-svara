import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { GamePlayer } from './game-player.entity';

@Entity('games')
export class Game {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tableId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 1 })
  currentRound: number;

  @Column({ nullable: true })
  currentTurnPlayerId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  pot: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  currentBet: number;

  @Column({ type: 'int', default: 10 })
  maxPlayers: number; // Maximum players allowed (2-10)

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  ante: number; // Entry fee per player (POT)

  @Column({ nullable: true })
  winnerId: string;

  @Column({ nullable: true })
  dealerId: string; // Current dealer (creator for first game, then winner)

  @Column({ type: 'json', nullable: true })
  gameState: any; // Store current game state (deck, community cards, etc.)

  @Column({ type: 'json', nullable: true })
  history: any[]; // Store action history

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  finishedAt: Date;

  // ✅ NEW: Comprehensive Game Tracking
  // Track which users have viewed their cards
  @Column({ type: 'simple-array', nullable: true, default: () => "''" })
  cardViewers: string[];

  // Track blind bet players and their blind bet counts/amounts
  @Column({ type: 'json', nullable: true, default: () => "'{}'" })
  blindPlayers: Record<string, { count: number; totalAmount: number }>;

  // Total number of participants in this game
  @Column({ type: 'int', default: 0 })
  participantCount: number;

  // Game results: winners, losers, amounts
  @Column({ type: 'json', nullable: true, default: () => "'{}'" })
  gameResults: {
    winners?: Array<{ userId: string; amount: number; handDescription?: string }>;
    losers?: Array<{ userId: string; amountLost: number }>;
    kicked?: Array<{ userId: string; reason?: string }>;
    leftEarly?: Array<{ userId: string }>;
  };

  @OneToMany(() => GamePlayer, player => player.game)
  players: GamePlayer[];

  // Helper property to map gameState to state
  get state(): any {
    if (!this.gameState) {
      this.gameState = {
        phase: 'waiting',
        bettingRound: 0,
        currentPlayerId: null,
        pot: 0,
        currentBet: 0,
        bettingHistory: [],
        winners: [],
        playerStates: {},
        startedAt: null,
      };
    }
    return this.gameState;
  }

  set state(value: any) {
    this.gameState = value;
  }
}

