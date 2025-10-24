import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class CreateTableDto {
  @ApiProperty({ example: 'High Stakes Table' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'BEP20', enum: ['BEP20', 'TRC20'] })
  @IsEnum(['BEP20', 'TRC20'])
  network: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(10)
  buyInAmount: number;

  @ApiProperty({ example: 10 })
  @IsNumber()
  @Min(1)
  minBet: number;

  @ApiProperty({ example: 1000 })
  @IsNumber()
  @Min(1)
  maxBet: number;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(2)
  @Max(6)
  @IsOptional()
  minPlayers?: number;

  @ApiProperty({ example: 6 })
  @IsNumber()
  @Min(2)
  @Max(6)
  @IsOptional()
  maxPlayers?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  @IsOptional()
  isPrivate?: boolean;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0)
  @Max(10)
  @IsOptional()
  platformFee?: number;
}

