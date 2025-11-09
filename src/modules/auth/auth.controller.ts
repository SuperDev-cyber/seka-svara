import { Controller, Post, Body, UseGuards, Request, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { Web3AuthLoginDto } from './dto/web3auth-login.dto';
import { AuthResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User successfully registered', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'Conflict - user already exists' })
  async register(@Body() registerDto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Successfully logged in', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid credentials' })
  async login(@Body() loginDto: LoginDto, @Request() req): Promise<AuthResponseDto> {
    try {
      return await this.authService.login(req.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized - invalid refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<{ access_token: string }> {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Successfully logged out', type: MessageResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Request() req): Promise<MessageResponseDto> {
    return this.authService.logout(req.user.id);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address' })
  @ApiResponse({ status: 200, description: 'Email verified successfully', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid or expired token' })
  @ApiResponse({ status: 404, description: 'Not found - invalid token' })
  async verifyEmail(@Body() body: { token: string }): Promise<MessageResponseDto> {
    return this.authService.verifyEmail(body.token);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiResponse({ status: 200, description: 'Password reset email sent', type: MessageResponseDto })
  async forgotPassword(@Body() body: { email: string }): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password' })
  @ApiResponse({ status: 200, description: 'Password reset successfully', type: MessageResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid or expired token' })
  async resetPassword(@Body() body: { token: string; newPassword: string }): Promise<MessageResponseDto> {
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  @Post('google/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Google OAuth token' })
  @ApiResponse({ status: 200, description: 'Google authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid token' })
  async verifyGoogleToken(@Body() body: { idToken: string }): Promise<AuthResponseDto> {
    try {
      if (!body || !body.idToken) {
        throw new BadRequestException('idToken is required');
      }
      return await this.authService.verifyGoogleToken(body.idToken);
    } catch (error) {
      console.error('Google verify error:', error);
      throw error;
    }
  }

  @Post('web3auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login or register with Web3Auth wallet' })
  @ApiResponse({ status: 200, description: 'Web3Auth authentication successful', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request - invalid wallet address' })
  async loginWithWeb3Auth(@Body() web3AuthDto: Web3AuthLoginDto): Promise<AuthResponseDto> {
    try {
      if (!web3AuthDto || !web3AuthDto.walletAddress) {
        throw new BadRequestException('walletAddress is required');
      }
      return await this.authService.loginWithWeb3Auth(
        web3AuthDto.walletAddress,
        web3AuthDto.email,
        web3AuthDto.name
      );
    } catch (error) {
      console.error('Web3Auth login error:', error);
      throw error;
    }
  }
}

