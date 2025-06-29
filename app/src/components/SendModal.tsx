import { useState } from "react";
import { Loader2, Mail, DollarSign, AlertCircle, CheckCircle } from "lucide-react";
import EmailResolver from "@/services/emailResolver";
import { GaslessTransactionService } from "@/services/gaslessTransactionService";
import TransferIntentService from "@/services/transferService";
import { useDynamicContext } from "@dynamic-labs/sdk-react-core";
import { isSolanaWallet } from "@dynamic-labs/solana";
import { useToast } from "@/hooks/use-toast";

interface SendModalProps {
    onClose: () => void;
    balance: string;
    usdcMintAddress?: string; // Kept for interface compatibility 
    onTransactionSuccess?: () => void;
}

const SendModal = ({ onClose, balance, onTransactionSuccess }: SendModalProps) => {
    const [email, setEmail] = useState("");
    const [amount, setAmount] = useState("");
    const [errors, setErrors] = useState<{ email?: string; amount?: string }>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [transactionSignature, setTransactionSignature] = useState<string | null>(null);

    const { primaryWallet, user } = useDynamicContext();
    const { toast } = useToast();

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
            await executeNewEscrowFlow();
        }
    };

    const executeNewEscrowFlow = async () => {
        // Validate wallet and user state
        if (!primaryWallet || !isSolanaWallet(primaryWallet)) {
            setError("Please connect a Solana wallet");
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Step 1: Check if recipient is registered
            const isRegistered = await EmailResolver.resolveEmailToAddress(email);
            
            if (isRegistered) {
                // Direct transfer for registered users
                const amountInLamports = Math.round(parseFloat(amount) * 1_000_000);
                const transaction = await GaslessTransactionService.createGaslessTransaction({
                    senderAddress: primaryWallet.address,
                    recipientAddress: isRegistered,
                    amount: amountInLamports
                });

                // Sign and send transaction
                const signer = await primaryWallet.getSigner();
                const { signature } = await signer.signAndSendTransaction(transaction);
                
                setTransactionSignature(signature);
                toast({ title: "Success", description: "USDC sent successfully!" });
                
                onTransactionSuccess?.();
                
                // Close modal after successful transaction
                setTimeout(() => {
                    onClose();
                }, 1500); // Small delay to let user see the success message
            } else {
                // Step 2: Create escrow for unregistered users
                const amountInLamports = Math.round(parseFloat(amount) * 1_000_000);
                const escrowResult = await GaslessTransactionService.createEscrowTransaction({
                    senderAddress: primaryWallet.address,
                    recipientEmail: email,
                    amount: amountInLamports,
                    expirationDays: 30
                });

                // Sign and send escrow transaction
                const signer = await primaryWallet.getSigner();
                const { signature: escrowSignature } = await signer.signAndSendTransaction(escrowResult.transaction);
                
                // Step 3: Create transfer intent with escrow PDA
                await TransferIntentService.createTransferIntent({
                    senderWalletAddress: primaryWallet.address,
                    senderEmail: user?.email,
                    recipientEmail: email,
                    amount: amountInLamports,
                    escrowPda: escrowResult.escrowPda
                });

                setTransactionSignature(escrowSignature);
                toast({ 
                    title: "Success", 
                    description: "Escrow created and invitation sent!" 
                });
                
                onTransactionSuccess?.();
                
                // Close modal after successful escrow transaction
                setTimeout(() => {
                    onClose();
                }, 1500); // Small delay to let user see the success message
            }
        } catch (error) {
            console.error("Send failed:", error);
            const errorMessage = error instanceof Error ? error.message : "Send failed. Please try again.";
            setError(errorMessage);
            toast({ 
                title: "Error", 
                description: errorMessage,
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAmountChange = (value: string) => {
        // Only allow numbers and decimal point
        const sanitized = value.replace(/[^0-9.]/g, '');
        const parts = sanitized.split('.');
        if (parts.length > 2) {
            // Keep only first decimal point
            const formatted = parts[0] + '.' + parts.slice(1).join('');
            setAmount(formatted);
        } else {
            setAmount(sanitized);
        }
        
        // Clear amount error when user starts typing
        if (errors.amount) {
            setErrors(prev => ({ ...prev, amount: undefined }));
        }
    };

    const isFormValid = () => {
        return email && amount && validateEmail(email) && !validateAmount(amount);
    };

    // Success state
    if (transactionSignature) {
        return (
            <div className="space-y-6">
                <div className="text-center">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-green-600">
                        Transfer Successful!
                    </h3>
                    <p className="text-sm text-gray-600 mt-2">
                        Your USDC has been sent successfully.
                    </p>
                </div>
                
                <button
                    onClick={onClose}
                    className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    Done
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Recipient Email Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Recipient Email
                </label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                        setEmail(e.target.value);
                        if (errors.email) {
                            setErrors(prev => ({ ...prev, email: undefined }));
                        }
                    }}
                    placeholder="Enter recipient's email"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                />
                {errors.email && (
                    <p className="text-red-500 text-sm mt-1">{errors.email}</p>
                )}
            </div>

            {/* Amount Input */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Amount (USDC)
                </label>
                <input
                    type="text"
                    value={amount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    placeholder="0.00"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.amount ? 'border-red-300' : 'border-gray-300'
                    }`}
                    disabled={isLoading}
                />
                {errors.amount && (
                    <p className="text-red-500 text-sm mt-1">{errors.amount}</p>
                )}
                <p className="text-gray-500 text-sm mt-1">
                    Available: {balance} USDC
                </p>
            </div>

            {/* Error Display */}
            {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">{error}</span>
                </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3">
                <button
                    onClick={onClose}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    disabled={isLoading}
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={!isFormValid() || isLoading}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Sending...
                        </>
                    ) : (
                        'Send USDC'
                    )}
                </button>
            </div>
        </div>
    );
};

export default SendModal;