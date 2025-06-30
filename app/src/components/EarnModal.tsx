
import { useState, useEffect } from 'react';
import { Loader2, Zap, Shield, ArrowUpRight, TrendingUp } from 'lucide-react';
import { useVault } from '@/hooks/useVault';
import { useToast } from '@/hooks/use-toast';
import { APYService, Protocol } from '@/services/apyService';
import { SimpleRebalancingService } from '@/services/simpleRebalancingService';

interface EarnModalProps {
  onClose: () => void;
  balance: string;
  onTransactionSuccess?: () => void;
}

const EarnModal = ({ onClose, balance, onTransactionSuccess }: EarnModalProps) => {
  const [amount, setAmount] = useState('');
  const [isDepositing, setIsDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentProtocol, setCurrentProtocol] = useState<Protocol>({
    name: 'Kamino Finance',
    apy: 5.5,
    emoji: '🏦',
    risk: 'Low'
  });
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

  // Calculate estimated earnings using current protocol APY
  const dailyEarnings = depositAmount * (currentProtocol.apy / 100) / 365;
  const monthlyEarnings = dailyEarnings * 30;
  const annualEarnings = depositAmount * (currentProtocol.apy / 100);

  // Load current best protocol and start auto-rebalancing
  useEffect(() => {
    const loadProtocol = async () => {
      try {
        const bestProtocol = await APYService.getBestProtocol();
        setCurrentProtocol(bestProtocol);
      } catch (error) {
        console.error('Failed to load protocol:', error);
      }
    };

    loadProtocol();
    
    // Start auto-rebalancing if user has deposits
    if (vaultBalance > 0) {
      SimpleRebalancingService.startAutoRebalancing(vaultBalanceUsdc);
    }
  }, [vaultBalance, vaultBalanceUsdc]);

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
      
      // Your existing vault deposit
      const result = await deposit(amountInLamports);

      if (result.success) {
        // Trigger rebalancing
        const newBalance = vaultBalanceUsdc + depositAmount;
        await SimpleRebalancingService.checkAndRebalance(newBalance);
        
        // Update UI to show current protocol
        const bestProtocol = await APYService.getBestProtocol();
        setCurrentProtocol(bestProtocol);

        toast({
          title: "Success",
          description: `Deposited ${depositAmount.toFixed(2)} USDC to ${bestProtocol.name}!`
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
        {/* APY Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(236, 72, 153, 0.1) 100%)', 
          border: '1px solid rgba(139, 92, 246, 0.2)', 
          borderRadius: 'var(--radius-medium)', 
          padding: '24px',
          backdropFilter: 'blur(10px)'
        }} className="fy-text-center">
          <div className="fy-flex-center fy-gap-2" style={{ marginBottom: '12px' }}>
            <Zap style={{ color: '#eab308', width: '24px', height: '24px' }} />
          </div>
          <div style={{ 
            fontSize: '32px', 
            fontWeight: 700, 
            color: '#7c3aed', 
            marginBottom: '8px'
          }}>
            {currentProtocol.apy.toFixed(1)}% APY
          </div>
          <div className="fy-flex-center fy-gap-2" style={{ marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', color: '#7c3aed' }}>currently on</span>
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.8)', 
              padding: '4px 12px', 
              borderRadius: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span style={{ fontSize: '14px' }}>{currentProtocol.emoji}</span>
              <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>{currentProtocol.name}</span>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: '#7c3aed' }}>
            Auto-rebalanced daily for optimal returns
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
        {hasDeposit ? (
          <>
            {/* Deposit Button */}
            <button
              onClick={handleDeposit}
              disabled={isDepositing || !amount || parseFloat(amount) <= 0}
              style={{ 
                flex: 1, 
                height: '48px',
                background: '#16a34a',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-medium)',
                fontWeight: 500,
                fontSize: '16px',
                cursor: (isDepositing || !amount || parseFloat(amount) <= 0) ? 'not-allowed' : 'pointer',
                opacity: (isDepositing || !amount || parseFloat(amount) <= 0) ? 0.6 : 1,
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!isDepositing && amount && parseFloat(amount) > 0) {
                  e.currentTarget.style.background = '#15803d';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDepositing && amount && parseFloat(amount) > 0) {
                  e.currentTarget.style.background = '#16a34a';
                }
              }}
            >
              {isDepositing ? (
                <>
                  <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                  Optimizing...
                </>
              ) : (
                <>
                  <TrendingUp style={{ width: '16px', height: '16px' }} />
                  Deposit
                </>
              )}
            </button>
            
            {/* Withdraw Button */}
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
                  Withdraw
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={isDepositing || !amount || parseFloat(amount) <= 0}
            style={{ 
              flex: 1, 
              height: '48px',
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-medium)',
              fontWeight: 500,
              fontSize: '16px',
              cursor: (isDepositing || !amount || parseFloat(amount) <= 0) ? 'not-allowed' : 'pointer',
              opacity: (isDepositing || !amount || parseFloat(amount) <= 0) ? 0.6 : 1,
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              if (!isDepositing && amount && parseFloat(amount) > 0) {
                e.currentTarget.style.background = '#15803d';
              }
            }}
            onMouseLeave={(e) => {
              if (!isDepositing && amount && parseFloat(amount) > 0) {
                e.currentTarget.style.background = '#16a34a';
              }
            }}
          >
            {isDepositing ? (
              <>
                <Loader2 style={{ width: '16px', height: '16px' }} className="animate-spin" />
                Optimizing...
              </>
            ) : (
              <>
                <TrendingUp style={{ width: '16px', height: '16px' }} />
                Start Earning
              </>
            )}
          </button>
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        paddingTop: '16px', 
        borderTop: '1px solid #e5e7eb' 
      }}>
        <div className="fy-flex-center" style={{ 
          fontSize: '12px', 
          color: '#6b7280', 
          marginBottom: '8px',
          gap: '24px'
        }}>
          <div className="fy-flex-center fy-gap-1">
            <Shield style={{ width: '12px', height: '12px' }} />
            <span>Secured</span>
          </div>
          <div className="fy-flex-center fy-gap-1">
            <Zap style={{ width: '12px', height: '12px' }} />
            <span>Auto-optimized</span>
          </div>
          <div className="fy-flex-center fy-gap-1">
            <ArrowUpRight style={{ width: '12px', height: '12px' }} />
            <span>Withdraw anytime</span>
          </div>
        </div>
        <p style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#9ca3af' 
        }}>
          Powered by Kamino, Raydium, and Jupiter
        </p>
      </div>
    </div>
  );
};

export default EarnModal;
