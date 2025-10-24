import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('nft_transactions')
export class NFTTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  nftId: string;

  @Column()
  fromUserId: string;

  @Column()
  toUserId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'enum', enum: ['mint', 'sale', 'transfer'], default: 'sale' })
  type: string;

  @Column({ nullable: true })
  txHash: string; // Blockchain transaction hash

  @CreateDateColumn()
  createdAt: Date;
}

