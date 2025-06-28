use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("31HHr5jwk8woZF1GQthtBSkh2a7TvcbgamhTATYuDw9Z");

#[program]
pub mod fymoney {
    use super::*;
    
    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount: u64,
        recipient_email_hash: [u8; 32],
        expires_at: i64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow_account;
        let clock = Clock::get()?;

        // Validate inputs
        require!(amount > 0, EscrowError::InvalidAmount);
        require!(
            expires_at > clock.unix_timestamp,
            EscrowError::InvalidExpiration
        );

        // Maximum 30 days expiration
        let max_expiration = clock.unix_timestamp + (30 * 24 * 60 * 60);
        require!(expires_at <= max_expiration, EscrowError::ExpirationTooLong);

        // Initialize escrow account
        escrow.sender = ctx.accounts.sender.key();
        escrow.recipient_email_hash = recipient_email_hash;
        escrow.recipient_wallet = None;
        escrow.token_mint = ctx.accounts.token_mint.key();
        escrow.escrow_token_account = ctx.accounts.escrow_token_account.key();
        escrow.amount = amount;
        escrow.created_at = clock.unix_timestamp;
        escrow.expires_at = expires_at;
        escrow.status = EscrowStatus::Active;
        escrow.bump = ctx.bumps.escrow_account;

        // Transfer tokens from sender to escrow
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.sender_token_account.to_account_info(),
                to: ctx.accounts.escrow_token_account.to_account_info(),
                authority: ctx.accounts.sender.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        msg!(
            "Escrow created: {} tokens for email hash {:?}, expires at {}",
            amount,
            recipient_email_hash,
            expires_at
        );

        Ok(())
    }

    pub fn claim_escrow(ctx: Context<ClaimEscrow>) -> Result<()> {
        let clock = Clock::get()?;
        let recipient_wallet = ctx.accounts.recipient.key();

        // Extract values we need before any mutable borrows
        let (amount, created_at_bytes, sender, recipient_email_hash, bump) = {
            let escrow = &ctx.accounts.escrow_account;
            // Validate escrow state
            require!(
                escrow.status == EscrowStatus::Active,
                EscrowError::EscrowNotActive
            );
            require!(
                clock.unix_timestamp <= escrow.expires_at,
                EscrowError::EscrowExpired
            );
            require!(
                escrow.recipient_wallet.is_none()
                    || escrow.recipient_wallet == Some(recipient_wallet),
                EscrowError::InvalidRecipient
            );

            (
                escrow.amount,
                escrow.created_at.to_le_bytes(),
                escrow.sender,
                escrow.recipient_email_hash,
                escrow.bump,
            )
        };

        // Update escrow status
        {
            let escrow = &mut ctx.accounts.escrow_account;
            escrow.status = EscrowStatus::Claimed;
            escrow.recipient_wallet = Some(recipient_wallet);
        }

        // Transfer tokens from escrow to recipient
        let seeds = &[
            b"escrow",
            sender.as_ref(),
            recipient_email_hash.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.escrow_account.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, amount)?;

        msg!(
            "Escrow claimed: {} tokens by wallet {}",
            amount,
            recipient_wallet
        );

        Ok(())
    }

    pub fn reclaim_expired_escrow(ctx: Context<ReclaimExpiredEscrow>) -> Result<()> {
        let clock = Clock::get()?;

        // Extract values we need before any mutable borrows
        let (amount, created_at_bytes, sender, recipient_email_hash, bump) = {
            let escrow = &ctx.accounts.escrow_account;
            // Validate escrow state
            require!(
                escrow.status == EscrowStatus::Active,
                EscrowError::EscrowNotActive
            );
            require!(
                clock.unix_timestamp > escrow.expires_at,
                EscrowError::EscrowNotExpired
            );
            require!(
                ctx.accounts.sender.key() == escrow.sender,
                EscrowError::UnauthorizedSender
            );

            (
                escrow.amount,
                escrow.created_at.to_le_bytes(),
                escrow.sender,
                escrow.recipient_email_hash,
                escrow.bump,
            )
        };

        // Update escrow status
        {
            let escrow = &mut ctx.accounts.escrow_account;
            escrow.status = EscrowStatus::Expired;
        }

        // Transfer tokens back to sender
        let seeds = &[
            b"escrow",
            sender.as_ref(),
            recipient_email_hash.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.sender_token_account.to_account_info(),
                authority: ctx.accounts.escrow_account.to_account_info(),
            },
            signer_seeds,
        );
        token::transfer(transfer_ctx, amount)?;

        msg!(
            "Expired escrow reclaimed: {} tokens by sender {}",
            amount,
            sender
        );

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64, recipient_email_hash: [u8; 32], expires_at: i64)]
pub struct InitializeEscrow<'info> {
    #[account(
        init,
        payer = sender,
        space = 8 + EscrowAccount::INIT_SPACE,
        seeds = [
            b"escrow",
            sender.key().as_ref(),
            recipient_email_hash.as_ref()
        ],
        bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(
        init,
        payer = sender,
        associated_token::mint = token_mint,
        associated_token::authority = escrow_account
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = sender
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimEscrow<'info> {
    #[account(
        mut,
        seeds = [
            b"escrow",
            escrow_account.sender.as_ref(),
            escrow_account.recipient_email_hash.as_ref()
        ],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = escrow_account
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = recipient,
        associated_token::mint = token_mint,
        associated_token::authority = recipient
    )]
    pub recipient_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub recipient: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ReclaimExpiredEscrow<'info> {
    #[account(
        mut,
        close = sender,
        seeds = [
            b"escrow",
            escrow_account.sender.as_ref(),
            escrow_account.recipient_email_hash.as_ref()
        ],
        bump = escrow_account.bump
    )]
    pub escrow_account: Account<'info, EscrowAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = escrow_account
    )]
    pub escrow_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = sender
    )]
    pub sender_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    #[account(mut)]
    pub sender: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct EscrowAccount {
    pub sender: Pubkey,                   // 32 bytes
    pub recipient_email_hash: [u8; 32],   // 32 bytes
    pub recipient_wallet: Option<Pubkey>, // 1 + 32 bytes
    pub token_mint: Pubkey,               // 32 bytes
    pub escrow_token_account: Pubkey,     // 32 bytes
    pub amount: u64,                      // 8 bytes
    pub created_at: i64,                  // 8 bytes
    pub expires_at: i64,                  // 8 bytes
    pub status: EscrowStatus,             // 1 byte
    pub bump: u8,                         // 1 byte
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum EscrowStatus {
    Active,
    Claimed,
    Expired,
}

#[error_code]
pub enum EscrowError {
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Invalid expiration: must be in the future")]
    InvalidExpiration,
    #[msg("Expiration too long: maximum 30 days")]
    ExpirationTooLong,
    #[msg("Escrow is not active")]
    EscrowNotActive,
    #[msg("Escrow has expired")]
    EscrowExpired,
    #[msg("Escrow has not expired yet")]
    EscrowNotExpired,
    #[msg("Invalid recipient")]
    InvalidRecipient,
    #[msg("Unauthorized sender")]
    UnauthorizedSender,
}
