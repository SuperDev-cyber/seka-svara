import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'john_doe', description: 'Unique username' })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({ example: 'john@example.com', description: 'Valid email address' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Password123!', description: 'Strong password' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ example: 'Password123!', description: 'Confirm password' })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}

