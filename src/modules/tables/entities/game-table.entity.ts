import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { TablePlayer } from './table-player.entity';

@Entity('game_tables')
export class GameTable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  creatorId: string;

  @Column({ type: 'enum', enum: ['waiting', 'playing', 'finished'], default: 'waiting' })
  status: string;

  @Column({ type: 'enum', enum: ['BEP20', 'TRC20'], default: 'BEP20' })
  network: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  buyInAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  minBet: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  maxBet: number;

  @Column({ type: 'int', default: 2 })
  minPlayers: number;

  @Column({ type: 'int', default: 6 })
  maxPlayers: number;

  @Column({ type: 'int', default: 0 })
  currentPlayers: number;

  @Column({ type: 'boolean', default: false })
  isPrivate: boolean;

  @Column({ nullable: true })
  inviteCode: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  platformFee: number;

  @Column({ nullable: true })
  currentGameId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => TablePlayer, player => player.table)
  players: TablePlayer[];
}

