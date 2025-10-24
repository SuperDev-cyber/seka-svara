# 🎯 DEVELOPER 3 - PRODUCTION-READY TASKS (3 DAYS)

**Your Role:** Authentication, Security, Users, Admin Panel, Notifications  
**Experience Level:** Senior (10+ years) + AI Assistance  
**Goal:** Perfect, production-ready system  
**No Compromises:** Full features, complete security, comprehensive testing  
**⚠️ Environment:** Using Manual PostgreSQL Setup (NO Docker)  
**📖 Setup Guide:** See `DEVELOPER_3_MANUAL_SETUP.md` - Complete this FIRST!

---

## 📋 COMPLETE RESPONSIBILITY

You own the entire **user layer** and **security layer** of the platform:

### **Your Modules:**
1. **Authentication** (advanced, production-grade)
2. **User Management** (complete CRUD + profiles)
3. **Admin Panel** (full-featured, analytics, fraud detection)
4. **Security** (RBAC, guards, rate limiting, CSRF, XSS)
5. **Notifications** (email, push, SMS, in-app)
6. **KYC/AML** (verification system)
7. **Support System** (ticket management)

---

## 🚀 DAY 1 (24 HOURS) - FOUNDATION

### **PHASE 1: Advanced Authentication System (8 hours)**

#### **Task 1.1: JWT with Refresh Token (2 hours)**

```typescript
// src/modules/auth/strategies/jwt.strategy.ts
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
      algorithms: ['RS256'], // Use asymmetric encryption
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }
    return user;
  }
}

// Refresh token strategy
@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refresh_token'),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_REFRESH_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.body.refresh_token;
    const user = await this.usersService.findById(payload.sub);
    
    if (!user || user.currentRefreshToken !== refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    
    return user;
  }
}
```

```typescript
// src/modules/auth/auth.service.ts
@Injectable()
export class AuthService {
  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const tokens = await this.generateTokens(user);
    
    // Store refresh token (hashed)
    await this.updateRefreshToken(user.id, tokens.refresh_token);
    
    // Log login activity
    await this.logActivity(user.id, 'login', req.ip);
    
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_in: 900, // 15 minutes
      user: this.sanitizeUser(user),
    };
  }

  async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '15m',
        algorithm: 'RS256',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.usersService.findById(userId);
    
    // Verify stored refresh token
    const isValid = await bcrypt.compare(refreshToken, user.currentRefreshToken);
    if (!isValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = await this.generateTokens(user);
    
    // Rotate refresh token
    await this.updateRefreshToken(user.id, tokens.refresh_token);
    
    return tokens;
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedToken = await bcrypt.hash(refreshToken, 10);
    await this.usersService.update(userId, {
      currentRefreshToken: hashedToken,
      lastLoginAt: new Date(),
    });
  }
}
```

#### **Task 1.2: 2FA (TOTP) Implementation (2 hours)**

```typescript
// src/modules/auth/services/two-factor.service.ts
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';

@Injectable()
export class TwoFactorService {
  async generateSecret(user: User) {
    const secret = speakeasy.generateSecret({
      name: `Seka Svara (${user.email})`,
      issuer: 'Seka Svara',
    });

    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);

    // Save secret (encrypted)
    await this.usersService.update(user.id, {
      twoFactorSecret: this.encryptSecret(secret.base32),
    });

    return {
      secret: secret.base32,
      qrCode,
    };
  }

  async verifyToken(user: User, token: string): Promise<boolean> {
    const decryptedSecret = this.decryptSecret(user.twoFactorSecret);
    
    return speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 time steps before/after
    });
  }

  async enableTwoFactor(user: User, token: string) {
    const isValid = await this.verifyToken(user, token);
    
    if (!isValid) {
      throw new BadRequestException('Invalid 2FA token');
    }

    await this.usersService.update(user.id, {
      twoFactorEnabled: true,
    });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes();
    await this.saveBackupCodes(user.id, backupCodes);

    return { backupCodes };
  }

  private generateBackupCodes(count = 10): string[] {
    return Array.from({ length: count }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );
  }

  private encryptSecret(secret: string): string {
    // Use crypto to encrypt
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.configService.get('ENCRYPTION_KEY'), 'hex'),
      Buffer.from(this.configService.get('ENCRYPTION_IV'), 'hex'),
    );
    
    let encrypted = cipher.update(secret, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  }
}
```

#### **Task 1.3: OAuth Integration (Google, Facebook) (2 hours)**

