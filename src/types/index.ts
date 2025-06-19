// src/types/index.ts

// Token interface
export interface Token {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    icon: string;
  }
  
  // Order form data
  export interface OrderFormData {
    inputToken: string;
    outputToken: string;
    amount: string;
    liquidityProvider: string;
    rate: string;
  }
  
  // Order status enum
  export enum OrderStatus {
    PENDING = 'pending',
    FULFILLED = 'fulfilled',
    FAILED = 'failed',
    REFUNDED = 'refunded',
    CANCELLED = 'cancelled'
  }
  
  // Jupiter quote interface
  export interface JupiterQuote {
    inputMint: string;
    inAmount: string;
    outputMint: string;
    outAmount: string;
    otherAmountThreshold: string;
    swapMode: string;
    slippageBps: number;
    platformFee: any;
    priceImpactPct: string;
    routePlan: RouteStep[];
    contextSlot: number;
    timeTaken: number;
  }
  
  // Route step in Jupiter quote
  export interface RouteStep {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }
  
  // Jupiter swap transaction response
  export interface SwapTransaction {
    swapTransaction: string;
    lastValidBlockHeight: number;
    prioritizationFeeLamports: number;
    computeUnitLimit: number;
    prioritizationType: {
      computeBudget: {
        microLamports: number;
        estimatedMicroLamports: number;
      };
    };
    dynamicSlippageReport: {
      slippageBps: number;
      otherAmount: number;
      simulatedIncurredSlippageBps: number;
      amplificationRatio: string;
      categoryName: string;
      heuristicMaxSlippageBps: number;
    };
    simulationError: any;
  }
  
  // Order interface
  export interface Order {
    id: string;
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    expectedOutputAmount: number;
    actualOutputAmount?: number;
    rate: string;
    creator: string;
    refundAddress: string;
    liquidityProvider: string;
    status: OrderStatus;
    timestamp: number;
    quote: JupiterQuote;
    transactionSignature?: string;
    errorMessage?: string;
    protocolFee: number;
    priceImpact: string;
  }
  
  // Order creation parameters
  export interface OrderCreationParams {
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    rate?: string;
    liquidityProvider: string;
    refundAddress?: string;
  }
  
  // Priority fee configuration
  export interface PriorityFeeConfig {
    priorityLevelWithMaxLamports?: {
      maxLamports: number;
      priorityLevel: 'medium' | 'high' | 'veryHigh';
      global?: boolean;
    };
    jitoTipLamports?: number;
  }
  
  // Order statistics
  export interface OrderStats {
    total: number;
    pending: number;
    fulfilled: number;
    failed: number;
    cancelled: number;
    totalVolume: number;
  }
  
  // Wallet context type
  export interface WalletContextType {
    connected: boolean;
    connecting: boolean;
    publicKey: any;
    wallet: any;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  }
  
  // API response wrapper
  export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
  }
  
  // Token balance
  export interface TokenBalance {
    mint: string;
    amount: number;
    decimals: number;
    formatted: string;
  }
  
  // Transaction result
  export interface TransactionResult {
    signature: string;
    success: boolean;
    error?: string;
    outputAmount?: string;
  }