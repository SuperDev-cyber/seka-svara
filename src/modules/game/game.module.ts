import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameEngine } from './services/game-engine.service';
import { DeckService } from './services/deck.service';
import { HandEvaluatorService } from './services/hand-evaluator.service';
import { BettingService } from './services/betting.service';
import { GameStateService } from './services/game-state.service';
import { MockWalletService } from './services/mock-wallet.service';
import { DatabaseWalletService } from './services/database-wallet.service';
import { Game } from './entities/game.entity';
import { GamePlayer } from './entities/game-player.entity';
import { User } from '../users/entities/user.entity';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GamePlayer, User]),
    forwardRef(() => WebsocketModule),
  ],
  controllers: [GameController],
  providers: [
    GameService,
    GameEngine,
    DeckService,
    HandEvaluatorService,
    BettingService,
    GameStateService,
    MockWalletService,
    DatabaseWalletService,
    // ✅ USE DATABASE WALLET SERVICE - Users play with virtual balance from database
    {
      provide: 'WALLET_SERVICE',
      useClass: DatabaseWalletService,
    },
  ],
  exports: [
    GameService,
    GameEngine,
    DeckService,
    HandEvaluatorService,
    BettingService,
    GameStateService,
  ],
})
export class GameModule {}

