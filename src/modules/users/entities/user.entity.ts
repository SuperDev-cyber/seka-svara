import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserRole } from '../enums/user-role.enum';
import { UserStatus } from '../enums/user-status.enum';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'enum', enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: 'text', nullable: true })
  avatar: string;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerificationToken: string;

  @Column({ nullable: true })
  passwordResetToken: string;

  @Column({ nullable: true })
  passwordResetExpires: Date;

  @Column({ nullable: true })
  refreshToken: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  balance: number;

  @Column({ type: 'int', default: 0 })
  totalGamesPlayed: number;

  @Column({ type: 'int', default: 0 })
  totalGamesWon: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  totalWinnings: number;

  @Column({ type: 'int', default: 0 })
  level: number;

  @Column({ type: 'int', default: 0 })
  experience: number;

  @Column({ nullable: true })
  trc20WalletAddress: string;

  @Column({ nullable: true })
  bep20WalletAddress: string;

  @Column({ nullable: true })
  erc20WalletAddress: string;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 0 })
  points: number;

  @Column({ type: 'decimal', precision: 18, scale: 0, default: 0 })
  platformScore: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ nullable: true })
  lastLoginAt: Date;

  // Relations will be added here
  // @OneToMany(() => Transaction, transaction => transaction.user)
  // transactions: Transaction[];

  // @OneToMany(() => GameTable, table => table.creator)
  // createdTables: GameTable[];
}

