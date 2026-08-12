import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getPool, withRetry } from "@/lib/db";
import { appendCashMovement, reverseCashMovement } from "@/lib/finance-ledger";

export const runtime = "nodejs";

const PositiveNumericSchema = z
  .union([z.number(), z.string().trim().min(1)])
  .transform((value) => (typeof value === "string" ? Number(value) : value))
  .refine((value) => Number.isFinite(value) && value > 0, "amount must be > 0");

const OptionalReasonSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().max(500).optional(),
);

const CreateExpenseSchema = z.object({
  currency: z.enum(["USD", "CUP"]),
  amount: PositiveNumericSchema,
  description: z.string().trim().min(1).max(300),
  occurredAt: z.string().datetime({ offset: true }).optional(),
});

const ReverseExpenseSchema = z.object({
  expenseId: z.string().uuid(),
  reason: OptionalReasonSchema,
});

function serializeExpense(expense: any) {
  return {
    id: String(expense.id),
    currency: expense.currency === "CUP" ? "CUP" : "USD",
    amount: Number(expense.amount),
    description: String(expense.description),
    balanceBefore: Number(expense.balanceBefore),
    balanceAfter: Number(expense.balanceAfter),
    cashMovementId: expense.cashMovementId == null ? null : String(expense.cashMovementId),
    reversalCashMovementId:
      expense.reversalCashMovementId == null ? null : String(expense.reversalCashMovementId),
    occurredAt: new Date(expense.occurredAt).toISOString(),
    revertedAt: expense.revertedAt == null ? null : new Date(expense.revertedAt).toISOString(),
    revertedReason: expense.revertedReason == null ? null : String(expense.revertedReason),
  };
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreateExpenseSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const expenseId = randomUUID();
      const cashMovement = await appendCashMovement(client, {
        currency: parsed.data.currency,
        signedAmount: -parsed.data.amount,
        operationType: "FINANCE_EXPENSE",
        operationId: expenseId,
        note: `Gasto: ${parsed.data.description}`,
        occurredAt: parsed.data.occurredAt ?? null,
      });
      const expenseResult = await client.query(
        `INSERT INTO finance_expenses
           (id, currency, amount, description, balance_before, balance_after,
            cash_movement_id, occurred_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, now()))
         RETURNING id, currency, amount, description,
                   balance_before as "balanceBefore", balance_after as "balanceAfter",
                   cash_movement_id as "cashMovementId",
                   reversal_cash_movement_id as "reversalCashMovementId",
                   occurred_at as "occurredAt", reverted_at as "revertedAt",
                   reverted_reason as "revertedReason"`,
        [
          expenseId,
          parsed.data.currency,
          parsed.data.amount,
          parsed.data.description,
          Number(cashMovement.balanceBefore),
          Number(cashMovement.balanceAfter),
          String(cashMovement.id),
          parsed.data.occurredAt ?? null,
        ],
      );
      await client.query("COMMIT");
      return expenseResult.rows[0];
    } catch (error) {
      try { await client.query("ROLLBACK"); } catch {}
      throw error;
    } finally {
      client.release();
    }
  });

  return Response.json({ ok: true, expense: serializeExpense(result) }, { status: 201 });
}

export async function DELETE(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = ReverseExpenseSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  return withRetry(async () => {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const expenseResult = await client.query(
        `SELECT id, currency, amount, description,
                cash_movement_id as "cashMovementId"
         FROM finance_expenses
         WHERE id = $1 AND reverted_at IS NULL
         FOR UPDATE`,
        [parsed.data.expenseId],
      );
      const expense = expenseResult.rows[0];
      if (!expense?.id) {
        await client.query("ROLLBACK");
        return Response.json(
          { ok: false, error: "expense_not_found_or_reverted" },
          { status: 404 },
        );
      }

      const reason = parsed.data.reason ?? "Gasto revertido desde Finanzas";
      const reversal = expense.cashMovementId
        ? await reverseCashMovement(client, {
            cashMovementId: String(expense.cashMovementId),
            reason,
          })
        : await appendCashMovement(client, {
            currency: expense.currency === "CUP" ? "CUP" : "USD",
            signedAmount: Number(expense.amount),
            operationType: "FINANCE_EXPENSE",
            operationId: String(expense.id),
            note: reason,
          });

      if (!reversal) {
        await client.query("ROLLBACK");
        return Response.json(
          { ok: false, error: "expense_already_reverted" },
          { status: 409 },
        );
      }

      const updatedResult = await client.query(
        `UPDATE finance_expenses
         SET reverted_at = now(), reverted_reason = $2,
             reversal_cash_movement_id = $3, updated_at = now()
         WHERE id = $1
         RETURNING id, currency, amount, description,
                   balance_before as "balanceBefore", balance_after as "balanceAfter",
                   cash_movement_id as "cashMovementId",
                   reversal_cash_movement_id as "reversalCashMovementId",
                   occurred_at as "occurredAt", reverted_at as "revertedAt",
                   reverted_reason as "revertedReason"`,
        [parsed.data.expenseId, parsed.data.reason ?? null, String(reversal.id)],
      );
      await client.query("COMMIT");

      return Response.json(
        { ok: true, expense: serializeExpense(updatedResult.rows[0]) },
        { status: 200 },
      );
    } catch {
      try { await client.query("ROLLBACK"); } catch {}
      return Response.json({ ok: false, error: "server_error" }, { status: 500 });
    } finally {
      client.release();
    }
  });
}
