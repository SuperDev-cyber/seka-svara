import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export class BuyNftDto {
  @ApiProperty({ example: 'BEP20', enum: ['BEP20', 'TRC20'] })
  @IsEnum(['BEP20', 'TRC20'])
  network: 'BEP20' | 'TRC20';
}

