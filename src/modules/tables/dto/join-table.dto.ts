import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class JoinTableDto {
  @ApiProperty({ example: 1, description: 'Preferred seat number (1-6)' })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(6)
  seatNumber?: number;

  @ApiProperty({ example: 'ABC123', description: 'Invite code for private tables' })
  @IsString()
  @IsOptional()
  inviteCode?: string;
}

