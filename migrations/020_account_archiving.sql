ALTER TABLE public.gmail_accounts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS gmail_accounts_active_name_idx
  ON public.gmail_accounts (account_name)
  WHERE archived_at IS NULL;
