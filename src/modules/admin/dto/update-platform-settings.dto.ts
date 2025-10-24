import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsBoolean, IsString, Min, Max } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  platformFeePercentage?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minBetAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxBetAmount?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  minPlayersPerTable?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  maxPlayersPerTable?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  maintenanceMode?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  maintenanceMessage?: string;
}

