ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS deletion_reason text NULL;

CREATE INDEX IF NOT EXISTS transactions_active_occurred_at_idx
  ON public.transactions (occurred_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS transactions_deleted_at_idx
  ON public.transactions (deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.transaction_deletion_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL,
  action text NOT NULL,
  reason text NULL,
  account_balance_before numeric NOT NULL,
  account_balance_after numeric NOT NULL,
  zelle_valuation_before jsonb NOT NULL,
  zelle_valuation_after jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transaction_deletion_events_pkey PRIMARY KEY (id),
  CONSTRAINT transaction_deletion_events_transaction_id_fkey
    FOREIGN KEY (transaction_id)
    REFERENCES public.transactions(id)
    ON DELETE RESTRICT,
  CONSTRAINT transaction_deletion_events_action_check
    CHECK (action IN ('DELETED', 'RESTORED'))
);

CREATE INDEX IF NOT EXISTS transaction_deletion_events_transaction_id_idx
  ON public.transaction_deletion_events (transaction_id, created_at DESC);

ALTER TABLE public.remesero_transaction_assignments
  DROP CONSTRAINT IF EXISTS remesero_transaction_assignments_transaction_id_fkey;

ALTER TABLE public.remesero_transaction_assignments
  ADD CONSTRAINT remesero_transaction_assignments_transaction_id_fkey
  FOREIGN KEY (transaction_id)
  REFERENCES public.transactions(id)
  ON DELETE RESTRICT;
