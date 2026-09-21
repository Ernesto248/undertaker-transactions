export type OwnerDebtQueryClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

export type OwnerDebtCategory =
  | "COMMISSION"
  | "SALARY"
  | "OPENING"
  | "MANUAL_ADJUSTMENT";

export function roundOwnerMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export async function getOwnerDebtBalance(
  client: OwnerDebtQueryClient,
  accountId: string,
  ownerId: string,
) {
  const result = await client.query(
    `SELECT COALESCE(SUM(signed_delta), 0) AS balance
     FROM account_owner_debt_movements
     WHERE gmail_account_id = $1 AND owner_id = $2`,
    [accountId, ownerId],
  );
  return roundOwnerMoney(Number(result.rows[0]?.balance ?? 0));
}

export async function insertOwnerDebtMovement(
  client: OwnerDebtQueryClient,
  input: {
    accountId: string;
    ownerId: string;
    category: OwnerDebtCategory;
    movementType: "ACCRUAL" | "PAYMENT" | "ADJUSTMENT" | "REVERSAL";
    signedDelta: number;
    note?: string | null;
    sourceType?: "WIRE" | "SALARY" | "OPENING" | "MANUAL" | "PAYMENT" | null;
    sourceId?: string | null;
    reversalOfId?: string | null;
  },
) {
  const signedDelta = roundOwnerMoney(input.signedDelta);
  if (!Number.isFinite(signedDelta) || signedDelta === 0) {
    throw new Error("owner_debt_delta_must_be_non_zero");
  }
  const balanceBefore = await getOwnerDebtBalance(client, input.accountId, input.ownerId);
  const balanceAfter = roundOwnerMoney(balanceBefore + signedDelta);
  const result = await client.query(
    `INSERT INTO account_owner_debt_movements
       (gmail_account_id, owner_id, category, movement_type, amount,
        signed_delta, balance_before, balance_after, note,
        source_type, source_id, reversal_of_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING id`,
    [
      input.accountId,
      input.ownerId,
      input.category,
      input.movementType,
      Math.abs(signedDelta),
      signedDelta,
      balanceBefore,
      balanceAfter,
      input.note ?? null,
      input.sourceType ?? null,
      input.sourceId ?? null,
      input.reversalOfId ?? null,
    ],
  );
  return {
    id: String(result.rows[0].id),
    balanceBefore,
    balanceAfter,
    signedDelta,
  };
}
