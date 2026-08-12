ALTER TABLE public.finance_cash_movements
  DROP CONSTRAINT IF EXISTS finance_cash_movements_operation_type_check,
  ADD CONSTRAINT finance_cash_movements_operation_type_check CHECK (
    operation_type IN (
      'EXTERNAL_DEBT', 'REMESERO_PAYMENT', 'CURRENCY_EXCHANGE',
      'FINANCE_EXPENSE'
    )
  );

ALTER TABLE public.finance_expenses
  ADD COLUMN cash_movement_id uuid NULL,
  ADD COLUMN reversal_cash_movement_id uuid NULL,
  ADD COLUMN reverted_at timestamptz NULL,
  ADD COLUMN reverted_reason text NULL,
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT finance_expenses_cash_movement_id_fkey
    FOREIGN KEY (cash_movement_id)
    REFERENCES public.finance_cash_movements(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT finance_expenses_reversal_cash_movement_id_fkey
    FOREIGN KEY (reversal_cash_movement_id)
    REFERENCES public.finance_cash_movements(id)
    ON DELETE RESTRICT;

CREATE UNIQUE INDEX finance_expenses_cash_movement_unique
  ON public.finance_expenses (cash_movement_id)
  WHERE cash_movement_id IS NOT NULL;

CREATE UNIQUE INDEX finance_expenses_reversal_cash_movement_unique
  ON public.finance_expenses (reversal_cash_movement_id)
  WHERE reversal_cash_movement_id IS NOT NULL;
