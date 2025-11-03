import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { config } from 'dotenv';

// Load environment variables
config();

async function deleteAllAlaricUsers() {
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

    // Find ALL users with this email
    const users = await userRepository.find({
      where: { email: 'alaric.0427.hodierne.1999@gmail.com' },
    });

    console.log(`\n📋 Found ${users.length} user(s) with email: alaric.0427.hodierne.1999@gmail.com`);
    
    if (users.length > 0) {
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. User:`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Username: ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status}`);
      });
      
      // Delete all found users
      await userRepository.remove(users);
      
      console.log(`\n✅ Deleted ${users.length} user(s) successfully!`);
      console.log('   You can now create a fresh admin account.');
    } else {
      console.log('\n❌ No users found with that email.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await dataSource.destroy();
  }
}

deleteAllAlaricUsers();

