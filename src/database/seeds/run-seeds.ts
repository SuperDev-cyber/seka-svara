import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { UserStatus } from '../../modules/users/enums/user-status.enum';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

// Load environment variables
config();

async function runSeeds() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
    entities: [User],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    const userRepository = dataSource.getRepository(User);

    // Check if admin user already exists
    const existingAdmin = await userRepository.findOne({
      where: { email: 'admin@sekasvara.com' },
    });

    if (!existingAdmin) {
      // Create admin user
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash('Admin123!', saltRounds);

      const adminUser = userRepository.create({
        username: 'admin',
        email: 'admin@sekasvara.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        balance: 0,
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        totalWinnings: 0,
        level: 1,
        experience: 0,
      });

      await userRepository.save(adminUser);
      console.log('Admin user created successfully');
      console.log('Email: admin@sekasvara.com');
      console.log('Password: Admin123!');
    } else {
      console.log('Admin user already exists');
    }

    // Create a test user
    const existingTestUser = await userRepository.findOne({
      where: { email: 'test@sekasvara.com' },
    });

    if (!existingTestUser) {
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash('Test123!', saltRounds);

      const testUser = userRepository.create({
        username: 'testuser',
        email: 'test@sekasvara.com',
        password: hashedPassword,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        balance: 1000, // Give test user some balance
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        totalWinnings: 0,
        level: 1,
        experience: 0,
      });

      await userRepository.save(testUser);
      console.log('Test user created successfully');
      console.log('Email: test@sekasvara.com');
      console.log('Password: Test123!');
    } else {
      console.log('Test user already exists');
    }

    console.log('Seeding completed successfully');
  } catch (error) {
    console.error('Error during seeding:', error);
  } finally {
    await dataSource.destroy();
  }
}

runSeeds();
