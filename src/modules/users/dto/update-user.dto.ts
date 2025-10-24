import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsNumber } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl()
  avatar?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  trc20WalletAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bep20WalletAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  erc20WalletAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  points?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  balance?: number;
}

