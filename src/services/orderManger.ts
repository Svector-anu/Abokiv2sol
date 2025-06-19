// src/services/orderManager.ts

import { PublicKey } from '@solana/web3.js';
import { JupiterService } from './jupiterService';
import { CONFIG } from '@/utils/constants';
import type { 
  Order, 
  OrderStatus, 
  OrderCreationParams, 
  OrderStats,
  JupiterQuote 
} from '@/types';

export class OrderManager {
  private orders: Map<string, Order> = new Map();
  private jupiterService: JupiterService;
  private protocolFeeBps: number;
  private treasuryWallet: string;
  private orderIdCounter: number = 0;

  constructor(
    rpcEndpoint?: string,
    protocolFeeBps: number = CONFIG.PROTOCOL_FEE_BPS,
    treasuryWallet: string = CONFIG.TREASURY_WALLET
  ) {
    this.jupiterService = new JupiterService(rpcEndpoint);
    this.protocolFeeBps = protocolFeeBps;
    this.treasuryWallet = treasuryWallet;
    
    // Load persisted data
    this.loadPersistedOrders();
  }

  /**
   * Create a new order
   */
  async createOrder(
    params: OrderCreationParams,
    userPublicKey: PublicKey
  ): Promise<string> {
    try {
      // Validate input parameters
      this.validateOrderParams(params);

      // Check if treasury wallet is configured
      if (!this.treasuryWallet) {
        throw new Error('Treasury wallet not configured');
      }

      // Get quote from Jupiter
      const quote = await this.jupiterService.getQuote(
        params.inputToken,
        params.outputToken,
        params.inputAmount,
        50, // 0.5% slippage
        this.protocolFeeBps
      );

      // Calculate protocol fee in input token terms
      const protocolFee = (params.inputAmount * this.protocolFeeBps) / 10000;

      // Generate unique order ID
      const orderId = this.generateOrderId();

      // Create order object
      const order: Order = {
        id: orderId,
        inputToken: params.inputToken,
        outputToken: params.outputToken,
        inputAmount: params.inputAmount,
        expectedOutputAmount: parseInt(quote.outAmount),
        rate: params.rate || 'Market Rate',
        creator: userPublicKey.toString(),
        refundAddress: params.refundAddress || userPublicKey.toString(),
        liquidityProvider: params.liquidityProvider,
        status: 'pending' as OrderStatus,
        timestamp: Date.now(),
        quote,
        protocolFee,
        priceImpact: quote.priceImpactPct
      };

      // Store order
      this.orders.set(orderId, order);
      
      // Persist to storage
      this.persistOrders();

      console.log(`Order ${orderId} created successfully`);
      return orderId;

    } catch (error) {
      console.error('Order creation failed:', error);
      throw new Error(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Execute an order (perform the actual swap)
   */
  async executeOrder(orderId: string, wallet: any): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.status !== 'pending') {
      throw new Error(`Order is not in pending status. Current status: ${order.status}`);
    }

    try {
      console.log(`Executing order ${orderId}...`);

      // Execute swap through Jupiter
      const result = await this.jupiterService.executeOrderSwap(wallet, {
        inputMint: order.inputToken,
        outputMint: order.outputToken,
        inputAmount: order.inputAmount,
        liquidityProvider: order.liquidityProvider,
        treasuryWallet: this.treasuryWallet,
        platformFeeBps: this.protocolFeeBps
      });

      if (result.success) {
        // Update order with successful execution
        order.transactionSignature = result.signature;
        order.actualOutputAmount = result.outputAmount ? parseInt(result.outputAmount) : order.expectedOutputAmount;
        order.status = 'fulfilled' as OrderStatus;
        
        console.log(`Order ${orderId} executed successfully: ${result.signature}`);
      } else {
        // Update order with failure
        order.status = 'failed' as OrderStatus;
        order.errorMessage = result.error || 'Unknown execution error';
        
        console.error(`Order ${orderId} execution failed: ${result.error}`);
        throw new Error(result.error || 'Swap execution failed');
      }

      // Update stored order
      this.orders.set(orderId, order);
      this.persistOrders();

    } catch (error) {
      console.error(`Order ${orderId} execution failed:`, error);
      
      // Update order with error status
      order.status = 'failed' as OrderStatus;
      order.errorMessage = error.message;
      this.orders.set(orderId, order);
      this.persistOrders();

      throw error;
    }
  }

  /**
   * Cancel an order
   */
  cancelOrder(orderId: string, userPublicKey: PublicKey): void {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    if (order.creator !== userPublicKey.toString()) {
      throw new Error('Unauthorized: Only order creator can cancel');
    }

    if (order.status !== 'pending') {
      throw new Error(`Cannot cancel order with status: ${order.status}`);
    }

    order.status = 'cancelled' as OrderStatus;
    this.orders.set(orderId, order);
    this.persistOrders();

    console.log(`Order ${orderId} cancelled by user`);
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders for a user
   */
  getUserOrders(userPublicKey: PublicKey): Order[] {
    const userAddress = userPublicKey.toString();
    return Array.from(this.orders.values())
      .filter(order => order.creator === userAddress)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get all orders (admin function)
   */
  getAllOrders(): Order[] {
    return Array.from(this.orders.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get orders by status
   */
  getOrdersByStatus(status: OrderStatus): Order[] {
    return Array.from(this.orders.values())
      .filter(order => order.status === status)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Update order quote (refresh pricing for pending orders)
   */
  async updateOrderQuote(orderId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order || order.status !== 'pending') {
      throw new Error('Cannot update quote for non-pending order');
    }

    try {
      const newQuote = await this.jupiterService.getQuote(
        order.inputToken,
        order.outputToken,
        order.inputAmount,
        50,
        this.protocolFeeBps
      );

      // Update order with new quote
      order.quote = newQuote;
      order.expectedOutputAmount = parseInt(newQuote.outAmount);
      order.priceImpact = newQuote.priceImpactPct;

      this.orders.set(orderId, order);
      this.persistOrders();

      console.log(`Quote updated for order ${orderId}`);
    } catch (error) {
      console.error(`Failed to update quote for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order statistics
   */
  getOrderStats(): OrderStats {
    const orders = Array.from(this.orders.values());
    
    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending').length,
      fulfilled: orders.filter(o => o.status === 'fulfilled').length,
      failed: orders.filter(o => o.status === 'failed').length,
      cancelled: orders.filter(o => o.status === 'cancelled').length,
      totalVolume: orders
        .filter(o => o.status === 'fulfilled')
        .reduce((sum, o) => sum + o.inputAmount, 0)
    };
  }

  /**
   * Get orders requiring attention (failed, expired quotes, etc.)
   */
  getOrdersRequiringAttention(): Order[] {
    const now = Date.now();
    const QUOTE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes

    return Array.from(this.orders.values()).filter(order => {
      // Failed orders
      if (order.status === 'failed') return true;
      
      // Pending orders with old quotes
      if (order.status === 'pending' && (now - order.timestamp) > QUOTE_EXPIRY_TIME) {
        return true;
      }
      
      return false;
    });
  }

  /**
   * Refresh all pending order quotes
   */
  async refreshPendingQuotes(): Promise<void> {
    const pendingOrders = this.getOrdersByStatus('pending' as OrderStatus);
    
    for (const order of pendingOrders) {
      try {
        await this.updateOrderQuote(order.id);
      } catch (error) {
        console.error(`Failed to refresh quote for order ${order.id}:`, error);
      }
    }
  }

  // Private helper methods
  private generateOrderId(): string {
    this.orderIdCounter++;
    return `order_${Date.now()}_${this.orderIdCounter.toString().padStart(4, '0')}`;
  }

  private validateOrderParams(params: OrderCreationParams): void {
    if (!params.inputToken || !params.outputToken) {
      throw new Error('Input and output tokens are required');
    }

    if (params.inputToken === params.outputToken) {
      throw new Error('Input and output tokens cannot be the same');
    }

    if (!params.inputAmount || params.inputAmount <= 0) {
      throw new Error('Input amount must be greater than 0');
    }

    if (!params.liquidityProvider) {
      throw new Error('Liquidity provider address is required');
    }

    // Validate addresses
    try {
      new PublicKey(params.liquidityProvider);
    } catch (error) {
      throw new Error('Invalid liquidity provider address');
    }

    if (params.refundAddress) {
      try {
        new PublicKey(params.refundAddress);
      } catch (error) {
        throw new Error('Invalid refund address');
      }
    }
  }

  // Persistence methods (localStorage for now, replace with database for production)
  private persistOrders(): void {
    try {
      if (typeof window !== 'undefined') {
        const ordersArray = Array.from(this.orders.entries());
        localStorage.setItem('jupiter_orders', JSON.stringify(ordersArray));
      }
    } catch (error) {
      console.error('Failed to persist orders:', error);
    }
  }

  private loadPersistedOrders(): void {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('jupiter_orders');
        if (stored) {
          const ordersArray = JSON.parse(stored);
          this.orders = new Map(ordersArray);
          
          // Update counter to avoid ID conflicts
          const maxId = Math.max(
            0,
            ...Array.from(this.orders.keys())
              .map(id => parseInt(id.split('_')[2]) || 0)
          );
          this.orderIdCounter = maxId;
        }
      }
    } catch (error) {
      console.error('Failed to load persisted orders:', error);
      this.orders = new Map();
    }
  }

  /**
   * Export orders (for backup/migration)
   */
  exportOrders(): string {
    return JSON.stringify(Array.from(this.orders.entries()));
  }

  /**
   * Import orders (for backup/migration)
   */
  importOrders(ordersJson: string): void {
    try {
      const ordersArray = JSON.parse(ordersJson);
      this.orders = new Map(ordersArray);
      this.persistOrders();
      console.log(`Imported ${ordersArray.length} orders`);
    } catch (error) {
      console.error('Failed to import orders:', error);
      throw new Error('Invalid orders data format');
    }
  }

  /**
   * Clear all orders (use with caution)
   */
  clearAllOrders(): void {
    this.orders.clear();
    this.orderIdCounter = 0;
    this.persistOrders();
    console.log('All orders cleared');
  }

  /**
   * Get total fees collected
   */
  getTotalFeesCollected(): number {
    return Array.from(this.orders.values())
      .filter(order => order.status === 'fulfilled')
      .reduce((total, order) => total + order.protocolFee, 0);
  }
}