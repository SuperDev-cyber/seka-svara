import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserStatus } from './enums/user-status.enum';
import { WalletService } from '../wallet/wallet.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private walletService: WalletService,
  ) {}

  async findAll(page: number = 1, limit: number = 10) {
    // TODO: Implement pagination
    const [users, total] = await this.usersRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      select: ['id', 'username', 'email', 'role', 'status', 'createdAt'],
    });

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string) {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findOne({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // ✅ Ensure balance and platformScore are returned as numbers, not strings
    // TypeORM decimal columns can return as strings, causing string concatenation bugs (e.g., "100100" instead of 200)
    return {
      ...user,
      balance: Number(user.balance) || 0,
      platformScore: Number(user.platformScore) || 0,
      points: Number(user.points) || 0,
      totalWinnings: Number(user.totalWinnings) || 0,
    };
  }

  async findByEmail(email: string) {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByUsername(username: string) {
    return this.usersRepository.findOne({ where: { username } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    // TODO: Implement update logic
    const user = await this.findOne(id);
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string) {
    const user = await this.findOne(id);
    await this.usersRepository.remove(user);
    return { message: 'User deleted successfully' };
  }

  async banUser(id: string) {
    // TODO: Implement ban logic
    const user = await this.findOne(id);
    user.status = UserStatus.BANNED;
    await this.usersRepository.save(user);
    return { message: 'User banned successfully' };
  }

  async unbanUser(id: string) {
    // TODO: Implement unban logic
    const user = await this.findOne(id);
    user.status = UserStatus.ACTIVE;
    await this.usersRepository.save(user);
    return { message: 'User unbanned successfully' };
  }

  /**
   * Generate wallet addresses for a user
   */
  async generateWalletAddresses(userId: string) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Generate addresses if they don't exist
    const addresses = {
      BEP20: user.bep20WalletAddress || await this.walletService.generateDepositAddress(userId, 'BEP20'),
      ERC20: user.erc20WalletAddress || await this.walletService.generateDepositAddress(userId, 'BEP20'), // Using BEP20 for ERC20 (both Ethereum-compatible)
    };

    // Update user with generated addresses
    await this.update(userId, {
      bep20WalletAddress: addresses.BEP20,
      erc20WalletAddress: addresses.ERC20,
    });

    return addresses;
  }
}
