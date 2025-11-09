import { IsString, IsNumber, IsEnum, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({ description: 'Network type' })
  @IsEnum(['BEP20'])
  network: string;

  @ApiProperty({ description: 'Deposit amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'From address' })
  @IsString()
  fromAddress: string;

  @ApiProperty({ description: 'Transaction hash' })
  @IsString()
  txHash: string;
}