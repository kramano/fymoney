// src/components/ModalContainer.tsx
import Modal from './Modal';
import SendModal from './SendModal';
import ReceiveModal from './ReceiveModal';
import EarnModal from './EarnModal';
import SettingsModal from './SettingsModal';
import { ModalType } from '@/hooks/useModalState';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

interface ModalContainerProps {
    activeModal: ModalType;
    onClose: () => void;
    usdcBalance: string;
    usdcMintAddress?: string;
    onTransactionSuccess?: () => void;
}

/**
 * Pure modal coordination - no business logic
 * Each modal handles its own feature logic internally
 */
const ModalContainer = ({
                            activeModal,
                            onClose,
                            usdcBalance,
                            usdcMintAddress,
                            onTransactionSuccess
                        }: ModalContainerProps) => {
    const { user, primaryWallet } = useDynamicContext();
    
    const userEmail = user?.email || '';
    const walletAddress = primaryWallet?.address || '';

    return (
        <>
            {/* Send Modal - handles USDC logic internally */}
            <Modal isOpen={activeModal === "send"} onClose={onClose} title="Send USDC">
                <SendModal
                    onClose={onClose}
                    balance={usdcBalance}
                    usdcMintAddress={usdcMintAddress}
                    onTransactionSuccess={onTransactionSuccess}
                />
            </Modal>

            {/* Receive Modal */}
            <Modal isOpen={activeModal === "receive"} onClose={onClose} title="Receive">
                <ReceiveModal 
                    onClose={onClose} 
                    userEmail={userEmail}
                    walletAddress={walletAddress}
                />
            </Modal>

            {/* Earn Modal */}
            <Modal isOpen={activeModal === "earn"} onClose={onClose} title="Start Earning">
                <EarnModal onClose={onClose} />
            </Modal>

            {/* Settings Modal */}
            <Modal isOpen={activeModal === "settings"} onClose={onClose} title="Settings">
                <SettingsModal onClose={onClose} />
            </Modal>
        </>
    );
};

export default ModalContainer;