```typescript
// src/modules/auth/strategies/google.strategy.ts
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;

    const user = await this.authService.validateOAuthUser({
      provider: 'google',
      providerId: id,
      email: emails[0].value,
      firstName: name.givenName,
      lastName: name.familyName,
      avatar: photos[0].value,
    });

    done(null, user);
  }
}

// Facebook strategy (similar implementation)
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  // Similar to Google
}

// OAuth service
@Injectable()
export class OAuthService {
  async validateOAuthUser(profile: OAuthProfile) {
    // Check if user exists by provider ID
    let user = await this.usersService.findByOAuth(
      profile.provider,
      profile.providerId,
    );

    if (!user) {
      // Check if email exists
      user = await this.usersService.findByEmail(profile.email);
      
      if (user) {
        // Link OAuth account to existing user
        await this.linkOAuthAccount(user.id, profile);
      } else {
        // Create new user
        user = await this.createOAuthUser(profile);
      }
    }

    return user;
  }

  private async createOAuthUser(profile: OAuthProfile) {
    return this.usersService.create({
      email: profile.email,
      username: this.generateUsername(profile.email),
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatar: profile.avatar,
      emailVerified: true, // OAuth emails are pre-verified
      oAuthProviders: [{
        provider: profile.provider,
        providerId: profile.providerId,
      }],
    });
  }
}
```

#### **Task 1.4: Email Verification & Password Reset (2 hours)**

```typescript
// src/modules/auth/services/email-verification.service.ts
@Injectable()
export class EmailVerificationService {
  async sendVerificationEmail(user: User) {
    const token = await this.generateVerificationToken(user.id);
    const link = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;

    await this.emailService.send({
      to: user.email,
      subject: 'Verify your email - Seka Svara',
      template: 'email-verification',
      context: {
        name: user.firstName,
        link,
      },
    });
  }

  async verifyEmail(token: string) {
    const payload = await this.verifyToken(token);
    const user = await this.usersService.findById(payload.userId);

    if (user.emailVerified) {
      throw new BadRequestException('Email already verified');
    }

    await this.usersService.update(user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
    });

    return { message: 'Email verified successfully' };
  }

  private async generateVerificationToken(userId: string): Promise<string> {
    return this.jwtService.sign(
      { userId, type: 'email-verification' },
      { expiresIn: '24h' },
    );
  }
}

// Password reset service
@Injectable()
export class PasswordResetService {
  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      // Don't reveal if email exists
      return { message: 'If the email exists, reset link has been sent' };
    }

    const token = await this.generateResetToken(user.id);
    const link = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;

    await this.emailService.send({
      to: user.email,
      subject: 'Reset your password - Seka Svara',
      template: 'password-reset',
      context: {
        name: user.firstName,
        link,
      },
    });

    // Log the request
    await this.logPasswordResetRequest(user.id);

    return { message: 'If the email exists, reset link has been sent' };
  }

  async resetPassword(token: string, newPassword: string) {
    const payload = await this.verifyToken(token);
    const user = await this.usersService.findById(payload.userId);

    // Check password history (prevent reuse)
    await this.checkPasswordHistory(user.id, newPassword);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await this.usersService.update(user.id, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    });

    // Add to password history
    await this.addToPasswordHistory(user.id, hashedPassword);

    // Invalidate all refresh tokens
    await this.invalidateAllSessions(user.id);

    // Send notification email
    await this.emailService.send({
      to: user.email,
      subject: 'Your password has been changed',
      template: 'password-changed',
    });

    return { message: 'Password reset successfully' };
  }

  private async checkPasswordHistory(userId: string, newPassword: string) {
    const history = await this.passwordHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 5, // Check last 5 passwords
    });

    for (const entry of history) {
      const isSame = await bcrypt.compare(newPassword, entry.password);
      if (isSame) {
        throw new BadRequestException(
          'Cannot reuse any of your last 5 passwords',
        );
      }
    }
  }
}
```

---

### **PHASE 2: User Management (8 hours)**

#### **Task 2.1: Complete User Entity (1 hour)**

```typescript
// src/modules/users/entities/user.entity.ts
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  username: string;

  @Column({ nullable: true, select: false })
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: false })
  phoneVerified: boolean;

  @Column({ default: false })
  emailVerified: boolean;

  @Column({ nullable: true })
  emailVerifiedAt: Date;

  @Column({ type: 'enum', enum: Role, default: Role.USER })
  role: Role;

  @Column('json', { default: [] })
  permissions: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ nullable: true })
  bannedReason: string;

  @Column({ nullable: true })
  bannedUntil: Date;

  @Column({ default: false })
  twoFactorEnabled: boolean;

  @Column({ nullable: true, select: false })
  twoFactorSecret: string;

  @Column('json', { nullable: true })
  oAuthProviders: OAuthProvider[];

  @Column({ nullable: true, select: false })
  currentRefreshToken: string;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @Column({ nullable: true })
  lastLoginIp: string;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ nullable: true })
  lockedUntil: Date;

  @Column({ nullable: true })
  passwordChangedAt: Date;

  @Column('json', { nullable: true })
  preferences: UserPreferences;

  @Column('json', { nullable: true })
  kycData: KYCData;

  @Column({ type: 'enum', enum: KYCStatus, default: KYCStatus.NOT_SUBMITTED })
  kycStatus: KYCStatus;

  @Column({ nullable: true })
  kycVerifiedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;

  // Relations
  @OneToOne(() => Wallet, wallet => wallet.user)
  wallet: Wallet;

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions: Transaction[];

  @OneToMany(() => GamePlayer, gamePlayer => gamePlayer.user)
  games: GamePlayer[];

  @OneToMany(() => Notification, notification => notification.user)
  notifications: Notification[];
}

// Enums
export enum Role {
  USER = 'user',
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  SUPPORT = 'support',
}

export enum KYCStatus {
  NOT_SUBMITTED = 'not_submitted',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}
```

