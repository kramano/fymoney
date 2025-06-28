
import { useState } from "react";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import WalletCard from "@/components/WalletCard";
import Modal from "@/components/Modal";
import SendModal from "@/components/SendModal";
import ReceiveModal from "@/components/ReceiveModal";
import EarnModal from "@/components/EarnModal";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { ENV_CONFIG } from "@/config/environment";

const Index = () => {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { user, primaryWallet } = useDynamicContext();
  const { balance: usdcBalance, refetch: refetchBalance } = useWalletBalance();

  const closeModal = () => setActiveModal(null);

  const userEmail = user?.email || '';
  const walletAddress = primaryWallet?.address || '';

  const handleTransactionSuccess = () => {
    refetchBalance();
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      <WalletCard onAction={setActiveModal} />
      
      <Modal isOpen={activeModal === "send"} onClose={closeModal} title="Send USDC">
        <SendModal 
          onClose={closeModal}
          balance={usdcBalance}
          usdcMintAddress={ENV_CONFIG.usdcMintAddress}
          onTransactionSuccess={handleTransactionSuccess}
        />
      </Modal>
      
      <Modal isOpen={activeModal === "receive"} onClose={closeModal} title="Receive USDC">
        <ReceiveModal 
          onClose={closeModal}
          userEmail={userEmail}
          walletAddress={walletAddress}
        />
      </Modal>
      
      <Modal isOpen={activeModal === "earn"} onClose={closeModal} title="Start Earning">
        <EarnModal onClose={closeModal} />
      </Modal>
    </div>
  );
};

export default Index;
