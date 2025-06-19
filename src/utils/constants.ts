// src/utils/constants.ts

export const SUPPORTED_TOKENS = {
    SOL: {
      mint: 'So11111111111111111111111111111111111111112',
      symbol: 'SOL',
      name: 'Solana',
      decimals: 9,
      icon: '🟣'
    },
    USDC: {
      mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
      icon: '💵'
    },
    USDT: {
      mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      symbol: 'USDT',
      name: 'Tether USD',
      decimals: 6,
      icon: '💲'
    },
    JUP: {
      mint: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      symbol: 'JUP',
      name: 'Jupiter',
      decimals: 6,
      icon: '🪐'
    },
    RAY: {
      mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      symbol: 'RAY',
      name: 'Raydium',
      decimals: 6,
      icon: '☀️'
    }
  };
  
  export const CONFIG = {
    RPC_ENDPOINT: process.env.NEXT_PUBLIC_RPC_ENDPOINT || 'https://api.mainnet-beta.solana.com',
    TREASURY_WALLET: process.env.NEXT_PUBLIC_TREASURY_WALLET || '',
    PROTOCOL_FEE_BPS: parseInt(process.env.NEXT_PUBLIC_PROTOCOL_FEE_BPS || '100'), // 1%
    JUPITER_API_BASE: 'https://lite-api.jup.ag/swap/v1',
    DEFAULT_SLIPPAGE: 50, // 0.5%
    MAX_RETRIES: 3,
    PRIORITY_LEVEL: 'veryHigh' as const
  };
  
  export const NETWORK_ENDPOINTS = {
    MAINNET: 'https://api.mainnet-beta.solana.com',
    DEVNET: 'https://api.devnet.solana.com',
    TESTNET: 'https://api.testnet.solana.com'
  };
  
  // Transaction limits for safety
  export const TRANSACTION_LIMITS = {
    MAX_TRADE_AMOUNT_SOL: 1000, // 1000 SOL max
    MIN_TRADE_AMOUNT_SOL: 0.001, // 0.001 SOL min
    MAX_PRICE_IMPACT: 5, // 5% max price impact warning
    MAX_SLIPPAGE: 1000 // 10% max slippage
  };
  
  // Order status constants
  export const ORDER_STATUS = {
    PENDING: 'pending',
    FULFILLED: 'fulfilled',
    FAILED: 'failed',
    REFUNDED: 'refunded',
    CANCELLED: 'cancelled'
  } as const;
  
  // Priority levels for Jupiter transactions
  export const PRIORITY_LEVELS = {
    MEDIUM: 'medium',
    HIGH: 'high',
    VERY_HIGH: 'veryHigh'
  } as const;