#### **Task 2.2: Profile Management (2 hours)**

```typescript
// src/modules/users/users.service.ts
@Injectable()
export class UsersService {
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Validate inputs
    if (dto.email && dto.email !== user.email) {
      // Check if email is available
      const existingUser = await this.findByEmail(dto.email);
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
      
      // Mark email as unverified
      dto.emailVerified = false;
      
      // Send verification email
      await this.emailVerificationService.sendVerificationEmail(user);
    }

    if (dto.username && dto.username !== user.username) {
      // Check if username is available
      const existingUser = await this.findByUsername(dto.username);
      if (existingUser) {
        throw new ConflictException('Username already taken');
      }
    }

    // Update user
    const updated = await this.usersRepository.update(userId, dto);

    // Log activity
    await this.activityService.log({
      userId,
      action: 'profile_updated',
      metadata: { changes: Object.keys(dto) },
    });

    return this.findById(userId);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File) {
    // Validate file
    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File must be an image');
    }

    // Resize and optimize
    const optimized = await this.imageService.optimize(file.buffer, {
      width: 400,
      height: 400,
      quality: 85,
      format: 'webp',
    });

    // Upload to S3
    const url = await this.s3Service.upload({
      bucket: 'user-avatars',
      key: `${userId}/avatar-${Date.now()}.webp`,
      body: optimized,
      contentType: 'image/webp',
      acl: 'public-read',
    });

    // Delete old avatar
    const user = await this.findById(userId);
    if (user.avatar) {
      await this.s3Service.delete(user.avatar);
    }

    // Update user
    await this.usersRepository.update(userId, { avatar: url });

    return { avatar: url };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.findById(userId, { select: ['password'] });

    // Verify current password
    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Check password strength
    const strength = zxcvbn(dto.newPassword);
    if (strength.score < 3) {
      throw new BadRequestException('Password is too weak');
    }

    // Check password history
    await this.passwordResetService.checkPasswordHistory(userId, dto.newPassword);

    // Hash new password
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    // Update password
    await this.usersRepository.update(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
    });

    // Add to history
    await this.passwordResetService.addToPasswordHistory(userId, hashedPassword);

    // Invalidate all sessions except current
    await this.authService.invalidateOtherSessions(userId, currentSessionId);

    // Send notification
    await this.emailService.send({
      to: user.email,
      subject: 'Password changed',
      template: 'password-changed',
    });

    return { message: 'Password changed successfully' };
  }
}
```

#### **Task 2.3: KYC/AML System (3 hours)**

