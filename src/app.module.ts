import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

// Import all feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { AdminModule } from './modules/admin/admin.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { GameModule } from './modules/game/game.module';
import { TablesModule } from './modules/tables/tables.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { LeaderboardModule } from './modules/leaderboard/leaderboard.module';
import { BlockchainModule } from './modules/blockchain/blockchain.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { NftModule } from './modules/nft/nft.module';
import { EmailModule } from './modules/email/email.module';

// Import all entities explicitly
import { User } from './modules/users/entities/user.entity';
import { PlatformScoreTransaction } from './modules/users/entities/platform-score-transaction.entity';
import { Game } from './modules/game/entities/game.entity';
import { GamePlayer } from './modules/game/entities/game-player.entity';
import { GameTable } from './modules/tables/entities/game-table.entity';
import { TablePlayer } from './modules/tables/entities/table-player.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { Wallet } from './modules/wallet/entities/wallet.entity';
import { WalletTransaction } from './modules/wallet/entities/wallet-transaction.entity';
import { Transaction } from './modules/transactions/entities/transaction.entity';
import { NFT } from './modules/nft/entities/nft.entity';
import { NFTTransaction } from './modules/nft/entities/nft-transaction.entity';
import { PlatformSettings } from './modules/admin/entities/platform-settings.entity';
import { Tournament } from './modules/tournaments/entities/tournament.entity';
import { TournamentPlayer } from './modules/tournaments/entities/tournament-player.entity';

import { AppController } from './app.controller';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Support DATABASE_URL (for Neon, Render Postgres, etc.) with fallback to individual vars
        const databaseUrl = configService.get('DATABASE_URL');
        
        if (databaseUrl) {
          // Use DATABASE_URL (Neon format: postgres://user:pass@host:port/db?sslmode=require)
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [
              User,
              PlatformScoreTransaction,
              Game,
              GamePlayer,
              GameTable,
              TablePlayer,
              Notification,
              Wallet,
              WalletTransaction,
              Transaction,
              NFT,
              NFTTransaction,
              PlatformSettings,
              Tournament,
              TournamentPlayer,
            ],
            synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
            logging: configService.get('DB_LOGGING') === 'true',
            ssl: databaseUrl.includes('sslmode=require') || databaseUrl.includes('neon.tech') 
              ? { rejectUnauthorized: false } 
              : false,
          };
        }
        
        // Fallback to individual environment variables
        return {
          type: 'postgres',
          host: configService.get('DB_HOST'),
          port: configService.get('DB_PORT'),
          username: configService.get('DB_USERNAME'),
          password: configService.get('DB_PASSWORD'),
          database: configService.get('DB_NAME'),
          entities: [
            User,
            PlatformScoreTransaction,
            Game,
            GamePlayer,
            GameTable,
            TablePlayer,
            Notification,
            Wallet,
            WalletTransaction,
            Transaction,
            NFT,
            NFTTransaction,
            PlatformSettings,
            Tournament,
            TournamentPlayer,
          ],
          synchronize: configService.get('DB_SYNCHRONIZE') === 'true',
          logging: configService.get('DB_LOGGING') === 'true',
          ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
        };
      },
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    // Scheduling
    ScheduleModule.forRoot(),

    // Feature Modules - Developer 1
    AuthModule,
    UsersModule,
    AdminModule,
    NotificationsModule,

    // Feature Modules - Developer 2
    GameModule,
    TablesModule,
    WebsocketModule,
    LeaderboardModule,
    EmailModule,

    // Feature Modules - Developer 3 (temporarily disabled for testing)
    // BlockchainModule,
    WalletModule,
    // TransactionsModule,
    // NftModule,
  ],
  controllers: [AppController, HealthController],
  providers: [],
})
export class AppModule {}

