# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Farcaster mini-app built with React/Vite/TypeScript that serves as a USDC yield wallet on Solana Devnet. 
The app uses Dynamic SDK for authentication and embedded wallet creation, allowing users to manage USDC funds, send/receive payments, and simulate yield generation.

## Development Commands

- `npm run dev` - Start development server on port 5173
- `npm run build` - Build for production (runs TypeScript check then Vite build)
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

## Core Architecture

### Authentication & Wallet
- Uses **Dynamic SDK** (`@dynamic-labs/sdk-react-core`) for authentication and embedded wallet creation
- Supports Solana wallets via `@dynamic-labs/solana` connector
- Main auth component: `src/components/ConnectMenu.tsx` with `DynamicEmbeddedWidget`
- Wallet validation ensures only Solana wallets are accepted

### Component Structure
- **App.tsx**: Root component with Dynamic context provider and CSS overrides
- **Wallet.tsx**: Main wallet interface showing balance and action buttons
- **Layout.tsx**: Simple container wrapper
- **WalletCard.tsx**: Balance display and action buttons (Send/Receive/Earn/Top Up)
- **Modal components**: SendModal, ReceiveModal, EarnModal for each action

### State Management
- React hooks and context via Dynamic SDK
- Local state for modals, balances, and loading states
- Uses `useTokenBalances`, `useDynamicContext`, `useIsLoggedIn` from Dynamic SDK

### Blockchain Integration
- **Solana Devnet** only (configured in environment)
- Uses `@solana/web3.js` and `@solana/spl-token` for USDC operations
- USDC balance fetching via associated token accounts
- Environment variables: `VITE_USDC_MINT_ADDRESS`, `VITE_SOLANA_RPC_URL`

## Key Environment Variables

Required in `.env`:
- `VITE_DYNAMIC_ENVIRONMENT_ID` - Dynamic SDK environment ID
- `VITE_USDC_MINT_ADDRESS` - Solana Devnet USDC mint address
- `VITE_SOLANA_RPC_URL` - Solana RPC endpoint (defaults to devnet)

## UI Framework

- **Tailwind CSS** for styling with custom components in `src/components/ui/`
- **Radix UI** primitives for accessible components
- **Lucide React** for icons
- Mobile-first design optimized for Farcaster frame embedding

## Development Notes

- The project uses Vite with node polyfills for crypto/buffer support
- TypeScript strict mode enabled with path aliases (`@/*` -> `./src/*`)
- ESLint configured for React hooks and TypeScript
- Server configured to allow specific hosts for tunneling (Cloudflare tunnel)

## Farcaster Integration

- Frame configuration in `public/.well-known/farcaster.json`
- Uses `@farcaster/frame-sdk` for frame lifecycle management
- Designed as a mini-app to run within Farcaster clients

## Testing & Build

- Run `npm run build` to verify TypeScript compilation and build
- Use `npm run lint` to check code quality
- Preview builds with `npm run preview`