```typescript
// src/modules/users/services/kyc.service.ts
@Injectable()
export class KYCService {
  async submitKYC(userId: string, dto: SubmitKYCDto, files: KYCFiles) {
    const user = await this.usersService.findById(userId);

    if (user.kycStatus === KYCStatus.APPROVED) {
      throw new BadRequestException('KYC already approved');
    }

    // Upload documents to secure storage
    const documentUrls = await this.uploadKYCDocuments(userId, files);

    // Extract data from documents (using OCR)
    const extractedData = await this.extractDocumentData(documentUrls);

    // Verify against provided data
    const isMatching = this.verifyDataMatch(dto, extractedData);
    if (!isMatching) {
      throw new BadRequestException('Document data does not match provided information');
    }

    // Perform identity verification (using external service)
    const verificationResult = await this.identityVerificationService.verify({
      firstName: dto.firstName,
      lastName: dto.lastName,
      dateOfBirth: dto.dateOfBirth,
      documentNumber: dto.documentNumber,
      documentType: dto.documentType,
      country: dto.country,
    });

    // Check against sanctions lists
    const sanctionsCheck = await this.sanctionsService.check({
      name: `${dto.firstName} ${dto.lastName}`,
      dateOfBirth: dto.dateOfBirth,
      country: dto.country,
    });

    if (sanctionsCheck.isMatch) {
      await this.usersService.update(userId, {
        kycStatus: KYCStatus.REJECTED,
        isBanned: true,
        bannedReason: 'Sanctions list match',
      });
      
      throw new ForbiddenException('KYC verification failed');
    }

    // Calculate risk score
    const riskScore = await this.calculateRiskScore(user, dto, verificationResult);

    // Save KYC data
    await this.usersService.update(userId, {
      kycData: {
        ...dto,
        documentUrls,
        extractedData,
        verificationResult,
        sanctionsCheck,
        riskScore,
        submittedAt: new Date(),
      },
      kycStatus: riskScore < 50 ? KYCStatus.APPROVED : KYCStatus.PENDING,
      kycVerifiedAt: riskScore < 50 ? new Date() : null,
    });

    // Notify admins if manual review needed
    if (riskScore >= 50) {
      await this.notifyAdminsForReview(userId, riskScore);
    }

    return {
      status: riskScore < 50 ? 'approved' : 'pending_review',
      message: riskScore < 50 
        ? 'KYC approved automatically'
        : 'KYC submitted for manual review',
    };
  }

  private async calculateRiskScore(user: User, kycData: any, verificationResult: any): Promise<number> {
    let score = 0;

    // Age check
    const age = this.calculateAge(kycData.dateOfBirth);
    if (age < 21) score += 20;
    if (age > 80) score += 10;

    // Country risk
    const countryRisk = await this.getCountryRisk(kycData.country);
    score += countryRisk;

    // Document verification confidence
    if (verificationResult.confidence < 0.8) score += 30;

    // Account age
    const accountAgeInDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAgeInDays < 7) score += 15;

    // Previous failed attempts
    const previousAttempts = await this.countPreviousKYCAttempts(user.id);
    score += previousAttempts * 10;

    return Math.min(score, 100);
  }

  private async uploadKYCDocuments(userId: string, files: KYCFiles) {
    const urls = {};

    for (const [key, file] of Object.entries(files)) {
      // Encrypt file
      const encrypted = await this.encryptFile(file.buffer);

      // Upload to secure S3 bucket (private)
      const url = await this.s3Service.upload({
        bucket: 'kyc-documents',
        key: `${userId}/${key}-${Date.now()}.encrypted`,
        body: encrypted,
        encryption: 'AES256',
        acl: 'private',
      });

      urls[key] = url;
    }

    return urls;
  }

  private async extractDocumentData(documentUrls: any) {
    // Use OCR service (AWS Textract, Google Vision, etc.)
    const results = {};

    for (const [type, url] of Object.entries(documentUrls)) {
      const text = await this.ocrService.extract(url);
      results[type] = this.parseDocument(text, type);
    }

    return results;
  }
}
```

#### **Task 2.4: RBAC & Permissions (2 hours)**

```typescript
// src/common/decorators/roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// src/common/decorators/permissions.decorator.ts
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

// src/common/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.some(role => user.role === role);
  }
}

// src/common/guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private caslAbilityFactory: CaslAbilityFactory,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const ability = this.caslAbilityFactory.createForUser(user);

    return requiredPermissions.every(permission => {
      const [action, subject] = permission.split(':');
      return ability.can(action, subject);
    });
  }
}

// src/modules/auth/casl/casl-ability.factory.ts
@Injectable()
export class CaslAbilityFactory {
  createForUser(user: User) {
    const { can, cannot, build } = new AbilityBuilder(Ability);

    if (user.role === Role.ADMIN) {
      can('manage', 'all'); // Admin can do everything
    } else if (user.role === Role.MODERATOR) {
      can('read', 'all');
      can('update', 'User', { isBanned: false });
      can('update', 'GameTable');
      can('delete', 'Message');
    } else if (user.role === Role.SUPPORT) {
      can('read', 'User');
      can('read', 'Transaction');
      can('create', 'SupportTicket');
      can('update', 'SupportTicket');
    } else {
      // Regular user
      can('read', 'User', { id: user.id });
      can('update', 'User', { id: user.id });
      can('create', 'GameTable');
      can('read', 'GameTable');
      can('create', 'Transaction', { userId: user.id });
      can('read', 'Transaction', { userId: user.id });
    }

    // Custom permissions from user.permissions array
    user.permissions.forEach(permission => {
      const [action, subject] = permission.split(':');
      can(action as any, subject);
    });

    return build();
  }
}

// Usage in controllers
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminUsersController {
  @Get()
  @RequirePermissions('read:users')
  async getAllUsers() {
    // ...
  }

  @Delete(':id')
  @RequirePermissions('delete:users')
  async deleteUser(@Param('id') id: string) {
    // ...
  }
}
```

---

### **PHASE 3: Admin Panel & Security (8 hours)**

#### **Task 3.1: Admin Dashboard with Analytics (3 hours)**

