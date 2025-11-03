import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { UserStatus } from '../../modules/users/enums/user-status.enum';
import * as bcrypt from 'bcrypt';
import { config } from 'dotenv';

// Load environment variables
config();

async function updateAlaricPassword() {
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

    // Find Alaric user
    const alaricUser = await userRepository.findOne({
      where: { email: 'alaric.0427.hodierne.1999@gmail.com' },
    });

    if (alaricUser) {
      // Update password
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash('Kingtiger19990427!', saltRounds);
      
      alaricUser.password = hashedPassword;
      alaricUser.role = UserRole.ADMIN;
      alaricUser.status = UserStatus.ACTIVE;
      alaricUser.emailVerified = true;
      
      await userRepository.save(alaricUser);
      
      console.log('✅ Alaric admin user updated successfully!');
      console.log('Email: alaric.0427.hodierne.1999@gmail.com');
      console.log('Password: Kingtiger19990427!');
      console.log('Role: ADMIN');
    } else {
      console.log('❌ Alaric user not found, creating new one...');
      
      const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
      const hashedPassword = await bcrypt.hash('Kingtiger19990427!', saltRounds);

      const newAlaricUser = userRepository.create({
        username: 'alaric',
        email: 'alaric.0427.hodierne.1999@gmail.com',
        password: hashedPassword,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        emailVerified: true,
        balance: 10000,
        totalGamesPlayed: 0,
        totalGamesWon: 0,
        totalWinnings: 0,
        level: 1,
        experience: 0,
      });

      await userRepository.save(newAlaricUser);
      console.log('✅ Alaric admin user created successfully!');
      console.log('Email: alaric.0427.hodierne.1999@gmail.com');
      console.log('Password: Kingtiger19990427!');
    }
  } catch (error) {
    console.error('❌ Error during update:', error);
  } finally {
    await dataSource.destroy();
  }
}

updateAlaricPassword();

