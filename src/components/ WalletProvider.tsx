// src/components/WalletProvider.tsx

import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
    PhantomWalletAdapter,
    SolflareWalletAdapter,
    // BackpackWalletAdapter, // Comment out if not available
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { CONFIG } from '@/utils/constants';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

interface Props {
    children: ReactNode;
}

export const AppWalletProvider: FC<Props> = ({ children }) => {
    // Determine network from environment
    const network = useMemo(() => {
        const envNetwork = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
        switch (envNetwork) {
            case 'devnet':
                return WalletAdapterNetwork.Devnet;
            case 'testnet':
                return WalletAdapterNetwork.Testnet;
            case 'mainnet-beta':
            default:
                return WalletAdapterNetwork.Mainnet;
        }
    }, []);
    
    // RPC endpoint configuration
    const endpoint = useMemo(() => {
        return CONFIG.RPC_ENDPOINT || clusterApiUrl(network);
    }, [network]);

    // Available wallets (removed BackpackWalletAdapter for now)
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new SolflareWalletAdapter(),
            // new BackpackWalletAdapter(), // Add back when available
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

/**
 * Custom hook for wallet with error handling and convenience methods
 */
export const useWalletWithErrorHandling = () => {
    const { 
        wallet, 
        connect, 
        disconnect, 
        connecting, 
        connected, 
        publicKey,
        signTransaction,
        signAllTransactions 
    } = useWallet();
    
    const connectWallet = async () => {
        try {
            if (!wallet) {
                throw new Error('Please install a Solana wallet (Phantom or Solflare)');
            }
            d                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               \
            if (connected) {
                console.log('Wallet already connected');
                return;
            }
            
            await connect();
            console.log('Wallet connected successfully');
        } catch (error: any) { // Fixed: explicitly type error as any
            console.error('Wallet connection failed:', error);
            
            // Provide user-friendly error messages
            let userMessage = 'Failed to connect wallet';
            if (error?.message?.includes('User rejected')) {
                userMessage = 'Connection cancelled by user';
            } else if (error?.message?.includes('install')) {
                userMessage = 'Please install a Solana wallet extension';
            }
            
            throw new Error(userMessage);
        }
    };

    const disconnectWallet = async () => {
        try {
            await disconnect();
            console.log('Wallet disconnected successfully');
        } catch (error: any) { // Fixed: explicitly type error as any
            console.error('Wallet disconnection failed:', error);
            throw new Error('Failed to disconnect wallet');
        }
    };

    const getWalletName = () => {
        return wallet?.adapter?.name || 'Unknown Wallet';
    };

    const getShortAddress = (length: number = 8) => {
        if (!publicKey) return '';
        const address = publicKey.toString();
        return `${address.slice(0, length)}...${address.slice(-4)}`;
    };

    return {
        // Original wallet adapter properties
        wallet,
        connecting,
        connected,
        publicKey,
        signTransaction,
        signAllTransactions,
        
        // Enhanced methods with error handling
        connect: connectWallet,
        disconnect: disconnectWallet,
        
        // Convenience methods
        getWalletName,
        getShortAddress,
        
        // Status checks
        isConnected: connected && !!publicKey,
        isConnecting: connecting,
        hasWallet: !!wallet,
    };
};

/**
 * Wallet connection status component
 */
export const WalletStatus: FC<{ className?: string }> = ({ className = '' }) => {
    const { connected, connecting, publicKey, getWalletName, getShortAddress } = useWalletWithErrorHandling();

    if (connecting) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full"></div>
                <span className="text-yellow-400">Connecting...</span>
            </div>
        );
    }

    if (connected && publicKey) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-green-400">
                    {getWalletName()}: {getShortAddress()}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
            <span className="text-red-400">Not Connected</span>
        </div>
    );
};

/**
 * Wallet connection guard component
 * Shows children only when wallet is connected
 */
export const WalletConnectionGuard: FC<{
    children: ReactNode;
    fallback?: ReactNode;
}> = ({ children, fallback }) => {
    const { connected } = useWalletWithErrorHandling();

    if (!connected) {
        return (
            <div className="text-center py-12 text-gray-400">
                {fallback || (
                    <>
                        <div className="text-4xl mb-4">🔒</div>
                        <p>Please connect your wallet to continue</p>
                    </>
                )}
            </div>
        );
    }

    return <>{children}</>;
};

/**
 * Network indicator component
 */
export const NetworkIndicator: FC<{ className?: string }> = ({ className = '' }) => {
    const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'mainnet-beta';
    
    const getNetworkColor = () => {
        switch (network) {
            case 'devnet':
                return 'text-orange-400 bg-orange-400/20';
            case 'testnet':
                return 'text-blue-400 bg-blue-400/20';
            case 'mainnet-beta':
                return 'text-green-400 bg-green-400/20';
            default:
                return 'text-gray-400 bg-gray-400/20';
        }
    };

    return (
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${getNetworkColor()} ${className}`}>
            {network.toUpperCase()}
        </div>
    );
};