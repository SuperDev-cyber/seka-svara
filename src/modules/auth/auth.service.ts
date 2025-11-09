import { Injectable, UnauthorizedException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { AuthResponseDto, UserResponseDto, MessageResponseDto } from './dto/auth-response.dto';
import { UserRole } from '../users/enums/user-role.enum';
import { UserStatus } from '../users/enums/user-status.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    console.log('Register method called with:', registerDto);
    
    const { username, email, password, confirmPassword } = registerDto;

    // Validate password confirmation
    if (password !== confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    console.log('Password validation passed');

    // Check if user already exists
    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }],
    });

    console.log('Existing user check completed:', existingUser);

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException('Email already exists');
      }
      if (existingUser.username === username) {
        throw new ConflictException('Username already exists');
      }
    }

    // Hash password
    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS', '12'));
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // ✅ AUTO-ASSIGN ADMIN ROLE for master admin email
    const MASTER_ADMIN_EMAIL = 'alaric.0427.hodierne.1999@gmail.com';
    const isMasterAdmin = email === MASTER_ADMIN_EMAIL;
    
    if (isMasterAdmin) {
      console.log('🔑 Master admin account detected - auto-assigning ADMIN role');
    }
    
    // Create user
    // Create new user with 0 balance - users must deposit to play
    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      role: isMasterAdmin ? UserRole.ADMIN : UserRole.USER, // Auto-assign admin for master email
      status: UserStatus.ACTIVE,
      emailVerified: isMasterAdmin, // Auto-verify master admin
      emailVerificationToken,
      balance: 0, // ✅ Users start with 0 - must deposit to play
      totalGamesPlayed: 0,
      totalGamesWon: 0,
      totalWinnings: 0,
      level: 1,
      experience: 0,
    });

    const savedUser = await this.usersRepository.save(user);

    // Generate tokens
    console.log('Generating tokens for user:', savedUser.email);
    const tokens = await this.generateTokens(savedUser);
    console.log('Tokens generated successfully:', !!tokens.access_token);

    // TODO: Send verification email
    // await this.sendVerificationEmail(savedUser.email, emailVerificationToken);

    const response = {
      ...tokens,
      user: this.sanitizeUser(savedUser),
    };
    
    console.log('Registration response prepared:', {
      hasAccessToken: !!response.access_token,
      hasRefreshToken: !!response.refresh_token,
      hasUser: !!response.user
    });

    return response;
  }

  async login(user: User): Promise<AuthResponseDto> {
    console.log('🔍 DEBUG: User in login method:', {
      email: user.email,
      id: user.id,
      role: user.role,
      username: user.username
    });
    
    // Update last login
    await this.usersRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.usersRepository.findOne({ where: { email } });
    
    if (!user) {
      return null;
    }

    console.log('🔍 DEBUG: User in validateUser:', {
      email: user.email,
      id: user.id,
      role: user.role,
      username: user.username
    });
    
    // ✅ AUTO-UPGRADE: If this is a master admin email, upgrade to admin role
    const MASTER_ADMIN_EMAILS = [
      'alaric.0427.hodierne.1999@gmail.com',
      'superadmin@seka.com',
      'superadmin123@seka.com'
    ];
    
    if (MASTER_ADMIN_EMAILS.includes(email) && user.role !== UserRole.ADMIN) {
      console.log('🔑 MASTER ADMIN DETECTED - Upgrading role to ADMIN');
      user.role = UserRole.ADMIN;
      user.emailVerified = true;
      await this.usersRepository.save(user);
      console.log('✅ User upgraded to ADMIN role');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  async refreshToken(refreshToken: string): Promise<{ access_token: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.usersRepository.findOne({ where: { id: payload.sub } });
      if (!user || user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new access token
      const newPayload = { email: user.email, sub: user.id, role: user.role };
      const access_token = this.jwtService.sign(newPayload);

      return { access_token };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<MessageResponseDto> {
    await this.usersRepository.update(userId, {
      refreshToken: undefined,
    });

    return { message: 'Successfully logged out', success: true };
  }

  async verifyEmail(token: string): Promise<MessageResponseDto> {
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new NotFoundException('Invalid verification token');
    }

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.usersRepository.update(user.id, {
      emailVerified: true,
      emailVerificationToken: undefined,
    });

    return { message: 'Email verified successfully', success: true };
  }

  async forgotPassword(email: string): Promise<MessageResponseDto> {
    const user = await this.usersRepository.findOne({ where: { email } });
    
    if (!user) {
      // Don't reveal if email exists or not for security
      return { message: 'If the email exists, a password reset link has been sent', success: true };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    await this.usersRepository.update(user.id, {
      passwordResetToken: resetToken,
      passwordResetExpires: resetExpires,
    });

    // TODO: Send password reset email
    // await this.sendPasswordResetEmail(user.email, resetToken);

    return { message: 'If the email exists, a password reset link has been sent', success: true };
  }

  async resetPassword(token: string, newPassword: string): Promise<MessageResponseDto> {
    const user = await this.usersRepository.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: new Date(), // Check if token is not expired
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    // Hash new password
    const saltRounds = parseInt(this.configService.get('BCRYPT_ROUNDS', '12'));
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await this.usersRepository.update(user.id, {
      password: hashedPassword,
      passwordResetToken: undefined,
      passwordResetExpires: undefined,
    });

    return { message: 'Password reset successfully', success: true };
  }

  private async generateTokens(user: User): Promise<{ access_token: string; refresh_token: string }> {
    try {
      console.log('🔍 DEBUG: User object in generateTokens:', {
        email: user.email,
        id: user.id,
        role: user.role,
        username: user.username
      });
      
      const payload = { email: user.email, sub: user.id, role: user.role };
      console.log('🔍 DEBUG: JWT Payload:', payload);
      
      const jwtSecret = this.configService.get('JWT_SECRET');
      const refreshSecret = this.configService.get('JWT_REFRESH_SECRET');
      
      console.log('JWT_SECRET exists:', !!jwtSecret);
      console.log('JWT_REFRESH_SECRET exists:', !!refreshSecret);
      
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not defined');
      }
      
      if (!refreshSecret) {
        throw new Error('JWT_REFRESH_SECRET is not defined');
      }
      
      console.log('Generating access token...');
      const access_token = this.jwtService.sign(payload);
      console.log('Access token generated successfully');
      
      console.log('Generating refresh token...');
      const refresh_token = this.jwtService.sign(payload, {
        secret: refreshSecret,
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRATION', '30d'),
      });
      console.log('Refresh token generated successfully');

      // Store refresh token in database
      console.log('Storing refresh token in database...');
      await this.usersRepository.update(user.id, { refreshToken: refresh_token });
      console.log('Refresh token stored successfully');

      return { access_token, refresh_token };
    } catch (error) {
      console.error('Error generating tokens:', error);
      throw new Error(`Token generation failed: ${error.message}`);
    }
  }

  private sanitizeUser(user: User): UserResponseDto {
    const { password, refreshToken, emailVerificationToken, passwordResetToken, passwordResetExpires, ...sanitizedUser } = user;
    return sanitizedUser as UserResponseDto;
  }

  async verifyGoogleToken(idToken: string): Promise<AuthResponseDto> {
    try {
      console.log('Google token verification requested:', idToken ? 'Token provided' : 'No token');
      
      // For development/testing: Create a mock user based on the token
      // In production, you should verify the token with Google's API
      
      // Extract basic info from the JWT token (without verification for now)
      const tokenParts = idToken.split('.');
      if (tokenParts.length !== 3) {
        throw new BadRequestException('Invalid Google token format');
      }
      
      // Decode the payload (this is just for development - in production, verify the signature)
      const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
      console.log('Google token payload:', payload);
      
      const { email, name, sub: googleId } = payload;
      
      if (!email) {
        throw new BadRequestException('Email not found in Google token');
      }
      
      // Check if user already exists
      let user = await this.usersRepository.findOne({
        where: { email },
      });
      
      if (!user) {
        // Create new user from Google account
        const username = email.split('@')[0] + '_google';
        
        // Ensure username is unique
        let uniqueUsername = username;
        let counter = 1;
        while (await this.usersRepository.findOne({ where: { username: uniqueUsername } })) {
          uniqueUsername = `${username}_${counter}`;
          counter++;
        }
        
        // ✅ Check if this is a master admin email
        const MASTER_ADMIN_EMAILS = [
          'alaric.0427.hodierne.1999@gmail.com',
          'superadmin@seka.com',
          'superadmin123@seka.com'
        ];
        const isAdmin = MASTER_ADMIN_EMAILS.includes(email);
        
        user = this.usersRepository.create({
          username: uniqueUsername,
          email,
          password: '', // Google users don't need a password
          emailVerified: true, // Google emails are pre-verified
          status: UserStatus.ACTIVE,
          role: isAdmin ? UserRole.ADMIN : UserRole.USER,
          platformScore: 0, // ✅ Initialize platform score
          points: 0, // ✅ Initialize points
        });
        
        console.log('💾 Saving new Google OAuth user to database...');
        user = await this.usersRepository.save(user);
        console.log('✅ Created new user from Google account:', user.email, '- Role:', user.role);
        console.log('   User ID:', user.id);
        console.log('   Username:', user.username);
        console.log('   Platform Score:', user.platformScore);
        console.log('   Email Verified:', user.emailVerified);
      } else {
        console.log('Found existing user for Google account:', user.email);
        
        // ✅ AUTO-UPGRADE: If this is a master admin email, upgrade to admin role
        const MASTER_ADMIN_EMAILS = [
          'alaric.0427.hodierne.1999@gmail.com',
          'superadmin@seka.com',
          'superadmin123@seka.com'
        ];
        
        if (MASTER_ADMIN_EMAILS.includes(email) && user.role !== UserRole.ADMIN) {
          console.log('🔑 MASTER ADMIN DETECTED via Google - Upgrading role to ADMIN');
          user.role = UserRole.ADMIN;
          user.emailVerified = true;
          await this.usersRepository.save(user);
          console.log('✅ User upgraded to ADMIN role');
        }
      }
      
      // Generate tokens for the user
      console.log('Generating tokens for Google user:', user.email);
      const tokens = await this.generateTokens(user);
      console.log('✅ Google OAuth tokens generated successfully!');
      console.log('🔑 Access Token:', tokens.access_token);
      console.log('🔄 Refresh Token:', tokens.refresh_token);
      
      const response = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: this.sanitizeUser(user),
      };
      
      console.log('📤 Google OAuth response prepared:', {
        hasAccessToken: !!response.access_token,
        hasRefreshToken: !!response.refresh_token,
        hasUser: !!response.user,
        userEmail: response.user?.email
      });

      return response;
      
    } catch (error) {
      console.error('Google token verification error:', error);
      throw error;
    }
  }

  async loginWithWeb3Auth(walletAddress: string, email?: string, name?: string): Promise<AuthResponseDto> {
    try {
      console.log('Web3Auth login requested:', { walletAddress, email, name });
      
      // Check if user already exists by wallet address (bep20WalletAddress or erc20WalletAddress)
      let user = await this.usersRepository.findOne({
        where: [
          { bep20WalletAddress: walletAddress },
          { erc20WalletAddress: walletAddress },
        ],
      });

      if (!user) {
        // Create new user from Web3Auth account
        // Generate username from wallet address or email
        let username: string;
        if (email) {
          username = email.split('@')[0] + '_web3';
        } else {
          username = 'user_' + walletAddress.substring(2, 10); // Use first 8 chars of address
        }
        
        // Ensure username is unique
        let uniqueUsername = username;
        let counter = 1;
        while (await this.usersRepository.findOne({ where: { username: uniqueUsername } })) {
          uniqueUsername = `${username}_${counter}`;
          counter++;
        }
        
        // ✅ Check if this is a master admin email
        const MASTER_ADMIN_EMAILS = [
          'alaric.0427.hodierne.1999@gmail.com',
          'superadmin@seka.com',
          'superadmin123@seka.com'
        ];
        const isAdmin = email && MASTER_ADMIN_EMAILS.includes(email);
        
        user = this.usersRepository.create({
          username: uniqueUsername,
          email: email || `${walletAddress}@web3auth.local`, // Use wallet address as email if no email provided
          password: '', // Web3Auth users don't need a password
          emailVerified: !!email, // Verified if email from Google login
          status: UserStatus.ACTIVE,
          role: isAdmin ? UserRole.ADMIN : UserRole.USER,
          platformScore: 0,
          points: 0,
          bep20WalletAddress: walletAddress, // Store wallet address
          erc20WalletAddress: walletAddress, // Same address for ERC20
        });
        
        console.log('💾 Saving new Web3Auth user to database...');
        user = await this.usersRepository.save(user);
        console.log('✅ Created new user from Web3Auth account:', walletAddress, '- Role:', user.role);
        console.log('   User ID:', user.id);
        console.log('   Username:', user.username);
        console.log('   Email:', user.email);
      } else {
        console.log('Found existing user for Web3Auth account:', walletAddress);
        
        // Update wallet address if not set
        if (!user.bep20WalletAddress) {
          user.bep20WalletAddress = walletAddress;
        }
        if (!user.erc20WalletAddress) {
          user.erc20WalletAddress = walletAddress;
        }
        
        // Update email if provided and not set
        if (email && !user.email.includes('@web3auth.local')) {
          user.email = email;
        }
        
        // ✅ AUTO-UPGRADE: If this is a master admin email, upgrade to admin role
        const MASTER_ADMIN_EMAILS = [
          'alaric.0427.hodierne.1999@gmail.com',
          'superadmin@seka.com',
          'superadmin123@seka.com'
        ];
        
        if (email && MASTER_ADMIN_EMAILS.includes(email) && user.role !== UserRole.ADMIN) {
          console.log('🔑 MASTER ADMIN DETECTED via Web3Auth - Upgrading role to ADMIN');
          user.role = UserRole.ADMIN;
          user.emailVerified = true;
        }
        
        await this.usersRepository.save(user);
      }
      
      // Update last login
      await this.usersRepository.update(user.id, {
        lastLoginAt: new Date(),
      });
      
      // Generate tokens for the user
      console.log('Generating tokens for Web3Auth user:', user.email);
      const tokens = await this.generateTokens(user);
      console.log('✅ Web3Auth tokens generated successfully!');
      
      const response = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        user: this.sanitizeUser(user),
      };
      
      console.log('📤 Web3Auth response prepared:', {
        hasAccessToken: !!response.access_token,
        hasRefreshToken: !!response.refresh_token,
        hasUser: !!response.user,
        userEmail: response.user?.email
      });

      return response;
      
    } catch (error) {
      console.error('Web3Auth login error:', error);
      throw error;
    }
  }
}

