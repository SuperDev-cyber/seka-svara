import { DataSource } from 'typeorm';
import { config } from 'dotenv';

config();

async function deleteAlaricDirect() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('Database connection established');

    // Direct SQL delete
    const result = await dataSource.query(
      `DELETE FROM users WHERE email = $1 RETURNING *`,
      ['alaric.0427.hodierne.1999@gmail.com']
    );

    if (result.length > 0) {
      console.log('\n✅ DELETED USER:');
      console.log(`   Email: ${result[0].email}`);
      console.log(`   ID: ${result[0].id}`);
      console.log(`   Role: ${result[0].role}`);
      console.log(`   Username: ${result[0].username}`);
      console.log('\n🎉 Now you can login fresh and it will create an ADMIN account!');
    } else {
      console.log('❌ No user found with that email.');
    }

  } catch (error) {
    console.error('❌ Error during deletion:', error);
  } finally {
    await dataSource.destroy();
  }
}

deleteAlaricDirect();

