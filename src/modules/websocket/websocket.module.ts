import { Module, forwardRef } from '@nestjs/common';
import { GameGateway } from './gateways/game.gateway';
import { GameModule } from '../game/game.module';
import { TablesModule } from '../tables/tables.module';
import { WalletModule } from '../wallet/wallet.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [forwardRef(() => GameModule), TablesModule, WalletModule, EmailModule],
  providers: [GameGateway],
  exports: [GameGateway],
})
export class WebsocketModule {}

