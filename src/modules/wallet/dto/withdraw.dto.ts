import { IsString, IsNumber, IsEnum, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ description: 'Network type' })
  @IsEnum(['BEP20', 'ERC20'])
  network: string;

  @ApiProperty({ description: 'Withdrawal amount' })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({ description: 'To address (recipient address)' })
  @IsString()
  toAddress: string;

  @ApiProperty({ description: 'From address (user\'s Web3Auth account address). Required - must be the user\'s SafeAuth account address.' })
  @IsString()
  fromAddress: string;

  @ApiProperty({ description: 'User\'s private key from Web3Auth (for signing the transaction). Should be encrypted before sending.' })
  @IsString()
  privateKey: string; // ✅ User's private key from Web3Auth
}