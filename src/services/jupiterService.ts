// src/services/jupiterService.ts

import { Connection, PublicKey, VersionedTransaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { CONFIG } from '@/utils/constants';
import type { 
  JupiterQuote, 
  SwapTransaction, 
  PriorityFeeConfig,
  TransactionResult 
} from '@/types';

export class JupiterService {
  private connection: Connection;
  private baseUrl: string;
  
  constructor(rpcEndpoint?: string) {
    this.connection = new Connection(rpcEndpoint || CONFIG.RPC_ENDPOINT);
    this.baseUrl = CONFIG.JUPITER_API_BASE;
  }

  /**
   * Get quote from Jupiter API
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = CONFIG.DEFAULT_SLIPPAGE,
    platformFeeBps?: number
  ): Promise<JupiterQuote> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
        restrictIntermediateTokens: 'true',
      });

      if (platformFeeBps && platformFeeBps > 0) {
        params.append('platformFeeBps', platformFeeBps.toString());
      }

      const response = await fetch(`${this.baseUrl}/quote?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const quote = await response.json();
      
      // Validate quote response
      this.validateQuote(quote);
      
      return quote;
    } catch (error: any) {
      console.error('Jupiter quote error:', error);
      throw new Error(`Failed to get quote: ${error.message}`);
    }
  }

  /**
   * Create swap transaction
   */
  async createSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: PublicKey,
    options: {
      feeAccount?: PublicKey;
      destinationTokenAccount?: PublicKey;
      priorityFeeConfig?: PriorityFeeConfig;
      dynamicSlippage?: boolean;
      dynamicComputeUnitLimit?: boolean;
    } = {}
  ): Promise<SwapTransaction> {
    try {
      const swapRequest: any = {
        quoteResponse: quote,
        userPublicKey: userPublicKey.toString(),
        dynamicComputeUnitLimit: options.dynamicComputeUnitLimit ?? true,
        dynamicSlippage: options.dynamicSlippage ?? true,
      };

      // Add priority fee configuration
      if (options.priorityFeeConfig) {
        swapRequest.prioritizationFeeLamports = options.priorityFeeConfig;
      } else {
        // Default priority fee configuration
        swapRequest.prioritizationFeeLamports = {
          priorityLevelWithMaxLamports: {
            maxLamports: 1000000, // 0.001 SOL max
            priorityLevel: CONFIG.PRIORITY_LEVEL,
            global: false
          }
        };
      }

      // Add fee account if provided
      if (options.feeAccount) {
        swapRequest.feeAccount = options.feeAccount.toString();
      }

      // Add destination token account if provided
      if (options.destinationTokenAccount) {
        swapRequest.destinationTokenAccount = options.destinationTokenAccount.toString();
      }

      const response = await fetch(`${this.baseUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Jupiter swap transaction error:', error);
      throw new Error(`Failed to create swap transaction: ${error.message}`);
    }
  }

  /**
   * Execute swap transaction
   */
  async executeSwap(
    wallet: any,
    swapTransaction: SwapTransaction
  ): Promise<TransactionResult> {
    try {
      // Deserialize the transaction
      const transactionBuf = Buffer.from(swapTransaction.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(transactionBuf);

      // Sign the transaction
      const signedTransaction = await wallet.signTransaction(transaction);

      // Send the transaction
      const signature = await this.connection.sendTransaction(signedTransaction, {
        maxRetries: CONFIG.MAX_RETRIES,
        skipPreflight: true,
      });

      // Confirm the transaction
      const confirmation = await this.connection.confirmTransaction({
        signature,
        blockhash: transaction.message.recentBlockhash,
        lastValidBlockHeight: swapTransaction.lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      return {
        signature,
        success: true,
      };
    } catch (error) {
      console.error('Swap execution error:', error);
      return {
        signature: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(
    walletAddress: PublicKey,
    tokenMint: PublicKey
  ): Promise<number> {
    try {
      // For native SOL
      if (tokenMint.toString() === 'So11111111111111111111111111111111111111112') {
        return await this.connection.getBalance(walletAddress);
      }

      // For SPL tokens
      const tokenAccount = await getAssociatedTokenAddress(tokenMint, walletAddress);
      const accountInfo = await this.connection.getTokenAccountBalance(tokenAccount);
      return parseInt(accountInfo.value.amount);
    } catch (error) {
      console.error('Error getting token balance:', error);
      return 0;
    }
  }

  /**
   * Complete swap flow for orders
   */
  async executeOrderSwap(
    wallet: any,
    order: {
      inputMint: string;
      outputMint: string;
      inputAmount: number;
      liquidityProvider: string;
      treasuryWallet: string;
      platformFeeBps: number;
    }
  ): Promise<TransactionResult & { outputAmount?: string }> {
    try {
      // Get quote
      const quote = await this.getQuote(
        order.inputMint,
        order.outputMint,
        order.inputAmount,
        CONFIG.DEFAULT_SLIPPAGE,
        order.platformFeeBps
      );

      // Get treasury token account for fees (input token)
      const treasuryTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(order.inputMint),
        new PublicKey(order.treasuryWallet)
      );

      // Get LP destination token account (output token)
      const lpTokenAccount = await getAssociatedTokenAddress(
        new PublicKey(order.outputMint),
        new PublicKey(order.liquidityProvider)
      );

      // Create swap transaction
      const swapTransaction = await this.createSwapTransaction(
        quote,
        wallet.publicKey,
        {
          feeAccount: treasuryTokenAccount,
          destinationTokenAccount: lpTokenAccount
        }
      );

      // Execute swap
      const result = await this.executeSwap(wallet, swapTransaction);

      return {
        ...result,
        outputAmount: quote.outAmount
      };
    } catch (error) {
      console.error('Order swap execution failed:', error);
      return {
        signature: '',
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get current network status
   */
  async getNetworkStatus(): Promise<{
    slot: number;
    blockHeight: number;
    blockhash: string;
  }> {
    try {
      const [slot, blockHeight, { blockhash }] = await Promise.all([
        this.connection.getSlot(),
        this.connection.getBlockHeight(),
        this.connection.getLatestBlockhash()
      ]);

      return { slot, blockHeight, blockhash };
    } catch (error: any) {
      console.error('Error getting network status:', error);
      throw error;
    }
  }

  /**
   * Validate quote response
   */
  private validateQuote(quote: any): void {
    if (!quote.inputMint || !quote.outputMint) {
      throw new Error('Invalid quote: missing mint addresses');
    }
    
    if (!quote.inAmount || !quote.outAmount) {
      throw new Error('Invalid quote: missing amounts');
    }
    
    if (parseFloat(quote.priceImpactPct) > 10) {
      console.warn(`High price impact: ${quote.priceImpactPct}%`);
    }
  }

  /**
   * Format amount based on token decimals
   */
  static formatAmount(amount: number, decimals: number): string {
    return (amount / Math.pow(10, decimals)).toFixed(6);
  }

  /**
   * Convert human readable amount to smallest unit
   */
  static convertToSmallestUnit(amount: number, decimals: number): number {
    return Math.floor(amount * Math.pow(10, decimals));
  }
}