import { useState, useCallback } from 'react';
import { useOpenFundingOptions } from '@dynamic-labs/sdk-react-core';

export const useFundingActions = () => {
  const { openFundingOptions } = useOpenFundingOptions();
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleTopUp = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(undefined);
      setResult(undefined);
      
      openFundingOptions?.();
      // Don't set success message - just open the funding options silently
    } catch (err) {
      console.error("Failed to open top-up options:", err);
      setError(err instanceof Error ? err.message : "Failed to open top-up options");
      setResult(undefined);
    } finally {
      setIsLoading(false);
    }
  }, [openFundingOptions]);

  const clearResults = useCallback(() => {
    setResult(undefined);
    setError(undefined);
  }, []);

  return {
    handleTopUp,
    isLoading,
    result,
    error,
    clearResults,
    hasResults: !!(result || error)
  };
};