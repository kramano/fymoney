use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

// Replace this with your actual program ID
declare_id!("4ccPktiGRVAS5vmuPj8W7CcR534mQn88KmtHaMTdeQVs");

#[program]
pub mod yield_vault {
    use super::*;

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        let user_deposit = &mut ctx.accounts.user_deposit_account;

        // Initialize or update deposit account
        user_deposit.user = ctx.accounts.user.key();
        user_deposit.amount = user_deposit.amount.checked_add(amount).unwrap();

        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );

        token::transfer(transfer_ctx, amount)?;

        msg!("User {} deposited {}", user_deposit.user, amount);
        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);
        let user_deposit = &mut ctx.accounts.user_deposit_account;

        require!(user_deposit.amount >= amount, VaultError::InsufficientFunds);
        user_deposit.amount = user_deposit.amount.checked_sub(amount).unwrap();

        let seeds = &[b"vault".as_ref(), &[ctx.bumps.vault_account]];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_account.to_account_info(),
            },
            signer,
        );

        token::transfer(transfer_ctx, amount)?;
        msg!("User {} withdrew {}", user_deposit.user, amount);

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Deposit<'info> {
    #[account(
        init_if_needed,
        payer = fee_payer,
        space = 8 + UserDeposit::INIT_SPACE,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump
    )]
    pub user_deposit_account: Account<'info, UserDeposit>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = fee_payer,
        seeds = [b"vault"],
        bump,
        space = 8
    )]
    pub vault_account: Account<'info, VaultAccount>,

    #[account(
        init_if_needed,
        payer = fee_payer,
        associated_token::mint = token_mint,
        associated_token::authority = vault_account
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,

    pub user: Signer<'info>,

    #[account(mut)]
    pub fee_payer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"user_deposit", user.key().as_ref()],
        bump
    )]
    pub user_deposit_account: Account<'info, UserDeposit>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = user,
    )]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault_account: Account<'info, VaultAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vault_account
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[account]
#[derive(InitSpace)]
pub struct UserDeposit {
    pub user: Pubkey,
    pub amount: u64,
}

#[account]
pub struct VaultAccount {} // Just a dummy PDA to serve as authority

#[error_code]
pub enum VaultError {
    #[msg("Invalid amount: must be greater than 0")]
    InvalidAmount,
    #[msg("Not enough funds in user deposit")]
    InsufficientFunds,
}
