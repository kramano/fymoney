-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. Email to Wallet Mapping
create table email_wallets (
                               id uuid primary key default uuid_generate_v4(),
                               email text unique not null,
                               email_hash text unique not null, -- For privacy-preserving lookups
                               wallet_address text unique not null,

    -- Metadata
                               first_registered_at timestamp default now(),
                               last_updated_at timestamp default now(),
                               is_active boolean default true
);

-- 2. Transfer Intents
create table transfer_intents (
                                  id uuid primary key default uuid_generate_v4(),

    -- Transfer details
                                  sender_wallet text not null,
                                  recipient_email text not null,
                                  recipient_email_hash text not null, -- For efficient lookups
                                  claimed_by_wallet text, -- Set when claimed

    -- Token info
                                  token_mint text not null,
                                  token_symbol text not null default 'USDC',
                                  amount numeric(20, 6) not null check (amount > 0),

    -- Optional message
                                  message text,

    -- Status tracking
                                  status text not null default 'pending' check (status in ('pending', 'claimed', 'cancelled', 'expired')),

    -- Blockchain data
                                  creation_tx_hash text, -- Transaction that created the escrow
                                  claim_tx_hash text,    -- Transaction that claimed the funds
                                  escrow_pda text,       -- Escrow Program Derived Address for claims

    -- Timing
                                  expires_at timestamp not null default (now() + interval '7 days'),
                                  created_at timestamp default now(),
                                  claimed_at timestamp,
                                  cancelled_at timestamp
);

-- 3. Simple notification tracking (optional)
create table transfer_notifications (
                                        id uuid primary key default uuid_generate_v4(),
                                        transfer_intent_id uuid references transfer_intents(id) on delete cascade,

                                        notification_type text not null check (notification_type in ('created', 'reminder', 'expired')),
                                        email text not null,

                                        sent_at timestamp default now(),
                                        status text not null default 'sent' check (status in ('sent', 'failed')),
                                        error_message text
);

CREATE TABLE payment_requests (
                                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                  requester_email TEXT NOT NULL,
                                  requester_wallet TEXT NOT NULL,
                                  target_email TEXT NOT NULL,
                                  amount DECIMAL(18,6) NOT NULL,
                                  message TEXT,
                                  status TEXT NOT NULL DEFAULT 'sent',
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================
-- INDEXES FOR PERFORMANCE
-- =====================================

-- Email wallets indexes
create index email_wallets_email_hash_idx on email_wallets(email_hash);
create index email_wallets_wallet_address_idx on email_wallets(wallet_address);

-- Transfer intents indexes
create index transfer_intents_recipient_email_hash_idx on transfer_intents(recipient_email_hash);
create index transfer_intents_sender_wallet_idx on transfer_intents(sender_wallet);
create index transfer_intents_status_idx on transfer_intents(status);
create index transfer_intents_expires_at_idx on transfer_intents(expires_at);
create index transfer_intents_claimed_by_wallet_idx on transfer_intents(claimed_by_wallet);

-- Composite indexes for common queries
create index transfer_intents_recipient_status_idx on transfer_intents(recipient_email_hash, status);
create index transfer_intents_sender_status_idx on transfer_intents(sender_wallet, status);

-- Notification indexes
create index transfer_notifications_intent_id_idx on transfer_notifications(transfer_intent_id);
create index transfer_notifications_email_idx on transfer_notifications(email);

CREATE INDEX idx_payment_requests_requester_email ON payment_requests(requester_email);
CREATE INDEX idx_payment_requests_target_email ON payment_requests(target_email);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);
CREATE INDEX idx_payment_requests_created_at ON payment_requests(created_at DESC);

-- =====================================
-- FUNCTIONS AND TRIGGERS
-- =====================================

-- Function to generate email hash
create or replace function generate_email_hash(email_input text)
returns text as $$
begin
return encode(digest(lower(trim(email_input)), 'sha256'), 'hex');
end;
$$ language plpgsql immutable;

-- Trigger to auto-generate email hash for email_wallets
create or replace function set_email_hash_wallets()
returns trigger as $$
begin
  NEW.email_hash = generate_email_hash(NEW.email);
  NEW.last_updated_at = now();
return NEW;
end;
$$ language plpgsql;

create trigger email_wallets_set_hash
    before insert or update of email on email_wallets
    for each row execute function set_email_hash_wallets();

-- Trigger to auto-generate email hash for transfer_intents
create or replace function set_email_hash_intents()
returns trigger as $$
begin
  NEW.recipient_email_hash = generate_email_hash(NEW.recipient_email);
return NEW;
end;
$$ language plpgsql;

create trigger transfer_intents_set_hash
    before insert or update of recipient_email on transfer_intents
    for each row execute function set_email_hash_intents();

-- Function to auto-expire transfer intents
create or replace function expire_old_transfer_intents()
returns void as $$
begin
update transfer_intents
set status = 'expired'
where status = 'pending'
  and expires_at < now();
end;
$$ language plpgsql;

