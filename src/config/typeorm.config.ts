import { DataSource } from 'typeorm';
import { config } from 'dotenv';

// Load environment variables
config();

// Support both DATABASE_URL (Neon/cloud) and individual DB vars (local dev)
const getDataSourceConfig = () => {
  // If DATABASE_URL is provided (Neon/cloud), use it directly
  if (process.env.DATABASE_URL) {
    return {
      type: 'postgres' as const,
      url: process.env.DATABASE_URL,
      entities: ['src/**/*.entity{.ts,.js}'],
      migrations: ['src/database/migrations/*{.ts,.js}'],
      synchronize: process.env.NODE_ENV !== 'production', // false in production
      logging: process.env.DB_LOGGING === 'true',
      ssl: process.env.DATABASE_URL?.includes('sslmode=require') 
        ? { rejectUnauthorized: false } 
        : process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
    };
  }

  // Fallback to individual DB vars (local development)
  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'seka_svara_db',
    entities: ['src/**/*.entity{.ts,.js}'],
    migrations: ['src/database/migrations/*{.ts,.js}'],
    synchronize: process.env.NODE_ENV !== 'production', // false in production
    logging: process.env.DB_LOGGING === 'true',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  };
};

export default new DataSource(getDataSourceConfig());
