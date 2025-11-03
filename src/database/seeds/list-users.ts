import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { config } from 'dotenv';

// Load environment variables
config();

async function listUsers() {
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

    // Find all users
    const users = await userRepository.find();

    console.log('\n📋 ALL USERS IN DATABASE:');
    console.log('═'.repeat(80));
    
    users.forEach((user, index) => {
      console.log(`\n${index + 1}. User:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Email Verified: ${user.emailVerified}`);
    });
    
    console.log('\n═'.repeat(80));
    console.log(`Total users: ${users.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
  }
}

listUsers();

