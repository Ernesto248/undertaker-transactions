CREATE TABLE public.account_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  archived_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_owners_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX account_owners_name_unique
  ON public.account_owners (lower(trim(name)));

ALTER TABLE public.gmail_accounts
  ADD COLUMN account_owner_id uuid NULL REFERENCES public.account_owners(id) ON DELETE RESTRICT,
  ADD COLUMN owner_monthly_salary_usd numeric NULL,
  ADD CONSTRAINT gmail_accounts_owner_salary_check
    CHECK (owner_monthly_salary_usd IS NULL OR owner_monthly_salary_usd >= 0);

CREATE TABLE public.gmail_account_owner_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id uuid NOT NULL REFERENCES public.gmail_accounts(id) ON DELETE RESTRICT,
  previous_owner_id uuid NULL REFERENCES public.account_owners(id) ON DELETE RESTRICT,
  new_owner_id uuid NULL REFERENCES public.account_owners(id) ON DELETE RESTRICT,
  previous_fee_percent numeric NULL,
  new_fee_percent numeric NULL,
  previous_salary_usd numeric NULL,
  new_salary_usd numeric NULL,
  note text NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX gmail_account_owner_changes_account_idx
  ON public.gmail_account_owner_changes(gmail_account_id, changed_at DESC);

CREATE TABLE public.account_owner_debt_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id uuid NOT NULL REFERENCES public.gmail_accounts(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES public.account_owners(id) ON DELETE RESTRICT,
  category text NOT NULL CHECK (category IN ('COMMISSION', 'SALARY', 'OPENING', 'MANUAL_ADJUSTMENT')),
  movement_type text NOT NULL CHECK (movement_type IN ('ACCRUAL', 'PAYMENT', 'ADJUSTMENT', 'REVERSAL')),
  amount numeric NOT NULL CHECK (amount > 0),
  signed_delta numeric NOT NULL CHECK (signed_delta <> 0),
  balance_before numeric NOT NULL,
  balance_after numeric NOT NULL,
  note text NULL,
  source_type text NULL CHECK (source_type IS NULL OR source_type IN ('WIRE', 'SALARY', 'OPENING', 'MANUAL', 'PAYMENT')),
  source_id uuid NULL,
  reversal_of_id uuid NULL REFERENCES public.account_owner_debt_movements(id) ON DELETE RESTRICT,
  reversed_at timestamptz NULL,
  reversed_reason text NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_owner_debt_balance_consistent
    CHECK (balance_after = balance_before + signed_delta),
  CONSTRAINT account_owner_debt_source_complete
    CHECK ((source_type IS NULL) = (source_id IS NULL))
);

CREATE INDEX account_owner_debt_account_owner_idx
  ON public.account_owner_debt_movements(gmail_account_id, owner_id, occurred_at DESC, id DESC);

CREATE UNIQUE INDEX account_owner_debt_source_unique
  ON public.account_owner_debt_movements(source_type, source_id)
  WHERE source_type IS NOT NULL AND reversal_of_id IS NULL;

CREATE UNIQUE INDEX account_owner_debt_reversal_unique
  ON public.account_owner_debt_movements(reversal_of_id)
  WHERE reversal_of_id IS NOT NULL;

CREATE TABLE public.account_owner_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id uuid NOT NULL REFERENCES public.gmail_accounts(id) ON DELETE RESTRICT,
  owner_id uuid NOT NULL REFERENCES public.account_owners(id) ON DELETE RESTRICT,
  salary_month date NOT NULL,
  amount_usd numeric NOT NULL CHECK (amount_usd >= 0),
  note text NULL,
  debt_movement_id uuid NULL REFERENCES public.account_owner_debt_movements(id) ON DELETE RESTRICT,
  reverted_at timestamptz NULL,
  reverted_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_owner_salary_month_start CHECK (salary_month = date_trunc('month', salary_month)::date)
);

CREATE UNIQUE INDEX account_owner_salaries_active_month_unique
  ON public.account_owner_salaries(gmail_account_id, salary_month)
  WHERE reverted_at IS NULL;

ALTER TABLE public.account_outflow_movements
  DROP CONSTRAINT IF EXISTS account_outflow_movements_movement_type_check,
  ADD CONSTRAINT account_outflow_movements_movement_type_check
    CHECK (movement_type IN ('wire', 'expense', 'owner_payment')),
  ADD COLUMN account_owner_debt_movement_id uuid NULL
    REFERENCES public.account_owner_debt_movements(id) ON DELETE RESTRICT;

CREATE UNIQUE INDEX account_outflow_owner_debt_movement_unique
  ON public.account_outflow_movements(account_owner_debt_movement_id)
  WHERE account_owner_debt_movement_id IS NOT NULL;

CREATE INDEX gmail_accounts_owner_idx
  ON public.gmail_accounts(account_owner_id)
  WHERE account_owner_id IS NOT NULL;
