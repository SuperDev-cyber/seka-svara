const { Client } = require('pg');

// Your Neon connection string
const connectionString = 'postgresql://neondb_owner:npg_X5GFVMD6grQH@ep-crimson-mud-ahyc8cbg-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({
  connectionString: connectionString
});

console.log('🔌 Attempting to connect to Neon database...\n');

client.connect()
  .then(() => {
    console.log('✅ Successfully connected to Neon database!');
    return client.query('SELECT NOW() as current_time, version() as pg_version');
  })
  .then((res) => {
    console.log('\n📊 Database Info:');
    console.log('   Current Time:', res.rows[0].current_time);
    console.log('   PostgreSQL Version:', res.rows[0].pg_version.split(',')[0]);
    console.log('\n✅ Connection test successful!');
    client.end();
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Connection error:');
    console.error('   Error:', err.message);
    if (err.code) {
      console.error('   Error Code:', err.code);
    }
    console.error('\n💡 Troubleshooting:');
    console.error('   1. Verify your connection string is correct');
    console.error('   2. Check that your Neon project is active');
    console.error('   3. Ensure SSL mode is set correctly (sslmode=require)');
    client.end();
    process.exit(1);
  });

