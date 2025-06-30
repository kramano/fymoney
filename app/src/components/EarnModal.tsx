
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useVault } from '@/hooks/useVault';
import { useToast } from '@/hooks/use-toast';

interface EarnModalProps {
  onClose: () => void;
  balance: string;
  onTransactionSuccess?: () => void;
}

const EarnModal = ({ onClose, balance, onTransactionSuccess }: EarnModalProps) => {
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  
  const {
    userBalance: vaultBalance,
    totalDeposits,
    hasDeposit,
    isLoading: vaultLoading,
    deposit,
    withdraw,
    refreshBalance,
    clearError: clearVaultError
  } = useVault();

  const availableBalance = parseFloat(balance);
  const depositAmount = parseFloat(amount) || 0;
  const vaultBalanceUsdc = vaultBalance / 1_000_000; // Convert from lamports

  // Calculate estimated earnings
  const dailyEarnings = depositAmount * 0.055 / 365;
  const monthlyEarnings = dailyEarnings * 30;
  const annualEarnings = depositAmount * 0.055;

  const validateAmount = () => {
    if (!amount || depositAmount <= 0) {
      setError('Please enter a valid amount');
      return false;
    }
    if (depositAmount > availableBalance) {
      setError('Insufficient balance');
      return false;
    }
    return true;
  };

  const handleDeposit = async () => {
    if (!validateAmount()) return;

    setIsDepositing(true);
    setError(null);
    clearVaultError();

    try {
      const amountInLamports = Math.round(depositAmount * 1_000_000);
      const result = await deposit(amountInLamports);

      if (result.success) {
        toast({
          title: "Success",
          description: `Deposited ${depositAmount.toFixed(2)} USDC to vault!`
        });
        
        // Call success callback to refresh wallet balance
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }

        // Close modal after success
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(result.error || 'Deposit failed');
      }
    } catch (error) {
      console.error('Deposit failed:', error);
      setError('Deposit failed. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };

  const handleWithdraw = async () => {
    if (vaultBalance === 0) {
      setError('No funds to withdraw');
      return;
    }

    setIsDepositing(true);
    setError(null);
    clearVaultError();

    try {
      const result = await withdraw(vaultBalance);

      if (result.success) {
        toast({
          title: "Success", 
          description: `Withdrew ${vaultBalanceUsdc.toFixed(2)} USDC from vault!`
        });
        
        // Call success callback to refresh wallet balance
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }

        // Close modal after success
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(result.error || 'Withdrawal failed');
      }
    } catch (error) {
      console.error('Withdrawal failed:', error);
      setError('Withdrawal failed. Please try again.');
    } finally {
      setIsDepositing(false);
    }
  };

  return (
    <div className="fy-space-y-6">
      <div className="fy-space-y-4">
        <div style={{ 
          background: 'rgba(139, 92, 246, 0.1)', 
          border: '1px solid rgba(139, 92, 246, 0.2)', 
          borderRadius: 'var(--radius-medium)', 
          padding: '16px',
          backdropFilter: 'blur(10px)'
        }} className="fy-text-center">
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>⚡</div>
          <h3 style={{ 
            fontWeight: 700, 
            color: '#7c3aed', 
            marginBottom: '4px',
            fontSize: '18px'
          }}>
            Earn 5.5% APY on your USDC
          </h3>
          <p style={{ fontSize: '14px', color: '#8b5cf6' }}>
            Start earning yield on your idle USDC tokens
          </p>
        </div>

        {/* Show current vault deposit if user has one */}
        {hasDeposit && (
          <div style={{ 
            background: 'rgba(34, 197, 94, 0.1)', 
            border: '1px solid rgba(34, 197, 94, 0.2)', 
            borderRadius: 'var(--radius-medium)', 
            padding: '12px'
          }}>
            <div style={{ fontSize: '14px', color: '#22c55e' }} className="fy-text-center">
              💰 Current vault deposit: <strong>{vaultBalanceUsdc.toFixed(2)} USDC</strong>
            </div>
          </div>
        )}
        
        <div className="fy-space-y-4">
          <label className="fy-label">
            Amount to Deposit (USDC)
          </label>
          <input
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="fy-input"
            disabled={isDepositing}
            step="0.01"
            min="0"
            max={availableBalance}
          />
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Available: {availableBalance.toFixed(2)} USDC
          </div>
        </div>
        
        {depositAmount > 0 && (
          <div style={{ 
            background: 'var(--gradient-balance)', 
            border: '1px solid var(--border-light)', 
            borderRadius: 'var(--radius-medium)', 
            padding: '16px'
          }}>
            <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }} className="fy-space-y-4">
              <div className="fy-flex-between">
                <span>Est. daily earnings:</span>
                <span style={{ fontWeight: 600 }}>${dailyEarnings.toFixed(3)}</span>
              </div>
              <div className="fy-flex-between">
                <span>Est. monthly earnings:</span>
                <span style={{ fontWeight: 600 }}>${monthlyEarnings.toFixed(2)}</span>
              </div>
              <div className="fy-flex-between" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                <span>Annual yield (5.5% APY):</span>
                <span>${annualEarnings.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="fy-alert-error">
            {error}
          </div>
        )}
      </div>
      
      <div className="fy-flex fy-gap-3">
        <button
          onClick={onClose}
          className="fy-button-secondary"
          style={{ flex: 1, height: '48px' }}
          disabled={isDepositing}
        >
          Cancel
        </button>

        {hasDeposit ? (
          <button
            onClick={handleWithdraw}
            disabled={isDepositing || vaultBalance === 0}
            className="fy-button-primary"
            style={{ 
              flex: 1, 
              height: '48px',
              background: '#dc2626',
              cursor: isDepositing ? 'not-allowed' : 'pointer',
              opacity: isDepositing ? 0.6 : 1
            }}
          >
            {isDepositing ? (
              <>
                <Loader2 style={{ width: '16px', height: '16px', marginRight: '8px' }} className="animate-spin" />
                Withdrawing...
              </>
            ) : (
              <>
                <span style={{ fontSize: '16px', marginRight: '8px' }}>💰</span>
                Withdraw All
              </>
            )}
          </button>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !amount || parseFloat(amount) <= 0}
            className="fy-button-primary"
            style={{ 
              flex: 1, 
              height: '48px',
              background: 'var(--gradient-earn)',
              boxShadow: '0 6px 16px rgba(139, 92, 246, 0.3)',
              cursor: (isDepositing || !amount || parseFloat(amount) <= 0) ? 'not-allowed' : 'pointer',
              opacity: (isDepositing || !amount || parseFloat(amount) <= 0) ? 0.6 : 1
            }}
          >
            {isDepositing ? (
              <>
                <Loader2 style={{ width: '16px', height: '16px', marginRight: '8px' }} className="animate-spin" />
                Depositing...
              </>
            ) : (
              <>
                <span style={{ fontSize: '16px', marginRight: '8px' }}>⚡</span>
                Start Earning
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default EarnModal;
