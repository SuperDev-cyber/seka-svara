const Redis = require('ioredis');

// Your Upstash Redis connection string
// Note: Upstash requires TLS, so use 'rediss://' (with double 's') instead of 'redis://'
const connectionString = 'rediss://default:AYHTAAIncDIxNzdmNjc1NTA0MjQ0YjYyOWYwNWFmMzRmZDE0ZGZmZXAyMzMyMzU@native-jennet-33235.upstash.io:6379';

console.log('🔌 Attempting to connect to Upstash Redis...\n');

const redis = new Redis(connectionString, {
  tls: {
    // Upstash uses TLS, so we need to configure TLS
    rejectUnauthorized: false
  },
  retryStrategy: (times) => {
    // Retry strategy
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => {
  console.log('✅ Successfully connected to Upstash Redis!');
});

redis.on('error', (err) => {
  console.error('\n❌ Redis connection error:');
  console.error('   Error:', err.message);
  if (err.code) {
    console.error('   Error Code:', err.code);
  }
  console.error('\n💡 Troubleshooting:');
  console.error('   1. Verify your connection string uses rediss:// (TLS) not redis://');
  console.error('   2. Check that your Upstash database is active');
  console.error('   3. Verify the password is correct');
  process.exit(1);
});

// Test the connection
async function testConnection() {
  try {
    // Test PING command
    const pong = await redis.ping();
    console.log('   PING response:', pong);
    
    // Test SET command
    await redis.set('test:connection', 'success', 'EX', 10);
    console.log('   SET test key: success');
    
    // Test GET command
    const value = await redis.get('test:connection');
    console.log('   GET test key:', value);
    
    // Test INFO command to get server info
    const info = await redis.info('server');
    const versionLine = info.split('\n').find(line => line.startsWith('redis_version:'));
    if (versionLine) {
      console.log('   Redis Version:', versionLine.split(':')[1].trim());
    }
    
    // Clean up test key
    await redis.del('test:connection');
    
    console.log('\n✅ All Redis operations successful!');
    console.log('✅ Connection test completed successfully!\n');
    
    redis.quit();
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Redis operation error:');
    console.error('   Error:', err.message);
    redis.quit();
    process.exit(1);
  }
}

// Wait a bit for connection to establish, then run tests
setTimeout(() => {
  testConnection();
}, 1000);

