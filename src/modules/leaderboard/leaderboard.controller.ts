import { Controller, Get, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('top-winners')
  @ApiOperation({ summary: 'Get top winners by total winnings' })
  async getTopWinners(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    return this.leaderboardService.getTopWinners(limit);
  }

  @Get('top-players')
  @ApiOperation({ summary: 'Get top players by games won' })
  async getTopPlayers(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    return this.leaderboardService.getTopPlayers(limit);
  }

  @Get('most-active')
  @ApiOperation({ summary: 'Get most active players' })
  async getMostActive(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number
  ) {
    return this.leaderboardService.getMostActive(limit);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get overall platform statistics' })
  async getStatistics() {
    return this.leaderboardService.getStatistics();
  }
}

