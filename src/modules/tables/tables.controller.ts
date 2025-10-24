import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TablesService } from './tables.service';
import { CreateTableDto } from './dto/create-table.dto';
import { JoinTableDto } from './dto/join-table.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('tables')
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available tables' })
  async getAllTables(
    @Query('status') status?: string,
    @Query('network') network?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    return this.tablesService.findAll(status, network, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get table by ID' })
  async getTable(@Param('id') id: string) {
    return this.tablesService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new table' })
  async createTable(@Request() req, @Body() createTableDto: CreateTableDto) {
    return this.tablesService.create(req.user.id, createTableDto);
  }

  @Post(':id/join')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Join a table' })
  async joinTable(
    @Param('id') id: string,
    @Request() req,
    @Body() joinTableDto: JoinTableDto,
  ) {
    return this.tablesService.joinTable(id, req.user.id, joinTableDto);
  }

  @Post(':id/leave')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Leave a table' })
  async leaveTable(@Param('id') id: string, @Request() req) {
    return this.tablesService.leaveTable(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete table (creator only)' })
  async deleteTable(@Param('id') id: string, @Request() req) {
    return this.tablesService.deleteTable(id, req.user.id);
  }

  @Get('user/my-tables')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user created tables' })
  async getMyTables(@Request() req) {
    return this.tablesService.getUserTables(req.user.id);
  }
}

