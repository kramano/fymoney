
interface EarnModalProps {
  onClose: () => void;
}

const EarnModal = ({ onClose }: EarnModalProps) => {
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
        
        <div className="fy-space-y-4">
          <label className="fy-label">
            Amount to Deposit (USDC)
          </label>
          <input
            type="number"
            placeholder="0.00"
            className="fy-input"
          />
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Available: $12.34 USDC
          </div>
        </div>
        
        <div style={{ 
          background: 'var(--gradient-balance)', 
          border: '1px solid var(--border-light)', 
          borderRadius: 'var(--radius-medium)', 
          padding: '16px'
        }}>
          <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }} className="fy-space-y-4">
            <div className="fy-flex-between">
              <span>Est. daily earnings:</span>
              <span style={{ fontWeight: 600 }}>$0.027</span>
            </div>
            <div className="fy-flex-between">
              <span>Est. monthly earnings:</span>
              <span style={{ fontWeight: 600 }}>$0.81</span>
            </div>
            <div className="fy-flex-between" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              <span>Annual yield (5.5% APY):</span>
              <span>$9.72</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="fy-flex fy-gap-3">
        <button
          onClick={onClose}
          className="fy-button-secondary"
          style={{ flex: 1, height: '48px' }}
        >
          Cancel
        </button>
        <button
          className="fy-button-primary"
          style={{ 
            flex: 1, 
            height: '48px',
            background: 'var(--gradient-earn)',
            boxShadow: '0 6px 16px rgba(139, 92, 246, 0.3)'
          }}
        >
          <span style={{ fontSize: '16px', marginRight: '8px' }}>⚡</span>
          Start Earning
        </button>
      </div>
    </div>
  );
};

export default EarnModal;
