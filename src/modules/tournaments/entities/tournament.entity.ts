import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TournamentPlayer } from './tournament-player.entity';

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({
    type: 'enum',
    enum: ['scheduled', 'sit_n_go'],
    default: 'sit_n_go',
  })
  type: string; // scheduled or sit-n-go

  @Column({
    type: 'enum',
    enum: ['registration', 'in_progress', 'completed', 'cancelled'],
    default: 'registration',
  })
  status: string;

  @Column({ type: 'int' })
  maxPlayers: number; // Maximum number of players

  @Column({ type: 'int', default: 2 })
  minPlayers: number; // Minimum players to start

  @Column({ type: 'int', default: 0 })
  currentPlayers: number; // Current registered players

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  buyIn: number; // Entry fee

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  prizePool: number; // Total prize pool

  @Column({ type: 'json', nullable: true })
  prizeDistribution: number[]; // [50, 30, 20] for 1st, 2nd, 3rd

  @Column({ nullable: true })
  scheduledStartTime: Date; // For scheduled tournaments

  @Column({ nullable: true })
  startedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @Column({ type: 'int', default: 1 })
  currentRound: number;

  @Column({ type: 'int', default: 10 })
  blindsLevel: number; // Starting blinds level

  @Column({ type: 'int', default: 300 })
  blindsIncreaseInterval: number; // Seconds between blind increases

  @Column({ type: 'int', default: 1000 })
  startingChips: number;

  @Column({ type: 'boolean', default: false })
  allowRebuys: boolean;

  @Column({ type: 'int', default: 0 })
  rebuyCount: number; // Number of rebuys allowed

  @Column({ type: 'int', default: 5 })
  playersPerTable: number; // Players per table (2-10)

  @Column({ type: 'json', nullable: true })
  tables: string[]; // Array of game/table IDs

  @Column({ type: 'json', nullable: true })
  eliminatedPlayers: string[]; // Array of eliminated player IDs in order

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TournamentPlayer, player => player.tournament)
  players: TournamentPlayer[];
}

