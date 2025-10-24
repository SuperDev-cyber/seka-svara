import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsEnum, IsOptional, Min } from 'class-validator';

export class CreateNftDto {
  @ApiProperty({ example: 'Cool Avatar #1' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A unique avatar for your profile' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 'https://...' })
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(1)
  price: number;

  @ApiProperty({ example: 'BEP20', enum: ['BEP20', 'TRC20'] })
  @IsEnum(['BEP20', 'TRC20'])
  network: string;

  @ApiProperty({ example: 'avatar' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ example: { rarity: 'rare', power: 100 } })
  @IsOptional()
  attributes?: any;
}

