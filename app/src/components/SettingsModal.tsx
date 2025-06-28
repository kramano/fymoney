import { useState } from 'react';
import { useDynamicContext, useDeleteUserAccount } from "@dynamic-labs/sdk-react-core";
import { Separator } from "@/components/ui/separator";
import { User, Trash2, LogOut, Copy, Check, Loader2 } from "lucide-react";
import { AccountDeletionService } from "@/services/accountDeletion";

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal = ({ onClose }: SettingsModalProps) => {
  const { primaryWallet, user, handleLogOut } = useDynamicContext();
  const { deleteUser, error: dynamicDeleteError, isLoading: isDynamicDeleting } = useDeleteUserAccount();
  const [activeSection, setActiveSection] = useState('profile');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const walletAddress = primaryWallet?.address || "";
  const userEmail = user?.email || "No email available";

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopiedAddress(true);
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      
      // Use Dynamic's proper logout method
      if (handleLogOut) {
        await handleLogOut();
      }
      
      // Close the modal
      onClose();
      
      // Force page refresh to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Logout failed:', error);
      
      // Force refresh as last resort
      window.location.reload();
    }
  };

  const handleDeleteAccount = async () => {
    if (!walletAddress || !userEmail || userEmail === "No email available") {
      setDeleteError("Cannot delete account: missing user data");
      return;
    }

    // Validate the data before deletion
    if (!AccountDeletionService.validateDeletionData(userEmail, walletAddress)) {
      setDeleteError("Cannot delete account: invalid user data");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      console.log('Starting account deletion process...');
      
      // Step 1: Delete user data from Supabase and clear local data
      console.log('Cleaning up Supabase data...');
      const supabaseResult = await AccountDeletionService.deleteUserAccount(userEmail, walletAddress);
      
      if (!supabaseResult.success) {
        console.warn('Supabase cleanup failed, but continuing with Dynamic deletion:', supabaseResult.error);
      } else {
        console.log('Supabase data cleaned up successfully:', supabaseResult.deletedData);
      }

      // Step 2: Delete Dynamic account
      console.log('Deleting Dynamic account...');
      await deleteUser();
      
      console.log('Account deletion completed successfully');
      
      // Show success feedback
      const deletedData = supabaseResult.deletedData;
      alert(`Account deleted successfully! Removed: ${deletedData?.userProfiles || 0} profiles, ${deletedData?.transferIntents || 0} transfer intents, ${deletedData?.emailMappings || 0} email mappings.`);
      
      // Close modal - Dynamic should handle the logout automatically
      onClose();
      
      // Force refresh to ensure clean state
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } catch (error) {
      console.error('Account deletion error:', error);
      setDeleteError(error instanceof Error ? error.message : 'Account deletion failed');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fy-space-y-6">
      <div className="fy-flex" style={{ height: '500px' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '128px', 
          background: 'var(--gradient-balance)', 
          borderRadius: 'var(--radius-medium) 0 0 var(--radius-medium)',
          padding: '12px',
          borderRight: '1px solid var(--border-light)'
        }}>
          <div className="fy-space-y-4">
            <button
              onClick={() => setActiveSection('profile')}
              style={{
                width: '100%',
                padding: '12px 8px',
                borderRadius: 'var(--radius-small)',
                border: 'none',
                background: activeSection === 'profile' 
                  ? 'rgba(59, 130, 246, 0.1)' 
                  : 'transparent',
                color: activeSection === 'profile' 
                  ? '#2563eb' 
                  : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <User style={{ width: '16px', height: '16px' }} />
              Profile
            </button>
            <button
              onClick={() => setActiveSection('account')}
              style={{
                width: '100%',
                padding: '12px 8px',
                borderRadius: 'var(--radius-small)',
                border: 'none',
                background: activeSection === 'account' 
                  ? 'rgba(59, 130, 246, 0.1)' 
                  : 'transparent',
                color: activeSection === 'account' 
                  ? '#2563eb' 
                  : 'var(--text-secondary)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Trash2 style={{ width: '16px', height: '16px' }} />
              Account
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ 
          flex: 1, 
          padding: '24px', 
          overflowY: 'auto',
          background: 'var(--glass-bg)',
          borderRadius: '0 var(--radius-medium) var(--radius-medium) 0'
        }}>
          {activeSection === 'profile' && (
            <div className="fy-space-y-6">
              <div>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 700, 
                  marginBottom: '16px',
                  color: 'var(--text-primary)'
                }}>
                  Profile Info
                </h3>
                
                <div className="fy-space-y-4">
                  <div>
                    <label className="fy-label">Email</label>
                    <input
                      type="email"
                      value={userEmail}
                      className="fy-input"
                      disabled
                      style={{ opacity: 0.7 }}
                    />
                    <p style={{ 
                      fontSize: '12px', 
                      color: 'var(--text-muted)', 
                      marginTop: '4px' 
                    }}>
                      Email is managed by your wallet provider
                    </p>
                  </div>

                  <div>
                    <label className="fy-label">Wallet Address</label>
                    <div className="fy-flex fy-gap-3">
                      <div style={{ 
                        flex: 1, 
                        padding: '12px', 
                        background: 'var(--gradient-balance)', 
                        borderRadius: 'var(--radius-small)',
                        border: '1px solid var(--border-light)'
                      }}>
                        <code style={{ 
                          fontSize: '12px', 
                          fontFamily: 'monospace', 
                          color: 'var(--text-secondary)',
                          wordBreak: 'break-all'
                        }}>
                          {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : 'No wallet connected'}
                        </code>
                      </div>
                      <button
                        onClick={copyAddress}
                        className="fy-button-secondary"
                        style={{ 
                          padding: '12px',
                          minWidth: 'auto',
                          height: 'auto'
                        }}
                      >
                        {copiedAddress ? 
                          <Check style={{ width: '16px', height: '16px' }} /> : 
                          <Copy style={{ width: '16px', height: '16px' }} />
                        }
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'account' && (
            <div className="fy-space-y-6">
              <div>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 700, 
                  marginBottom: '16px',
                  color: 'var(--text-primary)'
                }}>
                  Account Actions
                </h3>
                
                <div className="fy-space-y-4">
                  <button
                    onClick={handleLogout}
                    className="fy-button-secondary"
                    style={{ 
                      width: '100%', 
                      height: '48px',
                      justifyContent: 'flex-start',
                      gap: '12px'
                    }}
                  >
                    <LogOut style={{ width: '16px', height: '16px' }} />
                    Log Out
                  </button>
                  
                  <Separator />
                  
                  {/* Error display */}
                  {(deleteError || dynamicDeleteError) && (
                    <div className="fy-alert-error">
                      {deleteError || dynamicDeleteError?.message}
                    </div>
                  )}

                  {!showDeleteConfirm ? (
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setShowDeleteConfirm(true);
                      }}
                      className="fy-button-secondary"
                      style={{ 
                        width: '100%', 
                        height: '48px',
                        justifyContent: 'flex-start',
                        gap: '12px',
                        color: '#dc2626',
                        borderColor: 'rgba(239, 68, 68, 0.2)'
                      }}
                      disabled={isDeleting || isDynamicDeleting}
                    >
                      <Trash2 style={{ width: '16px', height: '16px' }} />
                      Delete Account
                    </button>
                  ) : (
                    <div className="fy-space-y-4">
                      <div className="fy-alert-error">
                        <strong>⚠️ Permanent Account Deletion</strong>
                        <br />
                        This will permanently delete:
                        <ul style={{ marginTop: '8px', paddingLeft: '16px' }}>
                          <li>• Your profile and settings</li>
                          <li>• All transfer history and intents</li>
                          <li>• Email-to-wallet mappings</li>
                          <li>• Any cached data</li>
                        </ul>
                        <br />
                        <strong>This action cannot be undone.</strong>
                      </div>
                      
                      <div className="fy-flex fy-gap-3">
                        <button
                          onClick={() => {
                            setShowDeleteConfirm(false);
                            setDeleteError(null);
                          }}
                          className="fy-button-secondary"
                          style={{ flex: 1, height: '48px' }}
                          disabled={isDeleting || isDynamicDeleting}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteAccount}
                          className="fy-button-primary"
                          style={{ 
                            flex: 1, 
                            height: '48px',
                            background: (isDeleting || isDynamicDeleting) ? '#9ca3af' : '#dc2626',
                            boxShadow: (isDeleting || isDynamicDeleting) ? 'none' : '0 6px 16px rgba(220, 38, 38, 0.3)',
                            cursor: (isDeleting || isDynamicDeleting) ? 'not-allowed' : 'pointer'
                          }}
                          disabled={isDeleting || isDynamicDeleting}
                        >
                          {(isDeleting || isDynamicDeleting) ? (
                            <>
                              <Loader2 style={{ width: '16px', height: '16px', marginRight: '8px' }} className="animate-spin" />
                              Deleting...
                            </>
                          ) : (
                            'Delete Forever'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;