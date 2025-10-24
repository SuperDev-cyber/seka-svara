import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('nfts')
export class NFT {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column()
  imageUrl: string;

  @Column()
  creatorId: string;

  @Column()
  ownerId: string;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  price: number;

  @Column({ type: 'enum', enum: ['BEP20', 'TRC20'], default: 'BEP20' })
  network: string;

  @Column({ nullable: true })
  tokenId: string; // Blockchain token ID

  @Column({ nullable: true })
  contractAddress: string;

  @Column({ type: 'enum', enum: ['listed', 'sold', 'unlisted'], default: 'listed' })
  status: string;

  @Column({ nullable: true })
  category: string; // avatar, card_back, table_theme, etc.

  @Column({ type: 'json', nullable: true })
  attributes: any; // NFT metadata attributes

  @Column({ type: 'int', default: 0 })
  views: number;

  @Column({ type: 'int', default: 0 })
  likes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

