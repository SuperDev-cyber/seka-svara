import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/user-role.enum';
import { UserStatus } from '../../users/enums/user-status.enum';

export class UserResponseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'john_doe' })
  username: string;

  @ApiProperty({ example: 'john@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: 'https://example.com/avatar.jpg', required: false })
  avatar?: string;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ example: 0 })
  balance: number;

  @ApiProperty({ example: 0 })
  totalGamesPlayed: number;

  @ApiProperty({ example: 0 })
  totalGamesWon: number;

  @ApiProperty({ example: 0 })
  totalWinnings: number;

  @ApiProperty({ example: 1 })
  level: number;

  @ApiProperty({ example: 0 })
  experience: number;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  updatedAt: Date;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z', required: false })
  lastLoginAt?: Date;
}

export class AuthResponseDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refresh_token: string;

  @ApiProperty({ type: UserResponseDto })
  user: UserResponseDto;
}

export class MessageResponseDto {
  @ApiProperty({ example: 'Success message' })
  message: string;

  @ApiProperty({ example: true, required: false })
  success?: boolean;
}
