import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Web3AuthLoginDto {
  @ApiProperty({ description: 'Web3Auth wallet address' })
  @IsString()
  @IsNotEmpty()
  walletAddress: string;

  @ApiProperty({ description: 'Web3Auth user email (optional, from Google login)' })
  @IsString()
  email?: string;

  @ApiProperty({ description: 'Web3Auth user name (optional, from Google login)' })
  @IsString()
  name?: string;
}

