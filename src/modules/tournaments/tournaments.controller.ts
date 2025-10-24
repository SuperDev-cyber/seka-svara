import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournamentsService: TournamentsService) {}

  @Post()
  async create(@Body() createTournamentDto: any) {
    return this.tournamentsService.create(createTournamentDto);
  }

  @Get()
  async findAll(@Query() query: any) {
    return this.tournamentsService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.tournamentsService.findOne(id);
  }

  @Post(':id/register')
  async register(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.tournamentsService.register(id, body.userId);
  }

  @Post(':id/unregister')
  async unregister(@Param('id') id: string, @Body() body: { userId: string }) {
    return this.tournamentsService.unregister(id, body.userId);
  }

  @Post(':id/start')
  async start(@Param('id') id: string) {
    return this.tournamentsService.start(id);
  }

  @Get(':id/leaderboard')
  async getLeaderboard(@Param('id') id: string) {
    return this.tournamentsService.getLeaderboard(id);
  }
}

