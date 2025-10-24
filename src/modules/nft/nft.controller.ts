import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { NftService } from './nft.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateNftDto } from './dto/create-nft.dto';
import { BuyNftDto } from './dto/buy-nft.dto';

@ApiTags('nft')
@Controller('nft')
export class NftController {
  constructor(private readonly nftService: NftService) {}

  @Get()
  @ApiOperation({ summary: 'Get all NFTs (marketplace)' })
  async getAllNfts(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 12,
    @Query('category') category?: string,
  ) {
    return this.nftService.findAll(page, limit, category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get NFT by ID' })
  async getNft(@Param('id') id: string) {
    return this.nftService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create/Mint NFT' })
  async createNft(@Request() req, @Body() createNftDto: CreateNftDto) {
    return this.nftService.create(req.user.id, createNftDto);
  }

  @Post(':id/buy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buy NFT' })
  async buyNft(@Param('id') id: string, @Request() req, @Body() buyNftDto: BuyNftDto) {
    return this.nftService.buyNft(id, req.user.id, buyNftDto);
  }

  @Get('user/collection')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user NFT collection' })
  async getUserCollection(@Request() req) {
    return this.nftService.getUserCollection(req.user.id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Get NFT transaction history' })
  async getNftHistory(@Param('id') id: string) {
    return this.nftService.getNftHistory(id);
  }
}

