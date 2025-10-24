import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  balance: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  availableBalance: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  lockedBalance: number;

  @Column({ nullable: true })
  bep20Address: string;

  @Column({ nullable: true })
  trc20Address: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}