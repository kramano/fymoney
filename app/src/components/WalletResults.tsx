interface WalletResultsProps {
  result?: string;
  error?: string;
  onClear: () => void;
}

const WalletResults = ({ result, error, onClear }: WalletResultsProps) => {
  if (!result && !error) return null;

  return (
    <div className="mt-5 space-y-3">
      <div className="p-4 bg-gray-50 rounded-lg max-w-md">
        {error ? (
          <pre className="text-red-600 text-sm whitespace-pre-wrap break-words m-0">
            {error}
          </pre>
        ) : (
          <pre className="text-gray-800 text-sm whitespace-pre-wrap break-words m-0">
            {result && (typeof result === "string" && result.startsWith("{")
              ? JSON.stringify(JSON.parse(result), null, 2)
              : result)}
          </pre>
        )}
      </div>
      
      <div className="text-center">
        <button
          onClick={onClear}
          className="px-4 py-2 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        >
          Clear
        </button>
      </div>
    </div>
  );
};

export default WalletResults;