```typescript
// src/modules/admin/admin.service.ts
@Injectable()
export class AdminService {
  async getDashboardStats() {
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      totalGames,
      activeGames,
      totalRevenue,
      revenueToday,
      totalTransactions,
      pendingWithdrawals,
      kycPending,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { isActive: true } }),
      this.usersRepo.count({
        where: { createdAt: MoreThan(startOfDay(new Date())) },
      }),
      this.gamesRepo.count(),
      this.gamesRepo.count({ where: { status: GameStatus.ACTIVE } }),
      this.calculateTotalRevenue(),
      this.calculateRevenueToday(),
      this.transactionsRepo.count(),
      this.transactionsRepo.count({
        where: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
        },
      }),
      this.usersRepo.count({ where: { kycStatus: KYCStatus.PENDING } }),
    ]);

    // Get time-series data for charts
    const userGrowth = await this.getUserGrowthData();
    const revenueChart = await this.getRevenueChartData();
    const gameStats = await this.getGameStatistics();

    return {
      overview: {
        totalUsers,
        activeUsers,
        newUsersToday,
        totalGames,
        activeGames,
        totalRevenue,
        revenueToday,
        totalTransactions,
        pendingWithdrawals,
        kycPending,
      },
      charts: {
        userGrowth,
        revenue: revenueChart,
        games: gameStats,
      },
      alerts: await this.getSystemAlerts(),
    };
  }

  private async getUserGrowthData(days = 30) {
    const result = await this.usersRepo
      .createQueryBuilder('user')
      .select('DATE(user.createdAt)', 'date')
      .addSelect('COUNT(*)', 'count')
      .where('user.createdAt > :startDate', {
        startDate: subDays(new Date(), days),
      })
      .groupBy('DATE(user.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map(row => ({
      date: row.date,
      count: parseInt(row.count),
    }));
  }

  private async getRevenueChartData(days = 30) {
    const result = await this.transactionsRepo
      .createQueryBuilder('tx')
      .select('DATE(tx.createdAt)', 'date')
      .addSelect('SUM(CASE WHEN tx.type = :deposit THEN tx.amount ELSE 0 END)', 'deposits')
      .addSelect('SUM(CASE WHEN tx.type = :withdrawal THEN tx.amount ELSE 0 END)', 'withdrawals')
      .addSelect('SUM(CASE WHEN tx.type = :platformFee THEN tx.amount ELSE 0 END)', 'fees')
      .where('tx.createdAt > :startDate', {
        startDate: subDays(new Date(), days),
      })
      .setParameters({
        deposit: TransactionType.DEPOSIT,
        withdrawal: TransactionType.WITHDRAWAL,
        platformFee: TransactionType.PLATFORM_FEE,
      })
      .groupBy('DATE(tx.createdAt)')
      .orderBy('date', 'ASC')
      .getRawMany();

    return result.map(row => ({
      date: row.date,
      deposits: parseFloat(row.deposits) || 0,
      withdrawals: parseFloat(row.withdrawals) || 0,
      fees: parseFloat(row.fees) || 0,
      net: (parseFloat(row.deposits) || 0) - (parseFloat(row.withdrawals) || 0),
    }));
  }

  async getSystemAlerts() {
    const alerts = [];

    // Check for high pending withdrawals
    const pendingWithdrawalAmount = await this.transactionsRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.amount)', 'total')
      .where('tx.type = :type', { type: TransactionType.WITHDRAWAL })
      .andWhere('tx.status = :status', { status: TransactionStatus.PENDING })
      .getRawOne();

    if (parseFloat(pendingWithdrawalAmount.total) > 10000) {
      alerts.push({
        type: 'warning',
        message: `High pending withdrawals: $${pendingWithdrawalAmount.total}`,
        action: 'Review pending withdrawals',
      });
    }

    // Check for failed login attempts
    const recentFailedLogins = await this.usersRepo.count({
      where: {
        failedLoginAttempts: MoreThan(5),
        lastLoginAt: MoreThan(subHours(new Date(), 1)),
      },
    });

    if (recentFailedLogins > 10) {
      alerts.push({
        type: 'danger',
        message: `${recentFailedLogins} accounts with multiple failed logins`,
        action: 'Possible brute force attack',
      });
    }

    // Check for suspended games
    const suspendedGames = await this.gamesRepo.count({
      where: { status: GameStatus.SUSPENDED },
    });

    if (suspendedGames > 0) {
      alerts.push({
        type: 'info',
        message: `${suspendedGames} games suspended`,
        action: 'Review suspended games',
      });
    }

    // Check system health
    const dbHealth = await this.checkDatabaseHealth();
    const redisHealth = await this.checkRedisHealth();

    if (!dbHealth.healthy) {
      alerts.push({
        type: 'danger',
        message: 'Database performance degraded',
        action: 'Check database connection pool',
      });
    }

    if (!redisHealth.healthy) {
      alerts.push({
        type: 'danger',
        message: 'Redis performance degraded',
        action: 'Check Redis memory usage',
      });
    }

    return alerts;
  }
}
```

