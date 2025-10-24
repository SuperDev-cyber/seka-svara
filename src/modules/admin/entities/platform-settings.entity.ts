import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('platform_settings')
export class PlatformSettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 5 })
  platformFeePercentage: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 10 })
  minBetAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8, default: 10000 })
  maxBetAmount: number;

  @Column({ type: 'int', default: 2 })
  minPlayersPerTable: number;

  @Column({ type: 'int', default: 6 })
  maxPlayersPerTable: number;

  @Column({ type: 'boolean', default: true })
  maintenanceMode: boolean;

  @Column({ type: 'text', nullable: true })
  maintenanceMessage: string;

  @UpdateDateColumn()
  updatedAt: Date;
}

