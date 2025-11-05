import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameGateway } from './gateways/game.gateway';
import { GameModule } from '../game/game.module';
import { TablesModule } from '../tables/tables.module';
import { WalletModule } from '../wallet/wallet.module';
import { EmailModule } from '../email/email.module';
import { User } from '../users/entities/user.entity';
import { GameTable } from '../tables/entities/game-table.entity';
import { Invitation } from '../tables/entities/invitation.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, GameTable, Invitation]),
    forwardRef(() => GameModule),
    TablesModule,
    WalletModule,
    EmailModule,
  ],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class WebsocketModule {}

