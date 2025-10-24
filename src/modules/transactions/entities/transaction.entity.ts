import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: ['deposit', 'withdrawal', 'bet', 'win', 'refund', 'fee'], default: 'deposit' })
  type: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  amount: number;

  @Column({ type: 'enum', enum: ['BEP20', 'TRC20', 'internal'], default: 'internal' })
  network: string;

  @Column({ nullable: true })
  txHash: string; // Blockchain transaction hash

  @Column({ type: 'enum', enum: ['pending', 'completed', 'failed', 'cancelled'], default: 'pending' })
  status: string;

  @Column({ nullable: true })
  fromAddress: string;

  @Column({ nullable: true })
  toAddress: string;

  @Column({ nullable: true })
  gameId: string; // Related game ID if applicable

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;
}

