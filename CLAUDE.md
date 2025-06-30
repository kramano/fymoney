# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FyMoney is a dual-platform project:
1. **React/Vite Frontend** (`app/`): A Farcaster mini-app providing a USDC yield wallet interface on Solana Devnet
2. **Solana Program** (`programs/fymoney/`): An Anchor-based smart contract for the Solana blockchain

The app enables email-based wallet creation, USDC transfers, and simulated yield generation within the Farcaster ecosystem.

## Development Commands

### Frontend (app/)
```bash
cd app
npm run dev          # Start development server on port 5173  
npm run build        # Build for production (TypeScript check + Vite build)
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Solana Program (root)
```bash
npm run lint         # Format with Prettier
npm run lint:fix     # Format and fix with Prettier
npx ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts  # Run Anchor tests
```

### Anchor Commands
```bash
anchor build         # Build Solana program
anchor test          # Run program tests  
anchor deploy        # Deploy to configured cluster
```

## Core Architecture

### Frontend Stack
- **Framework**: React 18 + Vite + TypeScript
- **Authentication**: Dynamic SDK with embedded Solana wallets
- **UI**: Tailwind CSS + Radix UI primitives + Lucide icons
- **Blockchain**: Solana Devnet via `@solana/web3.js` and `@solana/spl-token`
- **Backend**: Supabase for email-wallet mappings and transfer intents
- **Email**: Resend API for notifications

### Key Frontend Components
- **`App.tsx`**: Root with Dynamic provider and routing
- **`Wallet.tsx`**: Main wallet interface with balance and actions
- **`WalletCard.tsx`**: Balance display and action buttons (Send/Receive/Earn)
- **Modal System**: `SendModal`, `ReceiveModal`, `EarnModal`, `SettingsModal`
- **Services**: Email wallet registration, transfer intents, gasless transactions

### Solana Program
- **Program ID**: `31HHr5jwk8woZF1GQthtBSkh2a7TvcbgamhTATYuDw9Z` 
- **Framework**: Anchor (Rust-based)
- **Current State**: Basic initialization only - placeholder for future functionality

### Database Schema (Supabase)
- **`email_wallets`**: Email-to-wallet mappings with privacy-preserving hashes
- **`transfer_intents`**: Pending transfers for unregistered recipients
- Email templates for notifications

## Environment Configuration

### Required Variables (.env)
```bash
# Dynamic SDK
VITE_DYNAMIC_ENVIRONMENT_ID=your_dynamic_environment_id

# Solana Configuration  
VITE_USDC_MINT_ADDRESS=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU  # Devnet USDC
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com

# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Email (Optional)
VITE_RESEND_API_KEY=your_resend_key
```

## Key Services

### EmailWalletService (`app/src/services/emailWallet.ts`)
- Manages email-to-wallet address mappings
- Privacy-preserving using SHA-256 email hashes
- Handles race conditions and duplicate registrations
- Supports registration, lookup, updates, and deactivation

### TransferIntentService (`app/src/services/transferService.ts`) 
- Creates transfer intents for unregistered recipients
- Manages pending transfers with 30-day expiration
- Sends invitation emails via Resend API
- Handles claiming workflow (partially implemented)

### TransactionService (`app/src/services/transactionService.ts`)
- Fee payer wallet management for gasless USDC transfers
- Handles transaction fees for user transactions

## Development Workflow

1. **Frontend Development**: Work in `app/` directory with hot reload via `npm run dev`
2. **Smart Contract**: Develop in `programs/fymoney/src/` using Anchor framework  
3. **Testing**: Use `anchor test` for on-chain tests, manual testing for frontend
4. **Build**: Always run `npm run build` and `npm run lint` before committing

## Farcaster Integration

- Mini-app optimized for Farcaster frame embedding
- Frame configuration in `app/public/.well-known/farcaster.json`
- Uses `@farcaster/frame-sdk` for lifecycle management
- Designed for mobile-first interaction within Farcaster clients

## Important Notes

- **Network**: Solana Devnet only - do not use mainnet addresses
- **Wallet Support**: Solana wallets only via Dynamic SDK
- **Email Privacy**: All emails are hashed before database storage
- **Transfer Flow**: Send to emails creates transfer intents; claiming requires registration
- **Error Handling**: Comprehensive error handling for blockchain and database operations
- **Mobile Optimization**: UI designed primarily for mobile Farcaster experience