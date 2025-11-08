import { IsString, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ description: 'Network type' })
  @IsEnum(['BEP20', 'TRC20', 'ERC20'])
  network: string;

  @ApiProperty({ description: 'Withdrawal amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'To address' })
  @IsString()
  toAddress: string;

  @ApiProperty({ description: 'From address (user\'s Web3Auth account address). If not provided, uses admin wallet.', required: false })
  @IsOptional()
  @IsString()
  fromAddress?: string;
}