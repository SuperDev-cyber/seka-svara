import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
const TronWeb = require('tronweb');

/**
 * Service for interacting with Tron Network (TRC20)
 */
@Injectable()
export class TronService {
  private tronWeb: any;
  private USDTContract: any;
  private logger = new Logger('TronService');

  constructor(private configService: ConfigService) {
    this.initializeTronWeb();
  }

  private async initializeTronWeb() {
    const fullNode = this.configService.get('TRON_FULL_NODE');
    const solidityNode = this.configService.get('TRON_SOLIDITY_NODE');
    const eventServer = this.configService.get('TRON_EVENT_SERVER');
    const privateKey = this.configService.get('TRON_PRIVATE_KEY');
    const USDTAddress = this.configService.get('TRON_USDT_CONTRACT');

    // Skip blockchain initialization if private key is not properly configured
    // This allows developers to work on non-blockchain features
    if (!privateKey || privateKey.length < 64) {
      this.logger.warn(
        'Tron private key not configured. Blockchain features will be disabled. ' +
        'This is normal for development if you are not working on blockchain features.',
      );
      return;
    }

    try {
      this.tronWeb = new TronWeb({
        fullHost: fullNode,
        headers: { 'TRON-PRO-API-KEY': this.configService.get('TRON_API_KEY') },
        privateKey: privateKey,
      });

      this.USDTContract = await this.tronWeb.contract().at(USDTAddress);
      this.logger.log('Tron service initialized successfully');
    } catch (error) {
      this.logger.error(`Failed to initialize Tron service: ${error.message}`);
      this.logger.warn('Blockchain features will be disabled');
    }
  }

  async getBalance(address: string): Promise<string> {
    try {
      if (!this.USDTContract || !this.tronWeb) {
        throw new Error('Tron service not initialized');
      }
      const balance = await this.USDTContract.balanceOf(address).call();
      let decimals = 6; // Default USDT decimals
      try {
        decimals = await this.USDTContract.decimals().call();
      } catch (error) {
        this.logger.warn(`Could not get decimals, using default 6: ${error.message}`);
      }
      return (balance / Math.pow(10, decimals)).toString();
    } catch (error) {
      this.logger.error(`Failed to get Tron balance: ${error.message}`);
      throw error;
    }
  }

  async transfer(to: string, amount: string): Promise<any> {
    try {
      if (!this.USDTContract || !this.tronWeb) {
        throw new Error('Tron service not initialized. Please configure TRON_PRIVATE_KEY and TRON_USDT_CONTRACT.');
      }

      // USDT on Tron uses 6 decimals
      // Try to get decimals from contract, fallback to 6 if it fails
      let decimals = 6;
      try {
        decimals = await this.USDTContract.decimals().call();
      } catch (error) {
        this.logger.warn(`Could not get decimals from contract, using default 6: ${error.message}`);
        decimals = 6; // USDT standard decimals
      }

      const amountInSun = parseFloat(amount) * Math.pow(10, decimals);

      const tx = await this.USDTContract.transfer(to, amountInSun).send();

      this.logger.log(`Tron transfer successful: ${tx}`);
      return {
        success: true,
        txHash: tx,
      };
    } catch (error) {
      this.logger.error(`Tron transfer failed: ${error.message}`);
      throw error;
    }
  }

  async verifyTransaction(txHash: string): Promise<any> {
    try {
      // TODO: Verify transaction on Tron
      const tx = await this.tronWeb.trx.getTransaction(txHash);
      if (!tx) {
        return { verified: false, message: 'Transaction not found' };
      }

      const txInfo = await this.tronWeb.trx.getTransactionInfo(txHash);
      return {
        verified: txInfo.receipt?.result === 'SUCCESS',
        blockNumber: txInfo.blockNumber,
        from: this.tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address),
        to: this.tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.to_address),
      };
    } catch (error) {
      this.logger.error(`Failed to verify Tron transaction: ${error.message}`);
      throw error;
    }
  }

  async estimateFee(to: string, amount: string): Promise<number> {
    try {
      // Tron transaction fees are typically around 1-5 TRX
      return 5; // Estimated fee in TRX
    } catch (error) {
      this.logger.error(`Failed to estimate fee: ${error.message}`);
      throw error;
    }
  }
}

