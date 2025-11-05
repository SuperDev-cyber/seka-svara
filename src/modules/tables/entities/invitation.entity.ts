import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

@Entity('invitations')
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tableId: string;

  @Column()
  inviterId: string;

  @Column()
  inviteeId: string;

  @Column({ type: 'varchar', default: 'pending' })
  status: InvitationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}



