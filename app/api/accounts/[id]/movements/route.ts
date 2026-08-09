import { z } from "zod";
import { getPool } from "@/lib/db";
import type { AccountMovement } from "@/lib/types";

export const runtime = "nodejs";

function mapMovementRow(row: any): AccountMovement {
  return {
    id: String(row.id),
    accountId: String(row.accountId),
    movementType: row.movementType === "expense" ? "expense" : "wire",
    amount: Number(row.amount ?? 0),
    note: row.note ? String(row.note) : null,
    createdAt: new Date(row.createdAt).toISOString(),
    revertedAt: row.revertedAt ? new Date(row.revertedAt).toISOString() : null,
    revertedReason: row.revertedReason ? String(row.revertedReason) : null,
    counterpartyId: row.counterpartyId == null ? null : String(row.counterpartyId),
    counterpartyName: row.counterpartyName == null ? null : String(row.counterpartyName),
    settlementCurrency: row.settlementCurrency === "CUP" ? "CUP" : row.settlementCurrency === "USD" ? "USD" : null,
    conversionRate: row.conversionRate == null ? null : Number(row.conversionRate),
    feePercent: row.feePercent == null ? null : Number(row.feePercent),
    debtAmount: row.debtAmount == null ? null : Number(row.debtAmount),
    financeDebtMovementId: row.financeDebtMovementId == null ? null : String(row.financeDebtMovementId),
  };
}

type Params = {
  params: Promise<{ id: string }>;
};

function parseDateParam(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export async function GET(request: Request, { params }: Params) {
  const parsedParams = z
    .object({ id: z.string().uuid() })
    .safeParse(await params);

  if (!parsedParams.success) {
    return Response.json(
      { ok: false, error: "invalid_account_id" },
      { status: 400 },
    );
  }

  const url = new URL(request.url);
  const fromParam = parseDateParam(url.searchParams.get("from"));
  const toParam = parseDateParam(url.searchParams.get("to"));

  if (url.searchParams.get("from") && !fromParam) {
    return Response.json({ ok: false, error: "invalid_from" }, { status: 400 });
  }

  if (url.searchParams.get("to") && !toParam) {
    return Response.json({ ok: false, error: "invalid_to" }, { status: 400 });
  }

  const values: unknown[] = [parsedParams.data.id];
  const rangeFilters: string[] = [];

  if (fromParam) {
    values.push(fromParam);
    rangeFilters.push(`m.created_at >= $${values.length}`);
  }

  if (toParam) {
    values.push(toParam);
    rangeFilters.push(`m.created_at <= $${values.length}`);
  }

  const rangeWhere =
    rangeFilters.length > 0 ? ` AND ${rangeFilters.join(" AND ")}` : "";

  const client = await getPool().connect();

  try {
    const result = await client.query(
      `
      SELECT
        m.id,
        m.gmail_account_id as "accountId",
        m.movement_type as "movementType",
        m.amount,
        m.note,
        m.created_at as "createdAt",
        m.reverted_at as "revertedAt",
        m.reverted_reason as "revertedReason",
        m.counterparty_id as "counterpartyId",
        counterparty.name as "counterpartyName",
        m.settlement_currency as "settlementCurrency",
        m.conversion_rate as "conversionRate",
        m.fee_percent as "feePercent",
        m.debt_amount as "debtAmount",
        m.finance_debt_movement_id as "financeDebtMovementId"
      FROM account_outflow_movements m
      LEFT JOIN finance_counterparties counterparty ON counterparty.id = m.counterparty_id
      WHERE m.gmail_account_id = $1
      ${rangeWhere}
      ORDER BY m.created_at DESC
      `,
      values,
    );

    const movements: AccountMovement[] = result.rows.map(mapMovementRow);

    return Response.json({ ok: true, movements }, { status: 200 });
  } finally {
    client.release();
  }
}
