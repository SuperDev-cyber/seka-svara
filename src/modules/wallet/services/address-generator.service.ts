import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class AddressGeneratorService {
  /**
   * Generate a unique BEP20 (Binance Smart Chain) address
   */
  generateBEP20Address(userId: string): string {
    const seed = `${userId}-BEP20-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    
    // Generate Ethereum-style address (0x + 40 hex chars)
    return `0x${hash.substring(0, 40)}`;
  }

  /**
   * Generate a unique TRC20 (Tron) address
   */
  generateTRC20Address(userId: string): string {
    const seed = `${userId}-TRC20-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    
    // Generate Tron-style address (T + 33 base58 chars)
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let address = 'T';
    
    for (let i = 0; i < 33; i++) {
      const charIndex = parseInt(hash.substr(i * 2, 2), 16) % base58Chars.length;
      address += base58Chars[charIndex];
    }
    
    return address;
  }

  /**
   * Generate a unique ERC20 (Ethereum) address
   */
  generateERC20Address(userId: string): string {
    const seed = `${userId}-ERC20-${Date.now()}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex');
    
    // Generate Ethereum-style address (0x + 40 hex chars)
    return `0x${hash.substring(0, 40)}`;
  }

  /**
   * Validate address format for different networks
   */
  validateAddress(address: string, network: 'BEP20' | 'TRC20' | 'ERC20'): boolean {
    switch (network) {
      case 'BEP20':
      case 'ERC20':
        return /^0x[a-fA-F0-9]{40}$/.test(address);
      case 'TRC20':
        return /^T[A-Za-z1-9]{33}$/.test(address);
      default:
        return false;
    }
  }
}