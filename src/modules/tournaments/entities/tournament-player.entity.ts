import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tournament } from './tournament.entity';

@Entity('tournament_players')
export class TournamentPlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tournamentId: string;

  @Column()
  userId: string;

  @Column({ type: 'int', default: 1000 })
  chips: number; // Current chips

  @Column({ type: 'int' })
  position: number; // Final position (1 = winner, 2 = 2nd place, etc.)

  @Column({ type: 'boolean', default: false })
  isEliminated: boolean;

  @Column({ nullable: true })
  eliminatedAt: Date;

  @Column({ type: 'int', default: 0 })
  rebuysUsed: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  winnings: number;

  @Column({ nullable: true })
  currentTableId: string; // Which table/game they're currently in

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Tournament, tournament => tournament.players)
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;
}