#### **Task 3.2: Fraud Detection System (2 hours)**

```typescript
// src/modules/admin/services/fraud-detection.service.ts
@Injectable()
export class FraudDetectionService {
  async analyzeUser(userId: string): Promise<FraudScore> {
    const user = await this.usersService.findById(userId);
    const transactions = await this.getRecentTransactions(userId);
    const games = await this.getRecentGames(userId);

    let score = 0;
    const flags = [];

    // Multiple accounts from same IP
    const sameIPUsers = await this.findUsersWithSameIP(user.lastLoginIp);
    if (sameIPUsers.length > 3) {
      score += 25;
      flags.push('Multiple accounts from same IP');
    }

    // Rapid deposit/withdrawal pattern
    const depositWithdrawPattern = this.analyzeDepositWithdrawPattern(transactions);
    if (depositWithdrawPattern.suspicious) {
      score += 30;
      flags.push('Suspicious deposit/withdrawal pattern');
    }

    // Win rate analysis
    const winRate = this.calculateWinRate(games);
    if (winRate > 0.85) {
      score += 35;
      flags.push(`Unusually high win rate: ${(winRate * 100).toFixed(1)}%`);
    }

    // New account with large transactions
    const accountAgeInDays = (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    const totalTransactionAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    if (accountAgeInDays < 7 && totalTransactionAmount > 5000) {
      score += 20;
      flags.push('New account with high transaction volume');
    }

    // Failed verification attempts
    if (user.kycStatus === KYCStatus.REJECTED) {
      score += 15;
      flags.push('KYC verification failed');
    }

    // Suspicious timing (all transactions at odd hours)
    const oddHourPercentage = this.calculateOddHourTransactions(transactions);
    if (oddHourPercentage > 0.8) {
      score += 10;
      flags.push('Most transactions during unusual hours');
    }

    // Collusion detection (always playing with same users)
    const collusionScore = await this.detectCollusion(userId, games);
    if (collusionScore > 50) {
      score += 25;
      flags.push('Possible collusion detected');
    }

    // Bonus abuse
    const bonusAbuseScore = await this.detectBonusAbuse(userId);
    if (bonusAbuseScore > 50) {
      score += 20;
      flags.push('Possible bonus abuse');
    }

    const riskLevel = this.calculateRiskLevel(score);

    // Auto-actions based on risk level
    if (riskLevel === 'critical') {
      await this.suspendUser(userId, 'Automatic suspension due to high fraud score');
      await this.notifyAdmins(userId, score, flags);
    } else if (riskLevel === 'high') {
      await this.flagUserForReview(userId, score, flags);
    }

    return {
      score,
      riskLevel,
      flags,
      timestamp: new Date(),
    };
  }

  private analyzeDepositWithdrawPattern(transactions: Transaction[]) {
    // Look for money laundering patterns:
    // - Deposit → immediate withdrawal
    // - Many small deposits followed by large withdrawal
    // - Round-trip transactions

    const deposits = transactions.filter(tx => tx.type === TransactionType.DEPOSIT);
    const withdrawals = transactions.filter(tx => tx.type === TransactionType.WITHDRAWAL);

    let suspicious = false;
    const reasons = [];

    // Check for immediate withdrawals
    for (const withdrawal of withdrawals) {
      const recentDeposit = deposits.find(dep => 
        Math.abs(dep.createdAt.getTime() - withdrawal.createdAt.getTime()) < 3600000 && // Within 1 hour
        Math.abs(dep.amount - withdrawal.amount) < 10 // Similar amounts
      );

      if (recentDeposit) {
        suspicious = true;
        reasons.push('Deposit followed by immediate withdrawal');
      }
    }

    // Check for structuring (many small deposits)
    const smallDeposits = deposits.filter(dep => dep.amount < 1000);
    if (smallDeposits.length > 10) {
      const totalSmall = smallDeposits.reduce((sum, dep) => sum + dep.amount, 0);
      const largeWithdrawals = withdrawals.filter(wd => wd.amount > totalSmall * 0.8);
      
      if (largeWithdrawals.length > 0) {
        suspicious = true;
        reasons.push('Multiple small deposits followed by large withdrawal');
      }
    }

    return { suspicious, reasons };
  }

  private async detectCollusion(userId: string, games: Game[]): Promise<number> {
    // Detect if user always plays with the same opponents
    const opponents = new Map<string, number>();

    for (const game of games) {
      const otherPlayers = game.players.filter(p => p.userId !== userId);
      
      for (const player of otherPlayers) {
        opponents.set(
          player.userId,
          (opponents.get(player.userId) || 0) + 1
        );
      }
    }

    // Calculate collusion score
    let score = 0;
    const totalGames = games.length;

    for (const [opponentId, gamesWithOpponent] of opponents.entries()) {
      const percentage = gamesWithOpponent / totalGames;
      
      if (percentage > 0.5) {
        score += 50;
        
        // Check if they're taking turns winning
        const winPattern = await this.analyzeWinPattern(userId, opponentId, games);
        if (winPattern.suspicious) {
          score += 30;
        }
      }
    }

    return Math.min(score, 100);
  }

  private calculateRiskLevel(score: number): string {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }
}
```

