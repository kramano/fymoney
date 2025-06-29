import { useState, useEffect } from "react";
import { Loader2, Mail, DollarSign, AlertCircle, CheckCircle, User, Shield, Zap, Info } from "lucide-react";
import { useSendWithEscrow, SendMethod } from "@/hooks/useSendWithEscrow";

interface SendModalProps {
    onClose: () => void;
    balance: string;
    usdcMintAddress?: string;
    onTransactionSuccess?: () => void;
}

const SendModal = ({ onClose, balance, usdcMintAddress, onTransactionSuccess }: SendModalProps) => {
    const [email, setEmail] = useState("");
    const [amount, setAmount] = useState("");
    const [errors, setErrors] = useState<{ email?: string; amount?: string }>({});
    const [step, setStep] = useState<'input' | 'method' | 'confirm'>('input');
    const [selectedMethod, setSelectedMethod] = useState<SendMethod | null>(null);
    const [recipientStatus, setRecipientStatus] = useState<'registered' | 'not-registered' | null>(null);
    const [expirationDays, setExpirationDays] = useState<number>(7);

    // Hook handles all the business logic
    const { 
        sendWithMethod, 
        checkRecipientStatus, 
        recommendedMethod, 
        isLoading, 
        error, 
        clearError 
    } = useSendWithEscrow({
        usdcMintAddress,
        onSuccess: (signature, method) => {
            console.log(`${method} send successful:`, signature);
            onTransactionSuccess?.();
            onClose();
        },
        onError: (error) => {
            console.error('Send failed:', error);
            // Error handling is done in the hook via toast notifications
        }
    });

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validateAmount = (amount: string) => {
        const num = parseFloat(amount);
        const balanceNum = parseFloat(balance);

        if (isNaN(num) || num <= 0) {
            return "Amount must be greater than 0";
        }

        if (num > balanceNum) {
            return "Insufficient balance";
        }

        return null;
    };

    const handleSubmit = async () => {
        // Clear any previous container-level errors
        clearError();

        const newErrors: { email?: string; amount?: string } = {};

        // Validate email
        if (!email) {
            newErrors.email = "Email is required";
        } else if (!validateEmail(email)) {
            newErrors.email = "Please enter a valid email address";
        }

        // Validate amount
        const amountError = validateAmount(amount);
        if (!amount) {
            newErrors.amount = "Amount is required";
        } else if (amountError) {
            newErrors.amount = amountError;
        }

        setErrors(newErrors);

        if (Object.keys(newErrors).length === 0) {
            if (step === 'input') {
                // Check recipient status and move to method selection
                setStep('method');
                try {
                    const status = await checkRecipientStatus(email);
                    setRecipientStatus(status);
                    // Auto-select recommended method
                    if (recommendedMethod) {
                        setSelectedMethod(recommendedMethod);
                    }
                } catch (error) {
                    console.error('Error checking recipient:', error);
                    setRecipientStatus('not-registered');
                    setSelectedMethod('escrow');
                }
            } else if (step === 'method') {
                // Move to confirmation step
                setStep('confirm');
            } else {
                // Execute transaction
                if (!selectedMethod) {
                    setErrors({ email: 'Please select a send method' });
                    return;
                }
                try {
                    await sendWithMethod(email, amount, selectedMethod, expirationDays);
                } catch (error) {
                    console.error("Send failed:", error);
                }
            }
        }
    };

    const handleAmountChange = (value: string) => {
        // Only allow numbers and decimal point
        const sanitized = value.replace(/[^0-9.]/g, '');

        // Prevent multiple decimal points
        const parts = sanitized.split('.');
        if (parts.length > 2) {
            return;
        }

        // Limit to 6 decimal places (USDC precision)
        if (parts[1] && parts[1].length > 6) {
            return;
        }

        setAmount(sanitized);

        // Clear amount error when user types
        if (errors.amount) {
            setErrors(prev => ({ ...prev, amount: undefined }));
        }
    };

    const handleEmailChange = (value: string) => {
        setEmail(value);

        // Clear email error when user types
        if (errors.email) {
            setErrors(prev => ({ ...prev, email: undefined }));
        }
    };


    const setMaxAmount = () => {
        setAmount(balance);
    };

    const handleBack = () => {
        if (step === 'confirm') {
            setStep('method');
        } else if (step === 'method') {
            setStep('input');
        }
    };

    // Reset state when email changes
    useEffect(() => {
        setRecipientStatus(null);
        setSelectedMethod(null);
        if (step !== 'input') {
            setStep('input');
        }
    }, [email]);

    // Render method selection step
    if (step === 'method') {
        return (
            <div className="fy-space-y-6">
                {/* Hook-level error display */}
                {error && (
                    <div className="fy-alert-error">
                        {error}
                    </div>
                )}

                {/* Method Selection Header */}
                <div className="fy-text-center">
                    <h3 className="fy-label" style={{ fontSize: '18px', marginBottom: '8px' }}>Choose Send Method</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>How would you like to send {amount} USDC to {email}?</p>
                </div>

                {/* Recipient Status */}
                {recipientStatus && (
                    <div style={{
                        background: recipientStatus === 'registered' 
                            ? 'rgba(34, 197, 94, 0.1)' 
                            : 'rgba(249, 115, 22, 0.1)',
                        border: `1px solid ${recipientStatus === 'registered' 
                            ? 'rgba(34, 197, 94, 0.2)' 
                            : 'rgba(249, 115, 22, 0.2)'}`,
                        borderRadius: 'var(--radius-small)',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}>
                        <Info style={{ 
                            height: '16px', 
                            width: '16px', 
                            color: recipientStatus === 'registered' ? '#22c55e' : '#f97316'
                        }} />
                        <span style={{ fontSize: '14px' }}>
                            {recipientStatus === 'registered' 
                                ? 'Recipient has a FyMoney wallet' 
                                : 'Recipient needs to create a FyMoney wallet'}
                        </span>
                    </div>
                )}

                {/* Method Options */}
                <div className="fy-space-y-3">
                    {/* Direct Transfer Option */}
                    <div 
                        onClick={() => setSelectedMethod('direct')}
                        style={{
                            background: selectedMethod === 'direct' 
                                ? 'rgba(59, 130, 246, 0.1)' 
                                : 'var(--gradient-balance)',
                            border: `2px solid ${selectedMethod === 'direct' 
                                ? '#3b82f6' 
                                : 'var(--border-light)'}`,
                            borderRadius: 'var(--radius-small)',
                            padding: '16px',
                            cursor: recipientStatus === 'not-registered' ? 'not-allowed' : 'pointer',
                            opacity: recipientStatus === 'not-registered' ? 0.5 : 1,
                            transition: 'all 0.2s'
                        }}
                    >
                        <div className="fy-flex" style={{ gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{
                                background: selectedMethod === 'direct' ? '#3b82f6' : 'rgba(59, 130, 246, 0.2)',
                                borderRadius: '50%',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Zap style={{ 
                                    height: '20px', 
                                    width: '20px', 
                                    color: selectedMethod === 'direct' ? 'white' : '#3b82f6'
                                }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ 
                                    fontWeight: 600, 
                                    color: 'var(--text-primary)', 
                                    marginBottom: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    Instant Transfer
                                    {recommendedMethod === 'direct' && (
                                        <span style={{
                                            background: '#22c55e',
                                            color: 'white',
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 600
                                        }}>RECOMMENDED</span>
                                    )}
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Send directly to their wallet immediately</p>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>✓ Instant delivery • ✓ No expiration</div>
                                {recipientStatus === 'not-registered' && (
                                    <div style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>⚠ Recipient must have a FyMoney wallet</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Escrow Option */}
                    <div 
                        onClick={() => setSelectedMethod('escrow')}
                        style={{
                            background: selectedMethod === 'escrow' 
                                ? 'rgba(59, 130, 246, 0.1)' 
                                : 'var(--gradient-balance)',
                            border: `2px solid ${selectedMethod === 'escrow' 
                                ? '#3b82f6' 
                                : 'var(--border-light)'}`,
                            borderRadius: 'var(--radius-small)',
                            padding: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.2s'
                        }}
                    >
                        <div className="fy-flex" style={{ gap: '12px', alignItems: 'flex-start' }}>
                            <div style={{
                                background: selectedMethod === 'escrow' ? '#3b82f6' : 'rgba(59, 130, 246, 0.2)',
                                borderRadius: '50%',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Shield style={{ 
                                    height: '20px', 
                                    width: '20px', 
                                    color: selectedMethod === 'escrow' ? 'white' : '#3b82f6'
                                }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ 
                                    fontWeight: 600, 
                                    color: 'var(--text-primary)', 
                                    marginBottom: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    Secure Escrow
                                    {recommendedMethod === 'escrow' && (
                                        <span style={{
                                            background: '#22c55e',
                                            color: 'white',
                                            fontSize: '10px',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            fontWeight: 600
                                        }}>RECOMMENDED</span>
                                    )}
                                </div>
                                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '8px' }}>Hold funds securely until recipient claims</p>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>✓ Anyone can claim • ✓ Auto-refund if unclaimed</div>
                                {selectedMethod === 'escrow' && (
                                    <div style={{ marginTop: '12px' }}>
                                        <label style={{ 
                                            fontSize: '14px', 
                                            fontWeight: 600, 
                                            color: 'var(--text-primary)',
                                            marginBottom: '8px',
                                            display: 'block'
                                        }}>Expiration</label>
                                        <select
                                            value={expirationDays}
                                            onChange={(e) => setExpirationDays(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '8px 12px',
                                                borderRadius: 'var(--radius-small)',
                                                border: '1px solid var(--border-light)',
                                                background: 'var(--background)',
                                                color: 'var(--text-primary)',
                                                fontSize: '14px'
                                            }}
                                        >
                                            <option value={1}>1 day</option>
                                            <option value={3}>3 days</option>
                                            <option value={7}>7 days</option>
                                            <option value={14}>14 days</option>
                                            <option value={30}>30 days</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="fy-flex fy-gap-3" style={{ paddingTop: '16px' }}>
                    <button
                        type="button"
                        onClick={handleBack}
                        className="fy-button-secondary"
                        style={{ flex: 1, height: '48px' }}
                        disabled={isLoading}
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="fy-button-primary"
                        style={{ flex: 1, height: '48px' }}
                        disabled={isLoading || !selectedMethod || (selectedMethod === 'direct' && recipientStatus === 'not-registered')}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 style={{ height: '16px', width: '16px', marginRight: '8px' }} className="animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CheckCircle style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                                Continue
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Render confirmation step
    if (step === 'confirm') {
        return (
            <div className="fy-space-y-6">
                {/* Hook-level error display */}
                {error && (
                    <div className="fy-alert-error">
                        {error}
                    </div>
                )}

                {/* Confirmation Header */}
                <div className="fy-text-center">
                    <h3 className="fy-label" style={{ fontSize: '18px', marginBottom: '8px' }}>Confirm Transaction</h3>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Please review the details before sending</p>
                </div>

                {/* Recipient Information */}
                <div style={{ 
                    background: 'rgba(59, 130, 246, 0.1)', 
                    border: '1px solid rgba(59, 130, 246, 0.2)', 
                    borderRadius: 'var(--radius-small)', 
                    padding: '16px',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div className="fy-flex" style={{ gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ 
                            background: 'rgba(59, 130, 246, 0.2)', 
                            borderRadius: '50%', 
                            padding: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <User style={{ height: '20px', width: '20px', color: '#2563eb' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {email}
                            </div>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Recipient</p>
                        </div>
                    </div>
                </div>

                {/* Transaction Details */}
                <div style={{ 
                    background: 'var(--gradient-balance)', 
                    border: '1px solid var(--border-light)', 
                    borderRadius: 'var(--radius-small)', 
                    padding: '16px'
                }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Transaction Details</h4>
                    <div style={{ fontSize: '14px', gap: '8px' }}>
                        <div className="fy-flex-between" style={{ fontWeight: 600, marginBottom: '8px' }}>
                            <span>Amount:</span>
                            <span>{amount} USDC</span>
                        </div>
                        <div className="fy-flex-between" style={{ marginBottom: '8px' }}>
                            <span>Method:</span>
                            <span style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                fontWeight: 600
                            }}>
                                {selectedMethod === 'direct' ? (
                                    <><Zap style={{ height: '14px', width: '14px' }} /> Instant Transfer</>
                                ) : (
                                    <><Shield style={{ height: '14px', width: '14px' }} /> Secure Escrow</>
                                )}
                            </span>
                        </div>
                        {selectedMethod === 'escrow' && (
                            <div className="fy-flex-between">
                                <span>Expires in:</span>
                                <span>{expirationDays} {expirationDays === 1 ? 'day' : 'days'}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="fy-flex fy-gap-3" style={{ paddingTop: '16px' }}>
                    <button
                        type="button"
                        onClick={handleBack}
                        className="fy-button-secondary"
                        style={{ flex: 1, height: '48px' }}
                        disabled={isLoading}
                    >
                        Back
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        className="fy-button-primary"
                        style={{ flex: 1, height: '48px' }}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 style={{ height: '16px', width: '16px', marginRight: '8px' }} className="animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                {selectedMethod === 'direct' ? (
                                    <><Zap style={{ height: '16px', width: '16px', marginRight: '8px' }} />Send Now</>
                                ) : (
                                    <><Shield style={{ height: '16px', width: '16px', marginRight: '8px' }} />Create Escrow</>
                                )}
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Render input step
    return (
        <div className="fy-space-y-6">
            {/* Hook-level error display */}
            {error && (
                <div className="fy-alert-error">
                    {error}
                </div>
            )}

            {/* Recipient Email */}
            <div className="fy-space-y-4">
                <label htmlFor="email" className="fy-label">
                    Send to
                </label>
                <div style={{ position: 'relative' }}>
                    <Mail style={{ 
                        position: 'absolute', 
                        left: '12px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: 'var(--text-muted)', 
                        height: '16px', 
                        width: '16px' 
                    }} />
                    <input
                        id="email"
                        type="email"
                        placeholder="recipient@example.com"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        className={`fy-input ${errors.email ? 'border-red-500' : ''}`}
                        style={{ paddingLeft: '40px' }}
                        disabled={isLoading}
                    />
                </div>
                {errors.email && (
                    <p className="fy-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                        <AlertCircle style={{ height: '12px', width: '12px' }} />
                        {errors.email}
                    </p>
                )}
            </div>

            {/* Amount */}
            <div className="fy-space-y-4">
                <label htmlFor="amount" className="fy-label">
                    Amount
                </label>
                <div style={{ position: 'relative' }}>
                    <DollarSign style={{ 
                        position: 'absolute', 
                        left: '12px', 
                        top: '50%', 
                        transform: 'translateY(-50%)', 
                        color: 'var(--text-muted)', 
                        height: '16px', 
                        width: '16px' 
                    }} />
                    <input
                        id="amount"
                        type="text"
                        placeholder="0.00"
                        value={amount}
                        onChange={(e) => handleAmountChange(e.target.value)}
                        className={`fy-input ${errors.amount ? 'border-red-500' : ''}`}
                        style={{ paddingLeft: '40px', paddingRight: '80px' }}
                        disabled={isLoading}
                    />
                    <button
                        type="button"
                        onClick={setMaxAmount}
                        style={{ 
                            position: 'absolute', 
                            right: '8px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            padding: '4px 8px', 
                            background: 'rgba(59, 130, 246, 0.1)', 
                            color: '#2563eb', 
                            fontSize: '12px', 
                            borderRadius: '6px',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600
                        }}
                        disabled={isLoading}
                    >
                        MAX
                    </button>
                </div>
                <div className="fy-flex-between" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    <span>Available: {balance} USDC</span>
                    {amount && !errors.amount && (
                        <span>≈ ${parseFloat(amount || '0').toFixed(2)}</span>
                    )}
                </div>
                {errors.amount && (
                    <p className="fy-alert-error" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px' }}>
                        <AlertCircle style={{ height: '12px', width: '12px' }} />
                        {errors.amount}
                    </p>
                )}
            </div>

            {/* Transaction Preview */}
            {amount && !errors.amount && (
                <div style={{ 
                    background: 'var(--gradient-balance)', 
                    border: '1px solid var(--border-light)', 
                    borderRadius: 'var(--radius-small)', 
                    padding: '16px'
                }}>
                    <h4 style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>Transaction Summary</h4>
                    <div style={{ fontSize: '14px' }}>
                        <div className="fy-flex-between">
                            <span style={{ color: 'var(--text-secondary)' }}>Amount:</span>
                            <span style={{ fontWeight: 600 }}>{amount} USDC</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="fy-flex fy-gap-3" style={{ paddingTop: '16px' }}>
                <button
                    type="button"
                    onClick={onClose}
                    className="fy-button-secondary"
                    style={{ flex: 1, height: '48px' }}
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={handleSubmit}
                    className="fy-button-primary"
                    style={{ flex: 1, height: '48px' }}
                    disabled={isLoading || !email || !amount}
                >
                    {isLoading ? (
                        <>
                            <Loader2 style={{ height: '16px', width: '16px', marginRight: '8px' }} className="animate-spin" />
                            Sending...
                        </>
                    ) : (
                        <>
                            <CheckCircle style={{ height: '16px', width: '16px', marginRight: '8px' }} />
                            Continue
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default SendModal;