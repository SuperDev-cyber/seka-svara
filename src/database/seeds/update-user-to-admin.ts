import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { UserRole } from '../../modules/users/enums/user-role.enum';
import { config } from 'dotenv';

// Load environment variables
config();

async function updateUserToAdmin() {
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

    // Find the user
    const user = await userRepository.findOne({
      where: { email: 'alaric.0427.hodierne.1999@gmail.com' },
    });

    if (user) {
      console.log('\n📋 Current User Info:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Current Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      
      // Update role to ADMIN
      user.role = UserRole.ADMIN;
      
      await userRepository.save(user);
      
      console.log('\n✅ User role updated successfully!');
      console.log(`   New Role: ${user.role}`);
      console.log('\n🔄 Please logout and login again for changes to take effect.');
    } else {
      console.log('❌ User not found with email: alaric.0427.hodierne.1999@gmail.com');
    }
  } catch (error) {
    console.error('❌ Error during update:', error);
  } finally {
    await dataSource.destroy();
  }
}

updateUserToAdmin();

