import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { UserStatus } from '../../modules/users/enums/user-status.enum';
import { config } from 'dotenv';

// Load environment variables
config();

async function updateAlaricRole() {
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
      // Update role to ADMIN
      alaricUser.role = UserRole.ADMIN;
      alaricUser.status = UserStatus.ACTIVE;
      alaricUser.emailVerified = true;
      
      await userRepository.save(alaricUser);
      
      console.log('✅ Alaric user updated to ADMIN successfully!');
      console.log('Email: alaric.0427.hodierne.1999@gmail.com');
      console.log('Role: ADMIN ✅');
      console.log('Status: ACTIVE ✅');
      console.log('Email Verified: true ✅');
    } else {
      console.log('❌ Alaric user not found');
    }
  } catch (error) {
    console.error('❌ Error during update:', error);
  } finally {
    await dataSource.destroy();
  }
}

updateAlaricRole();