#### **Task 3.3: Rate Limiting & Security (2 hours)**

```typescript
// src/common/guards/throttle.guard.ts
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Request): Promise<string> {
    // Use user ID if authenticated, otherwise IP
    return req.user?.id || req.ip;
  }

  protected async throwThrottlingException(): Promise<void> {
    throw new TooManyRequestsException('Too many requests, please try again later');
  }
}

// src/common/decorators/throttle.decorator.ts
export const CustomThrottle = (limit: number, ttl: number) =>
  applyDecorators(
    SetMetadata('throttle', { limit, ttl }),
    UseGuards(CustomThrottlerGuard),
  );

// Usage in controllers
@Controller('auth')
export class AuthController {
  @Post('login')
  @CustomThrottle(5, 60) // 5 requests per minute
  async login(@Body() dto: LoginDto) {
    // ...
  }

  @Post('register')
  @CustomThrottle(3, 3600) // 3 registrations per hour
  async register(@Body() dto: RegisterDto) {
    // ...
  }
}

// src/config/throttle.config.ts
import { ThrottlerModule } from '@nestjs/throttler';

ThrottlerModule.forRoot({
  ttl: 60,
  limit: 10,
  storage: new ThrottlerStorageRedisService(redisClient),
});

// CSRF Protection
// src/common/middleware/csrf.middleware.ts
import * as csurf from 'csurf';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    },
  });

  use(req: Request, res: Response, next: NextFunction) {
    this.csrfProtection(req, res, next);
  }
}

// XSS Protection
// src/common/pipes/sanitize.pipe.ts
import * as xss from 'xss';

@Injectable()
export class SanitizePipe implements PipeTransform {
  transform(value: any) {
    if (typeof value === 'string') {
      return xss(value);
    }
    
    if (typeof value === 'object' && value !== null) {
      const sanitized = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = this.transform(val);
      }
      return sanitized;
    }
    
    return value;
  }
}

// SQL Injection Prevention (TypeORM already handles this, but add extra layer)
// src/common/validators/sql-injection.validator.ts
export function IsSafeString() {
  return (object: Object, propertyName: string) => {
    registerDecorator({
      name: 'isSafeString',
      target: object.constructor,
      propertyName: propertyName,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return true;
          
          // Check for SQL injection patterns
          const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/gi,
            /(--|\/\*|\*\/|xp_|sp_)/gi,
            /(\bOR\b.*=.*)/gi,
            /(\bAND\b.*=.*)/gi,
          ];
          
          return !sqlPatterns.some(pattern => pattern.test(value));
        },
        defaultMessage() {
          return 'Input contains potentially dangerous characters';
        },
      },
    });
  };
}

// IP Whitelisting for Admin
// src/common/guards/ip-whitelist.guard.ts
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const clientIp = request.ip;

    const whitelist = this.configService.get<string[]>('ADMIN_IP_WHITELIST');
    
    if (!whitelist || whitelist.length === 0) {
      return true; // No whitelist configured
    }

    return whitelist.includes(clientIp);
  }
}

// Usage
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard, IpWhitelistGuard)
@Roles(Role.ADMIN)
export class AdminController {
  // Only accessible from whitelisted IPs
}
```

#### **Task 3.4: Notification System (1 hour)**

