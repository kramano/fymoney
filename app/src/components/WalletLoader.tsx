import { LOADING_MESSAGES } from '@/constants/wallet';

interface LoadingState {
  sdkHasLoaded: boolean;
  isLoggedIn: boolean;
  hasPrimaryWallet: boolean;
}

interface WalletLoaderProps {
  loadingState: LoadingState;
}

const WalletLoader = ({ loadingState }: WalletLoaderProps) => {
  const { sdkHasLoaded, isLoggedIn, hasPrimaryWallet } = loadingState;

  const getLoadingMessage = () => {
    if (!sdkHasLoaded) return LOADING_MESSAGES.SDK_INITIALIZING;
    if (!isLoggedIn) return LOADING_MESSAGES.LOGIN_REQUIRED;
    if (!hasPrimaryWallet) return LOADING_MESSAGES.WALLET_CONNECTION_REQUIRED;
    return LOADING_MESSAGES.SDK_INITIALIZING;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex flex-col items-center justify-center">
      <div className="p-5 bg-white rounded-xl shadow-md max-w-sm text-center">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Loading Wallet
        </h2>
        
        <div className="mb-4">
          <p className="text-gray-600 text-sm mb-2">
            {getLoadingMessage()}
          </p>
        </div>

        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-500 rounded-full mx-auto animate-spin" />
      </div>
    </div>
  );
};

export default WalletLoader;