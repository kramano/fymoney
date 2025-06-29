import { useState, useEffect } from "react";
import { Loader2, Shield, Clock, Mail, RefreshCw } from "lucide-react";
import { useEscrow } from "@/hooks/useEscrow";
import { escrowService } from "@/services/escrowService";
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';

interface EscrowModalProps {
    onClose: () => void;
}

interface EscrowData {
    publicKey: string;
    account: any;
    recipientEmailDisplay: string;
    statusDisplay: string;
    amountDisplay: string;
    expiresAt: Date;
    canClaim: boolean;
    canReclaim: boolean;
}

const EscrowModal = ({ onClose }: EscrowModalProps) => {
    const { primaryWallet } = useDynamicContext();
    const [escrows, setEscrows] = useState<EscrowData[]>([]);
    const [isLoadingEscrows, setIsLoadingEscrows] = useState(true);
    const [selectedEscrow, setSelectedEscrow] = useState<EscrowData | null>(null);
    const [, setAction] = useState<'claim' | 'reclaim' | null>(null);

    const { 
        claimEscrow, 
        reclaimExpiredEscrow, 
        isLoading, 
        error, 
        clearError 
    } = useEscrow({
        onSuccess: () => {
            setSelectedEscrow(null);
            setAction(null);
            loadEscrows(); // Refresh the list
        },
        onError: (error) => {
            console.error('Escrow action failed:', error);
        }
    });

    const loadEscrows = async () => {
        if (!primaryWallet) return;

        setIsLoadingEscrows(true);
        try {
            escrowService.initializeProgram(primaryWallet);
            const escrowAccounts = await escrowService.getEscrowsForSender(primaryWallet.address);

            const escrowData: EscrowData[] = escrowAccounts.map(({ account, publicKey }) => {
                const expiresAt = new Date(account.expiresAt.toNumber() * 1000);
                const isExpired = escrowService.isEscrowExpired(account);
                const statusDisplay = escrowService.getEscrowStatusString(account);
                
                return {
                    publicKey: publicKey.toString(),
                    account,
                    recipientEmailDisplay: `***@${Buffer.from(account.recipientEmailHash).toString('hex').slice(-8)}`, // Obfuscated email
                    statusDisplay: statusDisplay.charAt(0).toUpperCase() + statusDisplay.slice(1),
                    amountDisplay: escrowService.formatAmount(account.amount),
                    expiresAt,
                    canClaim: false, // User is sender, not recipient
                    canReclaim: isExpired && !!account.status.active
                };
            });

            setEscrows(escrowData);
        } catch (error) {
            console.error('Error loading escrows:', error);
        } finally {
            setIsLoadingEscrows(false);
        }
    };

    useEffect(() => {
        loadEscrows();
    }, [primaryWallet]);

    const handleAction = async (escrowData: EscrowData, actionType: 'claim' | 'reclaim') => {
        setSelectedEscrow(escrowData);
        setAction(actionType);
        clearError();

        try {
            if (actionType === 'claim') {
                await claimEscrow(escrowData.publicKey);
            } else {
                await reclaimExpiredEscrow(escrowData.publicKey);
            }
        } catch (error) {
            console.error('Action failed:', error);
        }
    };

    const formatTimeRemaining = (expiresAt: Date): string => {
        const now = new Date();
        const diff = expiresAt.getTime() - now.getTime();
        
        if (diff <= 0) return 'Expired';
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        if (days > 0) return `${days}d ${hours}h`;
        return `${hours}h`;
    };

    const getStatusColor = (status: string) => {
        switch (status.toLowerCase()) {
            case 'active': return '#22c55e';
            case 'claimed': return '#3b82f6';
            case 'expired': return '#ef4444';
            default: return '#6b7280';
        }
    };

    return (
        <div className="fy-space-y-6">
            {/* Header */}
            <div className="fy-text-center">
                <h3 className="fy-label" style={{ fontSize: '18px', marginBottom: '8px' }}>
                    <Shield style={{ height: '20px', width: '20px', display: 'inline', marginRight: '8px' }} />
                    My Escrows
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    Manage your sent escrows
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="fy-alert-error">
                    {error}
                </div>
            )}

            {/* Loading State */}
            {isLoadingEscrows && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px',
                    color: 'var(--text-secondary)'
                }}>
                    <Loader2 style={{ height: '24px', width: '24px', margin: '0 auto 12px' }} className="animate-spin" />
                    <p>Loading your escrows...</p>
                </div>
            )}

            {/* Empty State */}
            {!isLoadingEscrows && escrows.length === 0 && (
                <div style={{ 
                    textAlign: 'center', 
                    padding: '40px 20px',
                    color: 'var(--text-secondary)'
                }}>
                    <Shield style={{ height: '48px', width: '48px', margin: '0 auto 16px', opacity: 0.5 }} />
                    <h4 style={{ fontWeight: 600, marginBottom: '8px' }}>No Escrows Found</h4>
                    <p style={{ fontSize: '14px' }}>You haven't created any escrows yet.</p>
                </div>
            )}

            {/* Escrows List */}
            {!isLoadingEscrows && escrows.length > 0 && (
                <div className="fy-space-y-3">
                    {escrows.map((escrow) => (
                        <div
                            key={escrow.publicKey}
                            style={{
                                background: 'var(--gradient-balance)',
                                border: '1px solid var(--border-light)',
                                borderRadius: 'var(--radius-small)',
                                padding: '16px'
                            }}
                        >
                            {/* Escrow Header */}
                            <div className="fy-flex-between" style={{ marginBottom: '12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{
                                        background: getStatusColor(escrow.statusDisplay),
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%'
                                    }} />
                                    <span style={{ fontWeight: 600, fontSize: '16px' }}>
                                        {escrow.amountDisplay} USDC
                                    </span>
                                </div>
                                <span style={{
                                    background: `${getStatusColor(escrow.statusDisplay)}20`,
                                    color: getStatusColor(escrow.statusDisplay),
                                    padding: '4px 8px',
                                    borderRadius: '12px',
                                    fontSize: '12px',
                                    fontWeight: 600
                                }}>
                                    {escrow.statusDisplay}
                                </span>
                            </div>

                            {/* Escrow Details */}
                            <div className="fy-space-y-2" style={{ fontSize: '14px' }}>
                                <div className="fy-flex" style={{ alignItems: 'center', gap: '8px' }}>
                                    <Mail style={{ height: '14px', width: '14px', color: 'var(--text-muted)' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>To:</span>
                                    <span style={{ fontFamily: 'monospace' }}>{escrow.recipientEmailDisplay}</span>
                                </div>
                                
                                <div className="fy-flex" style={{ alignItems: 'center', gap: '8px' }}>
                                    <Clock style={{ height: '14px', width: '14px', color: 'var(--text-muted)' }} />
                                    <span style={{ color: 'var(--text-secondary)' }}>Expires:</span>
                                    <span>{formatTimeRemaining(escrow.expiresAt)}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            {escrow.canReclaim && (
                                <div style={{ marginTop: '16px' }}>
                                    <button
                                        onClick={() => handleAction(escrow, 'reclaim')}
                                        disabled={isLoading && selectedEscrow?.publicKey === escrow.publicKey}
                                        style={{
                                            width: '100%',
                                            padding: '8px 16px',
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: 'var(--radius-small)',
                                            fontWeight: 600,
                                            fontSize: '14px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}
                                    >
                                        {isLoading && selectedEscrow?.publicKey === escrow.publicKey ? (
                                            <>
                                                <Loader2 style={{ height: '14px', width: '14px' }} className="animate-spin" />
                                                Reclaiming...
                                            </>
                                        ) : (
                                            <>
                                                <RefreshCw style={{ height: '14px', width: '14px' }} />
                                                Reclaim Expired Escrow
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* PDA Info (for debugging) */}
                            <details style={{ marginTop: '12px' }}>
                                <summary style={{ 
                                    fontSize: '12px', 
                                    color: 'var(--text-muted)', 
                                    cursor: 'pointer' 
                                }}>
                                    Advanced Details
                                </summary>
                                <div style={{ 
                                    marginTop: '8px', 
                                    padding: '8px', 
                                    background: 'rgba(0,0,0,0.1)', 
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: 'var(--text-muted)',
                                    wordBreak: 'break-all'
                                }}>
                                    PDA: {escrow.publicKey}
                                </div>
                            </details>
                        </div>
                    ))}
                </div>
            )}

            {/* Refresh Button */}
            {!isLoadingEscrows && (
                <div style={{ textAlign: 'center', paddingTop: '16px' }}>
                    <button
                        onClick={loadEscrows}
                        disabled={isLoading}
                        style={{
                            background: 'var(--border-light)',
                            color: 'var(--text-secondary)',
                            border: '1px solid var(--border-light)',
                            borderRadius: 'var(--radius-small)',
                            padding: '8px 16px',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            margin: '0 auto'
                        }}
                    >
                        <RefreshCw style={{ height: '14px', width: '14px' }} />
                        Refresh
                    </button>
                </div>
            )}

            {/* Close Button */}
            <div style={{ paddingTop: '16px' }}>
                <button
                    type="button"
                    onClick={onClose}
                    className="fy-button-secondary"
                    style={{ width: '100%', height: '48px' }}
                    disabled={isLoading}
                >
                    Close
                </button>
            </div>
        </div>
    );
};

export default EscrowModal;