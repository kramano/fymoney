// src/Wallet.tsx
import { useCallback } from "react";
import WalletCard from "@/components/WalletCard";
import WalletLoader from "@/components/WalletLoader";
import WalletError from "@/components/WalletError";
import WalletResults from "@/components/WalletResults";
import ModalContainer from "@/components/ModalContainer";
import {
    useDynamicContext,
    useIsLoggedIn
} from "@dynamic-labs/sdk-react-core";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useWalletValidation } from "@/hooks/useWalletValidation";
import { useModalState } from "@/hooks/useModalState";
import { useFundingActions } from "@/hooks/useFundingActions";
import { WALLET_ACTIONS, type WalletAction } from "@/constants/wallet";
import { ENV_CONFIG } from "@/config/environment";
import { Toaster } from "@/components/ui/toaster";

const Wallet = () => {
    const isLoggedIn = useIsLoggedIn();
    const { sdkHasLoaded, primaryWallet } = useDynamicContext();

    // Custom hooks
    const { validationError, clearValidationError } = useWalletValidation();
    const { balance: usdcBalance, isLoading: isLoadingBalance, refetch: refetchBalance } = useWalletBalance(ENV_CONFIG.usdcMintAddress);
    const { activeModal, openModal, closeModal } = useModalState();
    const { handleTopUp, result, error, clearResults, hasResults } = useFundingActions();
    
    // Loading state (registration now handled via Dynamic events in App.tsx)
    const isComponentLoading = !sdkHasLoaded || !isLoggedIn || !primaryWallet || isLoadingBalance;

    // Handle wallet actions
    const handleAction = useCallback((action: WalletAction) => {
        if (action === WALLET_ACTIONS.TOPUP) {
            handleTopUp();
        } else {
            openModal(action as Exclude<typeof action, 'topup'>);
        }
    }, [handleTopUp, openModal]);

    // Handle transaction success (refresh balance)
    const handleTransactionSuccess = useCallback(() => {
        // Refresh USDC balance after successful transaction
        refetchBalance();
    }, [refetchBalance]);

    // Show loading state
    if (isComponentLoading) {
        return (
            <WalletLoader
                loadingState={{
                    sdkHasLoaded,
                    isLoggedIn,
                    hasPrimaryWallet: !!primaryWallet
                }}
            />
        );
    }

    return (
        <>
            <div className="min-h-screen p-4 flex flex-col items-center justify-center">
                <div className="space-y-4">
                    <WalletCard
                        onAction={handleAction}
                        usdcBalance={parseFloat(usdcBalance)}
                    />

                    {validationError && (
                        <WalletError
                            error={validationError}
                            onClear={clearValidationError}
                        />
                    )}

                    {hasResults && (
                        <WalletResults
                            result={result}
                            error={error}
                            onClear={clearResults}
                        />
                    )}
                </div>

                <ModalContainer
                    activeModal={activeModal}
                    onClose={closeModal}
                    usdcBalance={usdcBalance}
                    usdcMintAddress={ENV_CONFIG.usdcMintAddress}
                    onTransactionSuccess={handleTransactionSuccess}
                />
            </div>

            {/* Toast notifications */}
            <Toaster />
        </>
    );
};

export default Wallet;