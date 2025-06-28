// App.tsx
import {
    DynamicContextProvider,
} from "@dynamic-labs/sdk-react-core";
import {SolanaWalletConnectors} from "@dynamic-labs/solana";
import sdk from "@farcaster/frame-sdk";
import {useEffect} from "react";
import { handleAuthSuccess } from "@/services/registrationHandler";
import ConnectMenu from "@/components/ConnectMenu";
import Layout from "@/components/Layout";
import WalletErrorBoundary from "@/components/WalletErrorBoundary";
import Wallet from "@/Wallet.tsx";

function App() {
    useEffect(() => {
        const setupFarcaster = async () => {
            try {
                await sdk.actions.ready();
            } catch (error) {
                console.error("Error setting up Farcaster:", error);
            }
        };

        setupFarcaster();
    }, []);



    const cssOverrides = `
  /* Glassmorphic Theme Variables */
  .dynamic-shadow-dom {
    --dynamic-connect-button-background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --dynamic-connect-button-color: #ffffff;
    --dynamic-text-primary: #1f2937;
    --dynamic-text-secondary: #6b7280;
    --dynamic-base-1: rgba(255, 255, 255, 0.95);
    --dynamic-base-2: rgba(255, 255, 255, 0.9);
    --dynamic-base-3: rgba(255, 255, 255, 0.85);
    --dynamic-font-family-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    --dynamic-border-radius: 20px;
    --dynamic-border-radius-large: 24px;
  }

  /* Glassmorphic modal styling */
  .dynamic-widget-modal,
  .dynamic-funding-modal,
  .dynamic-modal,
  [class*="modal"][class*="dynamic"] {
    border-radius: 24px !important;
    width: 440px !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1) !important;
    overflow: hidden !important;
    position: relative !important;
  }

  /* Add gradient top line to modals */
  .dynamic-widget-modal::before,
  .dynamic-funding-modal::before,
  .dynamic-modal::before {
    content: '' !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    height: 4px !important;
    background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899) !important;
    z-index: 1 !important;
  }

  /* Glassmorphic backdrop */
  .dynamic-widget-modal__backdrop {
    background: rgba(0, 0, 0, 0.5) !important;
    backdrop-filter: blur(8px) !important;
  }

  /* Glassmorphic connect button */
  .dynamic-connect-button,
  button[data-testid="connect-button"],
  .dynamic-widget button,
  [class*="connect"] button {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    border: none !important;
    border-radius: 18px !important;
    padding: 16px 24px !important;
    font-weight: 700 !important;
    font-size: 16px !important;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1) !important;
    transition: all 0.2s ease !important;
    backdrop-filter: blur(10px) !important;
  }

  .dynamic-connect-button:hover,
  button[data-testid="connect-button"]:hover,
  .dynamic-widget button:hover,
  [class*="connect"] button:hover {
    background: linear-gradient(135deg, #5b6ee8 0%, #6d42a0 100%) !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12) !important;
  }

  /* Glassmorphic modal content styling */
  .dynamic-widget-modal-content {
    background: transparent !important;
    color: #1f2937 !important;
  }

  /* Text styling throughout Dynamic components */
  .dynamic-text, 
  .dynamic-widget-modal h1,
  .dynamic-widget-modal h2,
  .dynamic-widget-modal h3,
  .dynamic-widget-modal p,
  .dynamic-widget-modal span,
  .dynamic-widget-modal label {
    color: #1f2937 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  }

  /* Secondary text styling */
  .dynamic-text-secondary,
  .dynamic-widget-modal .dynamic-text-secondary {
    color: #6b7280 !important;
  }

  /* Glassmorphic input fields */
  .dynamic-input,
  .dynamic-widget-modal input[type="text"],
  .dynamic-widget-modal input[type="email"],
  .dynamic-widget-modal input[type="password"] {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(148, 163, 184, 0.1) !important;
    border-radius: 12px !important;
    color: #1e293b !important;
    padding: 16px 20px !important;
    font-size: 16px !important;
    font-weight: 500 !important;
    transition: all 0.2s ease !important;
  }

  .dynamic-input:focus,
  .dynamic-widget-modal input:focus {
    border-color: #4f46e5 !important;
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1) !important;
    background: rgba(255, 255, 255, 0.95) !important;
    outline: none !important;
  }

  .dynamic-input::placeholder,
  .dynamic-widget-modal input::placeholder {
    color: #94a3b8 !important;
    font-weight: 400 !important;
  }

  /* Glassmorphic button styling for secondary actions */
  .dynamic-button-secondary {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(148, 163, 184, 0.1) !important;
    color: #6b7280 !important;
    border-radius: 12px !important;
    padding: 16px 24px !important;
    font-weight: 600 !important;
    transition: all 0.2s ease !important;
  }

  .dynamic-button-secondary:hover {
    background: rgba(255, 255, 255, 0.95) !important;
    border-color: #6b7280 !important;
    transform: translateY(-1px) !important;
  }

  /* Glassmorphic wallet selector cards */
  .dynamic-wallet-list-item,
  .dynamic-wallet-item {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(148, 163, 184, 0.1) !important;
    border-radius: 12px !important;
    transition: all 0.2s ease !important;
  }

  .dynamic-wallet-list-item:hover,
  .dynamic-wallet-item:hover {
    background: rgba(255, 255, 255, 0.95) !important;
    border-color: #4f46e5 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.15) !important;
  }

  /* Loading states */
  .dynamic-loading-spinner {
    border-color: #4f46e5 transparent #4f46e5 transparent !important;
  }

  /* Glassmorphic error states */
  .dynamic-error,
  .dynamic-error-message {
    background: rgba(239, 68, 68, 0.1) !important;
    border: 1px solid rgba(239, 68, 68, 0.2) !important;
    color: #dc2626 !important;
    border-radius: 12px !important;
    padding: 12px 16px !important;
    backdrop-filter: blur(10px) !important;
  }

  /* Glassmorphic success states */
  .dynamic-success {
    background: rgba(16, 185, 129, 0.1) !important;
    border: 1px solid rgba(16, 185, 129, 0.2) !important;
    color: #059669 !important;
    border-radius: 12px !important;
    padding: 12px 16px !important;
    backdrop-filter: blur(10px) !important;
  }

  /* Hide wallet selector row (avatar, address, 3-dot menu) */
  .dynamic-widget-header {
    display: none !important;
  }

  /* Hide the persistent Dynamic widget after login */
  .dynamic-widget-inline-controls {
    display: none !important;
  }

  /* Ensure Dynamic components have proper positioning */
  .dynamic-widget,
  [class*="dynamic-widget"] {
    position: relative !important;
    z-index: 1000 !important;
  }

  /* Ensure Dynamic modals are properly positioned and centered */
  .dynamic-widget-modal,
  .dynamic-funding-modal,
  .dynamic-modal,
  [class*="modal"][class*="dynamic"] {
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    z-index: 9999 !important;
    margin: 0 !important;
  }

  /* Dynamic modal backdrop positioning */
  .dynamic-widget-modal__backdrop,
  [class*="backdrop"][class*="dynamic"] {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    z-index: 9998 !important;
  }

  /* Force Dynamic connect widget to stay in place */
  .dynamic-connect-button {
    position: relative !important;
    display: inline-flex !important;
  }

  /* Glassmorphic logged in widget styling */
  .dynamic-widget-inline-controls {
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(148, 163, 184, 0.1) !important;
    border-radius: 12px !important;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
  }

  /* User profile section */
  .dynamic-user-profile {
    background: transparent !important;
  }

  .dynamic-user-profile-avatar {
    border: 2px solid rgba(148, 163, 184, 0.2) !important;
    border-radius: 50% !important;
  }

  /* Glassmorphic network badges */
  .dynamic-network-badge {
    background: rgba(79, 70, 229, 0.1) !important;
    color: #4f46e5 !important;
    border-radius: 8px !important;
    padding: 4px 8px !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    backdrop-filter: blur(10px) !important;
  }

  /* Animations for smooth feel */
  .dynamic-connect-button,
  .dynamic-wallet-list-item,
  .dynamic-button-secondary {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
  }

  /* Custom scrollbar for modal content */
  .dynamic-widget-modal *::-webkit-scrollbar {
    width: 6px !important;
  }

  .dynamic-widget-modal *::-webkit-scrollbar-track {
    background: #f3f4f6 !important;
    border-radius: 3px !important;
  }

  .dynamic-widget-modal *::-webkit-scrollbar-thumb {
    background: #d1d5db !important;
    border-radius: 3px !important;
  }

  .dynamic-widget-modal *::-webkit-scrollbar-thumb:hover {
    background: #9ca3af !important;
  }

  /* Glassmorphic QR Code styling */
  .dynamic-qr-code {
    border: 4px solid rgba(148, 163, 184, 0.2) !important;
    border-radius: 16px !important;
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(10px) !important;
    padding: 16px !important;
  }

  /* Footer links */
  .dynamic-footer-link {
    color: #6b7280 !important;
    text-decoration: none !important;
  }

  .dynamic-footer-link:hover {
    color: #4f46e5 !important;
  }

  /* Broad Dynamic component targeting for glassmorphic theme */
  [class*="dynamic"] {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
  }

  /* All Dynamic buttons glassmorphic theme */
  [class*="dynamic"] button {
    border-radius: 18px !important;
    font-weight: 700 !important;
    transition: all 0.2s ease !important;
  }

  /* All Dynamic inputs glassmorphic theme */
  [class*="dynamic"] input {
    border-radius: 12px !important;
    background: rgba(255, 255, 255, 0.8) !important;
    backdrop-filter: blur(10px) !important;
    border: 1px solid rgba(148, 163, 184, 0.1) !important;
    color: #1e293b !important;
  }

  /* All Dynamic modals glassmorphic theme */
  [class*="dynamic"][class*="modal"],
  [data-dynamic-modal] {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(20px) !important;
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 24px !important;
    color: #1f2937 !important;
  }

  /* Funding modal specific glassmorphic theme */
  [class*="funding"] [class*="modal"],
  [class*="buy"] [class*="modal"] {
    background: rgba(255, 255, 255, 0.95) !important;
    backdrop-filter: blur(20px) !important;
  }
`;


    return (
        <DynamicContextProvider
            settings={{
                environmentId: import.meta.env.VITE_DYNAMIC_ENVIRONMENT_ID,
                walletConnectors: [SolanaWalletConnectors],
                cssOverrides,
                events: {
                    onAuthSuccess: handleAuthSuccess,
                },
            }}
        >
            <WalletErrorBoundary>
                <Layout>
                    <ConnectMenu/>
                    <Wallet/>
                </Layout>
            </WalletErrorBoundary>
        </DynamicContextProvider>
    );
}

export default App;