```typescript
// src/modules/notifications/notifications.service.ts
@Injectable()
export class NotificationsService {
  async sendEmail(dto: SendEmailDto) {
    return this.emailService.send({
      to: dto.to,
      subject: dto.subject,
      template: dto.template,
      context: dto.context,
    });
  }

  async sendPush(userId: string, dto: SendPushDto) {
    const user = await this.usersService.findById(userId);
    const deviceTokens = await this.getDeviceTokens(userId);

    if (deviceTokens.length === 0) {
      return { sent: false, reason: 'No device tokens' };
    }

    const message = {
      notification: {
        title: dto.title,
        body: dto.body,
      },
      data: dto.data,
      tokens: deviceTokens,
    };

    const response = await this.firebaseAdmin.messaging().sendMulticast(message);

    return {
      sent: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  }

  async sendSMS(userId: string, message: string) {
    const user = await this.usersService.findById(userId);

    if (!user.phone || !user.phoneVerified) {
      throw new BadRequestException('Phone number not verified');
    }

    const result = await this.twilioClient.messages.create({
      body: message,
      from: this.configService.get('TWILIO_PHONE_NUMBER'),
      to: user.phone,
    });

    return {
      sent: true,
      sid: result.sid,
    };
  }

  async createInAppNotification(userId: string, dto: CreateNotificationDto) {
    const notification = this.notificationsRepo.create({
      userId,
      type: dto.type,
      title: dto.title,
      message: dto.message,
      data: dto.data,
      read: false,
    });

    await this.notificationsRepo.save(notification);

    // Emit via WebSocket
    this.eventEmitter.emit('notification.created', {
      userId,
      notification,
    });

    return notification;
  }

  async getNotifications(userId: string, options: PaginationOptions) {
    const [notifications, total] = await this.notificationsRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: options.skip,
      take: options.take,
    });

    return {
      data: notifications,
      total,
      page: options.page,
      totalPages: Math.ceil(total / options.take),
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.notificationsRepo.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.read = true;
    notification.readAt = new Date();

    return this.notificationsRepo.save(notification);
  }

  async markAllAsRead(userId: string) {
    await this.notificationsRepo.update(
      { userId, read: false },
      { read: true, readAt: new Date() },
    );

    return { message: 'All notifications marked as read' };
  }
}

// Email service with templates
@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: configService.get('SMTP_HOST'),
      port: configService.get('SMTP_PORT'),
      secure: true,
      auth: {
        user: configService.get('SMTP_USER'),
        pass: configService.get('SMTP_PASS'),
      },
    });
  }

  async send(options: EmailOptions) {
    const html = await this.renderTemplate(options.template, options.context);

    const mailOptions = {
      from: `"Seka Svara" <${this.configService.get('SMTP_FROM')}>`,
      to: options.to,
      subject: options.subject,
      html,
    };

    try {
      const result = await this.transporter.sendMail(mailOptions);
      
      // Log email sent
      await this.logEmail({
        to: options.to,
        subject: options.subject,
        template: options.template,
        messageId: result.messageId,
        status: 'sent',
      });

      return result;
    } catch (error) {
      // Log email error
      await this.logEmail({
        to: options.to,
        subject: options.subject,
        template: options.template,
        status: 'failed',
        error: error.message,
      });

      throw error;
    }
  }

  private async renderTemplate(templateName: string, context: any): Promise<string> {
    // Use handlebars or similar template engine
    const template = await fs.readFile(
      path.join(__dirname, '../../templates', `${templateName}.hbs`),
      'utf-8',
    );

    const compiled = Handlebars.compile(template);
    return compiled(context);
  }
}
```

---

## 🚀 DAY 2-3 Tasks

*(Continue in next section - I'll create separate detailed files for Day 2 and Day 3)*

---

## ✅ TESTING REQUIREMENTS

### **Unit Tests (Write as you code)**
```typescript
describe('AuthService', () => {
  describe('login', () => {
    it('should return tokens for valid credentials', async () => {
      // Test implementation
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      // Test implementation
    });

    it('should increment failedLoginAttempts on failed login', async () => {
      // Test implementation
    });

    it('should lock account after 5 failed attempts', async () => {
      // Test implementation
    });
  });

  describe('2FA', () => {
    it('should generate valid TOTP secret', async () => {
      // Test implementation
    });

    it('should verify valid TOTP token', async () => {
      // Test implementation
    });

    it('should reject invalid TOTP token', async () => {
      // Test implementation
    });
  });
});
```

### **Integration Tests**
```typescript
describe('Auth Flow (e2e)', () => {
  it('complete registration and login flow', async () => {
    // Register
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@test.com',
        username: 'testuser',
        password: 'StrongPass123!',
      })
      .expect(201);

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@test.com',
        password: 'StrongPass123!',
      })
      .expect(200);

    expect(loginResponse.body).toHaveProperty('access_token');
    expect(loginResponse.body).toHaveProperty('refresh_token');
  });
});
```

---

## 📚 CODE QUALITY CHECKLIST

- [ ] All functions have TypeScript types
- [ ] All functions have JSDoc comments
- [ ] All inputs are validated (class-validator)
- [ ] All errors are handled properly
- [ ] All sensitive data is sanitized in logs
- [ ] All database queries use parameterized queries
- [ ] All passwords are hashed with bcrypt (rounds >= 10)
- [ ] All JWTs use strong secrets
- [ ] All API endpoints have rate limiting
- [ ] All admin endpoints check IP whitelist
- [ ] All file uploads are validated
- [ ] All user inputs are sanitized (XSS)
- [ ] All CSRF tokens are validated
- [ ] All tests are passing
- [ ] Code coverage >= 80%

---

**DEVELOPER 1: YOU ARE RESPONSIBLE FOR THE SECURITY OF THE ENTIRE PLATFORM.**

**NO SHORTCUTS. NO COMPROMISES. PRODUCTION-READY ONLY.** 🎯🔒


