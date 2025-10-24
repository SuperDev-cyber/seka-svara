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

