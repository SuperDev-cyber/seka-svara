import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NFT } from './entities/nft.entity';
import { NFTTransaction } from './entities/nft-transaction.entity';
import { CreateNftDto } from './dto/create-nft.dto';
import { BuyNftDto } from './dto/buy-nft.dto';

@Injectable()
export class NftService {
  constructor(
    @InjectRepository(NFT)
    private nftRepository: Repository<NFT>,
    @InjectRepository(NFTTransaction)
    private nftTransactionRepository: Repository<NFTTransaction>,
  ) {}

  async findAll(page: number = 1, limit: number = 12, category?: string) {
    const query = this.nftRepository.createQueryBuilder('nft');

    query.where('nft.status = :status', { status: 'listed' });

    if (category) {
      query.andWhere('nft.category = :category', { category });
    }

    query
      .orderBy('nft.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [nfts, total] = await query.getManyAndCount();

    return {
      data: nfts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const nft = await this.nftRepository.findOne({ where: { id } });
    if (!nft) {
      throw new NotFoundException('NFT not found');
    }
    return nft;
  }

  async create(userId: string, createNftDto: CreateNftDto) {
    // TODO: Implement NFT minting
    // 1. Upload image to storage
    // 2. Create NFT metadata
    // 3. Mint on blockchain
    // 4. Save to database
    throw new Error('Method not implemented');
  }

  async buyNft(nftId: string, buyerId: string, buyNftDto: BuyNftDto) {
    // TODO: Implement NFT purchase
    // 1. Check NFT is available
    // 2. Verify buyer has sufficient balance
    // 3. Transfer ownership on blockchain
    // 4. Update database
    // 5. Create transaction record
    throw new Error('Method not implemented');
  }

  async getUserCollection(userId: string) {
    const nfts = await this.nftRepository.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });

    return nfts;
  }

  async getNftHistory(nftId: string) {
    const history = await this.nftTransactionRepository.find({
      where: { nftId },
      order: { createdAt: 'DESC' },
    });

    return history;
  }
}

