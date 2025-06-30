
import { WalletAction } from "@/constants/wallet";
import { useVault } from "@/hooks/useVault";

interface WalletCardProps {
  onAction: (action: WalletAction) => void;
  usdcBalance?: number;
}

const WalletCard = ({ onAction, usdcBalance = 97.00 }: WalletCardProps) => {
  const { userBalance: vaultBalance, hasDeposit } = useVault();
  
  // Calculate daily earnings from vault balance (5.5% APY)
  const vaultBalanceUsdc = vaultBalance / 1_000_000; // Convert from lamports
  const dailyEarnings = vaultBalanceUsdc * 0.055 / 365;
  const apy = "5.5%";

  return (
    <div className="fy-wallet-card glass-container" style={{ position: 'relative' }}>
      {/* Settings Button */}
      <button
        onClick={() => onAction("settings")}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
          zIndex: 10
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        <svg 
          style={{ width: '20px', height: '20px', color: 'var(--text-secondary)' }} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" 
          />
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
          />
        </svg>
      </button>

      {/* FY Money Header */}
      <div className="fy-header">
        <div className="fy-logo">FY</div>
        <div className="fy-brand-info">
          <h1 className="fy-brand-name">FY Money</h1>
          <p className="fy-brand-tagline">Your USDC Yield Wallet</p>
        </div>
      </div>

      {/* Enhanced Balance Display */}
      <div className="fy-balance-section">
        <p className="fy-balance-label">Total Balance</p>
        <div className="fy-balance-amount">
          ${usdcBalance.toFixed(2)} <span className="fy-balance-currency">USDC</span>
        </div>
        {hasDeposit && (
          <div className="fy-earning-status">
            <div className="fy-earning-dot"></div>
            <span className="fy-earning-text">Earning +${dailyEarnings.toFixed(3)} ({apy} APY)</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="fy-space-y-4">
        <button
          onClick={() => onAction("send")}
          className="fy-action-button fy-send-btn"
        >
          <span className="fy-button-icon">→</span>
          Send USDC
        </button>

        <button
          onClick={() => onAction("receive")}
          className="fy-action-button fy-receive-btn"
        >
          <span className="fy-button-icon">↓</span>
          Receive USDC
        </button>

        <button
          onClick={() => onAction("earn")}
          className="fy-action-button fy-earn-btn"
        >
          <span className="fy-button-icon">⚡</span>
          Start Earning
        </button>

        <button
          onClick={() => onAction("topup")}
          className="fy-action-button fy-topup-btn"
        >
          <span className="fy-button-icon">+</span>
          Top Up
        </button>

      </div>

      {/* Footer */}
      <div className="fy-footer">
        <p className="fy-footer-text">
          Powered by Solana • fymoney.xyz
        </p>
      </div>
    </div>
  );
};

export default WalletCard;
