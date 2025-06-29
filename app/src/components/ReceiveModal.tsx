import { useState, useEffect } from 'react';
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, Check, Clock, Send, Loader2 } from "lucide-react";
import TransferIntentService, { UnclaimedTransfer } from "@/services/transferService";
import EmailNotificationService, { PaymentRequestData } from "@/services/emailNotificationService";
import { useClaimTransfer } from "@/hooks/useClaimTransfer";

interface ReceiveModalProps {
  onClose: () => void;
  userEmail: string;
  walletAddress: string;
  onTransactionSuccess?: () => void;
}

interface PaymentRequest {
  recipientEmail: string;
  amount: string;
  message: string;
}

const ReceiveModal = ({ onClose, userEmail, walletAddress, onTransactionSuccess }: ReceiveModalProps) => {
  const { user } = useDynamicContext();
  const [activeTab, setActiveTab] = useState<'unclaimed' | 'email'>('email');
  const [unclaimedTransfers, setUnclaimedTransfers] = useState<UnclaimedTransfer[]>([]);
  const [totalUnclaimedAmount, setTotalUnclaimedAmount] = useState(0);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest>({
    recipientEmail: '',
    amount: '',
    message: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isLoadingUnclaimed, setIsLoadingUnclaimed] = useState(true);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [claimingTransfers, setClaimingTransfers] = useState<Set<string>>(new Set());

  // Use the claim transfer hook
  const { claimTransfer, isLoading: isClaimLoading, error: claimError, clearError: clearClaimError } = useClaimTransfer();

  // Fetch unclaimed transfers on mount
  useEffect(() => {
    const fetchUnclaimedTransfers = async () => {
      try {
        setIsLoadingUnclaimed(true);
        const result = await TransferIntentService.getUnclaimedTransfersByEmail(userEmail);
        setUnclaimedTransfers(result.transfers);
        setTotalUnclaimedAmount(result.totalAmount);
        
        // Auto-switch to unclaimed tab if there are transfers
        if (result.transfers.length > 0) {
          setActiveTab('unclaimed');
        }
      } catch (error) {
        console.error('Failed to fetch unclaimed transfers:', error);
      } finally {
        setIsLoadingUnclaimed(false);
      }
    };

    fetchUnclaimedTransfers();
  }, [userEmail]);

  const handleClaimTransfer = async (transferId: string) => {
    try {
      // Track which transfer is being claimed
      setClaimingTransfers(prev => new Set(prev).add(transferId));
      setError(null);
      clearClaimError();
      
      console.log('🎯 Claiming transfer:', transferId);
      const result = await claimTransfer(transferId);
      
      if (result.success) {
        console.log('🎉 Transfer claimed successfully!', result.txHash);
        
        // Refresh unclaimed transfers list
        const refreshResult = await TransferIntentService.getUnclaimedTransfersByEmail(userEmail);
        setUnclaimedTransfers(refreshResult.transfers);
        setTotalUnclaimedAmount(refreshResult.totalAmount);
        
        // Call success callback to refresh wallet balance
        if (onTransactionSuccess) {
          onTransactionSuccess();
        }
        
        // Show success message
        alert(`Transfer claimed successfully! Transaction: ${result.txHash}`);
      } else {
        setError(result.error || 'Failed to claim transfer');
      }
    } catch (error) {
      console.error('Failed to claim transfer:', error);
      setError('Failed to claim transfer');
    } finally {
      // Remove from claiming set
      setClaimingTransfers(prev => {
        const newSet = new Set(prev);
        newSet.delete(transferId);
        return newSet;
      });
    }
  };

  const handleSendPaymentRequest = async () => {
    if (!paymentRequest.recipientEmail || !paymentRequest.amount) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setIsSendingRequest(true);
      setError(null);

      const requestData: PaymentRequestData = {
        fromEmail: userEmail,
        fromName: user?.email || userEmail,
        toEmail: paymentRequest.recipientEmail,
        amount: paymentRequest.amount,
        message: paymentRequest.message,
        walletAddress: walletAddress
      };

      const result = await EmailNotificationService.sendPaymentRequest(requestData);

      if (result.success) {
        // Reset form
        setPaymentRequest({
          recipientEmail: '',
          amount: '',
          message: ''
        });
        
        // Show success message
        alert('Payment request sent successfully!');
      } else {
        setError(result.error || 'Failed to send payment request');
      }
    } catch (error) {
      console.error('Failed to send payment request:', error);
      setError('Failed to send payment request');
    } finally {
      setIsSendingRequest(false);
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(userEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch (error) {
      console.error('Failed to copy email:', error);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    // Debug logging for timezone issues
    if (diffMs < 0) {
      console.log('Future timestamp detected:', {
        transferTime: date.toISOString(),
        currentTime: now.toISOString(),
        diffMs: diffMs,
        diffMins: Math.floor(diffMs / (1000 * 60))
      });
    }
    
    // Handle invalid dates or future dates (within 5 minutes tolerance for clock skew)
    if (isNaN(date.getTime()) || diffMs < -300000) { // -5 minutes tolerance
      return 'just now';
    }
    
    // If it's slightly in the future (clock skew), treat as "just now"
    if (diffMs < 0) {
      return 'just now';
    }
    
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const hasUnclaimedTransfers = unclaimedTransfers.length > 0;

  return (
    <div className="fy-space-y-6" style={{ width: '100%', maxWidth: '400px' }}>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'unclaimed' | 'email')}>
        <TabsList className={`grid w-full ${hasUnclaimedTransfers ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {hasUnclaimedTransfers && (
            <TabsTrigger value="unclaimed" className="text-xs">
              Claim
              <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                {unclaimedTransfers.length}
              </Badge>
            </TabsTrigger>
          )}
          <TabsTrigger value="email" className="text-xs">
            <Mail className="w-3 h-3 mr-1" />
            Email
          </TabsTrigger>
        </TabsList>

        {hasUnclaimedTransfers && (
          <TabsContent value="unclaimed" className="fy-space-y-4">
            <div className="text-center">
              <h3 style={{ 
                fontSize: '16px', 
                fontWeight: 600, 
                marginBottom: '8px',
                color: 'var(--text-primary)'
              }}>
                Claim Your Money
              </h3>
              <div style={{
                background: 'rgba(16, 185, 129, 0.1)',
                borderRadius: 'var(--radius-medium)',
                padding: '12px',
                marginBottom: '16px',
                border: '1px solid rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{ 
                  fontSize: '20px', 
                  fontWeight: 700, 
                  color: '#059669',
                  marginBottom: '4px'
                }}>
                  ${totalUnclaimedAmount.toFixed(2)}
                </div>
                <div style={{ fontSize: '12px', color: '#065f46' }}>
                  Total waiting to be claimed
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                People sent you money before you created your wallet. Claim it now!
              </p>
            </div>

            {isLoadingUnclaimed ? (
              <div className="text-center" style={{ padding: '20px' }}>
                <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Loading transfers...
                </p>
              </div>
            ) : (
              <div className="fy-space-y-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {unclaimedTransfers.map((transfer) => (
                  <div 
                    key={transfer.id} 
                    style={{
                      border: '1px solid var(--border-light)',
                      borderRadius: 'var(--radius-medium)',
                      padding: '12px',
                      background: 'var(--glass-bg)'
                    }}
                  >
                    <div className="fy-flex" style={{ justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          ${transfer.amount} {transfer.tokenSymbol}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          From: {transfer.senderWallet.slice(0, 8)}...{transfer.senderWallet.slice(-4)}
                        </div>
                        {transfer.message && (
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '4px' }}>
                            "{transfer.message}"
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {formatTimeAgo(transfer.timestamp)}
                        </div>
                      </div>
                      <div className="fy-flex" style={{ alignItems: 'center', gap: '8px' }}>
                        <Clock className="w-3 h-3 text-yellow-500" />
                      </div>
                    </div>

                    <button 
                      onClick={() => handleClaimTransfer(transfer.id)}
                      disabled={claimingTransfers.has(transfer.id) || isClaimLoading}
                      className="fy-button-primary"
                      style={{ 
                        width: '100%', 
                        height: '32px',
                        fontSize: '12px',
                        background: claimingTransfers.has(transfer.id) || isClaimLoading ? '#9ca3af' : '#dc2626',
                        cursor: claimingTransfers.has(transfer.id) || isClaimLoading ? 'not-allowed' : 'pointer',
                        opacity: claimingTransfers.has(transfer.id) || isClaimLoading ? 0.6 : 1
                      }}
                    >
                      {claimingTransfers.has(transfer.id) ? (
                        <>
                          <Loader2 style={{ width: '12px', height: '12px', marginRight: '6px' }} className="animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        `Claim $${parseFloat(transfer.amount.toString()).toFixed(2)}`
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        )}

        <TabsContent value="email" className="fy-space-y-4">
          <div className="fy-space-y-4">
            {/* Info Banner */}
            <div style={{
              background: 'rgba(59, 130, 246, 0.1)',
              borderRadius: 'var(--radius-medium)',
              padding: '12px',
              textAlign: 'center',
              border: '1px solid rgba(59, 130, 246, 0.2)'
            }}>
              <p style={{ fontSize: '12px', color: '#1e40af' }}>
                Anyone can send you USDC using your email: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{userEmail}</span>
              </p>
            </div>

            {/* Request Payment Section */}
            <div>
              <div className="text-center" style={{ marginBottom: '16px' }}>
                <h3 style={{ 
                  fontSize: '16px', 
                  fontWeight: 600, 
                  marginBottom: '4px',
                  color: 'var(--text-primary)'
                }}>
                  Request Payment
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Send a payment request via email
                </p>
              </div>

              <div className="fy-space-y-3">
                <div>
                  <label className="fy-label">
                    Send to Email *
                  </label>
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    value={paymentRequest.recipientEmail}
                    onChange={(e) => setPaymentRequest(prev => ({ ...prev, recipientEmail: e.target.value }))}
                    className="fy-input"
                  />
                </div>

                <div className="fy-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="fy-label">
                      Amount (USDC) *
                    </label>
                    <input
                      type="number"
                      placeholder="25.00"
                      value={paymentRequest.amount}
                      onChange={(e) => setPaymentRequest(prev => ({ ...prev, amount: e.target.value }))}
                      className="fy-input"
                    />
                  </div>
                  <div>
                    <label className="fy-label">
                      Message
                    </label>
                    <input
                      type="text"
                      placeholder="For lunch"
                      value={paymentRequest.message}
                      onChange={(e) => setPaymentRequest(prev => ({ ...prev, message: e.target.value }))}
                      className="fy-input"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSendPaymentRequest} 
                  className="fy-button-primary"
                  style={{ width: '100%', height: '36px' }}
                  disabled={!paymentRequest.recipientEmail || !paymentRequest.amount || isSendingRequest}
                >
                  {isSendingRequest ? (
                    <>
                      <Loader2 style={{ width: '14px', height: '14px', marginRight: '8px' }} className="animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Error display */}
      {(error || claimError) && (
        <div className="fy-alert-error">
          {error || claimError}
        </div>
      )}

      <div className="fy-flex" style={{ gap: '12px' }}>
        <button
          onClick={handleCopyEmail}
          className="fy-button-secondary"
          style={{ flex: 1, height: '48px', borderRadius: 'var(--radius-large)' }}
        >
          {copiedEmail ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 mr-2" />
              Copy Email
            </>
          )}
        </button>
        <button
          onClick={onClose}
          className="fy-button-primary"
          style={{ 
            flex: 1, 
            height: '48px',
            borderRadius: 'var(--radius-large)',
            background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)'
          }}
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default ReceiveModal;