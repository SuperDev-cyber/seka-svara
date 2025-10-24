import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameTable } from './entities/game-table.entity';
import { TablePlayer } from './entities/table-player.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { JoinTableDto } from './dto/join-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(GameTable)
    private tablesRepository: Repository<GameTable>,
    @InjectRepository(TablePlayer)
    private tablePlayersRepository: Repository<TablePlayer>,
  ) {}

  async findAll(status?: string, network?: string, page: number = 1, limit: number = 10) {
    const query = this.tablesRepository.createQueryBuilder('table');

    if (status) {
      query.andWhere('table.status = :status', { status });
    }

    if (network) {
      query.andWhere('table.network = :network', { network });
    }

    query
      .leftJoinAndSelect('table.players', 'players')
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('table.createdAt', 'DESC');

    const [tables, total] = await query.getManyAndCount();

    return {
      data: tables,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const table = await this.tablesRepository.findOne({
      where: { id },
      relations: ['players'],
    });

    if (!table) {
      throw new NotFoundException('Table not found');
    }

    return table;
  }

  async create(creatorId: string, createTableDto: CreateTableDto) {
    // TODO: Implement table creation
    // 1. Validate creator has sufficient balance
    // 2. Create table
    // 3. Add creator as first player
    throw new Error('Method not implemented');
  }

  async joinTable(tableId: string, userId: string, joinTableDto: JoinTableDto) {
    // TODO: Implement join table
    // 1. Check table exists and has space
    // 2. Check user has sufficient balance
    // 3. Add user to table
    // 4. Notify other players via WebSocket
    throw new Error('Method not implemented');
  }

  async leaveTable(tableId: string, userId: string) {
    // TODO: Implement leave table
    // 1. Remove user from table
    // 2. Refund balance if game not started
    // 3. Notify other players
    throw new Error('Method not implemented');
  }

  async deleteTable(tableId: string, userId: string) {
    // TODO: Implement delete table
    // Only creator can delete
    // Only if game not started
    throw new Error('Method not implemented');
  }

  async getUserTables(userId: string) {
    const tables = await this.tablesRepository.find({
      where: { creatorId: userId },
      order: { createdAt: 'DESC' },
    });

    return tables;
  }

  async startGame(tableId: string) {
    // TODO: Start game when table is full or manually started
    throw new Error('Method not implemented');
  }
}

