import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Game } from './game.entity';

@Entity('game_players')
export class GamePlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gameId: string;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  position: number; // Seat position at table

  @Column({ type: 'json', nullable: true })
  hand: any[]; // Player's cards (encrypted/hidden)

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  betAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  totalBet: number; // Total bet in this game

  @Column({ type: 'enum', enum: ['active', 'folded', 'all_in', 'disconnected'], default: 'active' })
  status: string;

  @Column({ type: 'boolean', default: false })
  isWinner: boolean;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  winnings: number;

  @Column({ type: 'boolean', default: false })
  hasActed: boolean; // Has acted in current betting round

  @Column({ type: 'boolean', default: false })
  hasSeenCards: boolean; // Whether player has looked at their cards (for blind betting)

  @Column({ type: 'int', nullable: true })
  handScore: number; // Evaluated hand score (for display)

  @Column({ type: 'varchar', nullable: true })
  handDescription: string; // Hand description (e.g., "Three 7s", "Flush - 25 points")

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Game, game => game.players)
  @JoinColumn({ name: 'gameId' })
  game: Game;

  // Helper properties
  get currentBet(): number {
    return this.betAmount;
  }

  set currentBet(value: number) {
    this.betAmount = value;
  }

  get isActive(): boolean {
    return this.status === 'active' || this.status === 'all_in';
  }

  set isActive(value: boolean) {
    if (!value && this.status === 'active') {
      this.status = 'disconnected';
    }
  }

  get folded(): boolean {
    return this.status === 'folded';
  }

  set folded(value: boolean) {
    if (value) {
      this.status = 'folded';
    }
  }

  get allIn(): boolean {
    return this.status === 'all_in';
  }

  set allIn(value: boolean) {
    if (value) {
      this.status = 'all_in';
    }
  }
}

