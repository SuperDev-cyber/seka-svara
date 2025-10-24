import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { GameTable } from './game-table.entity';

@Entity('table_players')
export class TablePlayer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tableId: string;

  @Column()
  userId: string;

  @Column({ type: 'int' })
  seatNumber: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  chips: number; // Player's chips at table

  @Column({ type: 'boolean', default: false })
  isReady: boolean;

  @Column({ type: 'enum', enum: ['active', 'sitting_out', 'disconnected'], default: 'active' })
  status: string;

  @CreateDateColumn()
  joinedAt: Date;

  @ManyToOne(() => GameTable, table => table.players)
  @JoinColumn({ name: 'tableId' })
  table: GameTable;
}

