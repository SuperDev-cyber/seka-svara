import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { config } from 'dotenv';

// Load environment variables
config();

async function deleteUser() {
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

    // Find and delete the user
    const user = await userRepository.findOne({
      where: { email: 'alaric.0427.hodierne.1999@gmail.com' },
    });

    if (user) {
      console.log('\n📋 Found User:');
      console.log(`   Email: ${user.email}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   ID: ${user.id}`);
      
      await userRepository.remove(user);
      
      console.log('\n✅ User deleted successfully!');
      console.log('   You can now register again with this email.');
    } else {
      console.log('❌ User not found with email: alaric.0427.hodierne.1999@gmail.com');
    }
  } catch (error) {
    console.error('❌ Error during deletion:', error);
  } finally {
    await dataSource.destroy();
  }
}

deleteUser();

