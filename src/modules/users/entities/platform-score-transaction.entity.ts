import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum ScoreTransactionType {
  EARNED = 'earned',
  SPENT = 'spent',
  BONUS = 'bonus',
  PENALTY = 'penalty',
  REFUND = 'refund',
}

@Entity('platform_score_transactions')
export class PlatformScoreTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceBefore: number;

  @Column({ type: 'decimal', precision: 18, scale: 2 })
  balanceAfter: number;

  @Column({
    type: 'enum',
    enum: ScoreTransactionType,
  })
  type: ScoreTransactionType;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  referenceId: string; // Game ID, transaction ID, etc.

  @Column({ nullable: true })
  referenceType: string; // 'game', 'deposit', 'withdrawal', etc.

  @CreateDateColumn()
  createdAt: Date;
}

