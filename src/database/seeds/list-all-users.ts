import { DataSource } from 'typeorm';
import { User } from '../../modules/users/entities/user.entity';
import { config } from 'dotenv';

config();

async function listAllUsers() {
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
    console.log('✅ Database connection established\n');

    const userRepository = dataSource.getRepository(User);
    const users = await userRepository.find({
      select: ['id', 'username', 'email', 'role', 'status', 'emailVerified', 'balance', 'createdAt'],
      order: { createdAt: 'DESC' }
    });

    console.log('═══════════════════════════════════════════════════════════════════════════════');
    console.log(`                       📋 ALL USERS IN DATABASE (${users.length} total)`);
    console.log('═══════════════════════════════════════════════════════════════════════════════\n');

    if (users.length === 0) {
      console.log('❌ No users found in database.\n');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. User Details:`);
        console.log(`   ├─ ID: ${user.id}`);
        console.log(`   ├─ Username: ${user.username}`);
        console.log(`   ├─ Email: ${user.email}`);
        console.log(`   ├─ Role: ${user.role === 'admin' ? '👑 ADMIN' : '👤 USER'}`);
        console.log(`   ├─ Status: ${user.status}`);
        console.log(`   ├─ Email Verified: ${user.emailVerified ? '✅ Yes' : '❌ No'}`);
        console.log(`   ├─ Balance: ${user.balance} SEKA`);
        console.log(`   └─ Created: ${user.createdAt}\n`);
      });
      
      console.log('═══════════════════════════════════════════════════════════════════════════════');
      console.log(`Total users: ${users.length}`);
      console.log(`Admin users: ${users.filter(u => u.role === 'admin').length}`);
      console.log(`Regular users: ${users.filter(u => u.role === 'user').length}`);
      console.log('═══════════════════════════════════════════════════════════════════════════════\n');
    }

  } catch (error) {
    console.error('❌ Error listing users:', error.message);
  } finally {
    await dataSource.destroy();
  }
}

listAllUsers();

