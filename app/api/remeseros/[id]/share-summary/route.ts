import { getPool } from "@/lib/db";
import type { RemeseroShareSummary } from "@/lib/types";

export const runtime = "nodejs";

function idFromParams(params: { id?: string }) {
  return String(params.id ?? "").trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = idFromParams(resolvedParams);

  if (!id) {
    return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  const client = await getPool().connect();

  try {
    const remeseroResult = await client.query(
      `
      SELECT id, nombre, deuda_actual as "deudaActual"
      FROM remeseros
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    const remesero = remeseroResult.rows[0];
    if (!remesero?.id) {
      return Response.json(
        { ok: false, error: "remesero_not_found" },
        { status: 404 },
      );
    }

    const lastPaymentResult = await client.query(
      `
      SELECT
        id,
        amount_paid as "amountPaid",
        deuda_despues_pago as "debtAfterPayment",
        paid_at as "paidAt"
      FROM remesero_payments
      WHERE remesero_id = $1 AND reverted_at IS NULL
      ORDER BY paid_at DESC
      LIMIT 1
      `,
      [id],
    );

    const lastPayment = lastPaymentResult.rows[0] ?? null;
    const cutAt: Date | null =
      lastPayment?.paidAt === null || lastPayment?.paidAt === undefined
        ? null
        : new Date(lastPayment.paidAt);

    const groupsResult = await client.query(
      `
      SELECT
        price_applied as "priceApplied",
        ARRAY_AGG(amount_usd ORDER BY assigned_at) as "amountsUsd",
        COUNT(*)::int as "txCount",
        COALESCE(SUM(amount_usd), 0) as "totalUsd",
        COALESCE(SUM(debt_amount), 0) as "totalCup"
      FROM remesero_transaction_assignments
      WHERE remesero_id = $1
        AND unassigned_at IS NULL
        AND ($2::timestamptz IS NULL OR assigned_at > $2::timestamptz)
      GROUP BY price_applied
      ORDER BY price_applied
      `,
      [id, cutAt],
    );

    const groups = groupsResult.rows.map((row: any) => ({
      priceApplied: toNumber(row.priceApplied),
      amountsUsd: Array.isArray(row.amountsUsd)
        ? row.amountsUsd.map((value) => toNumber(value))
        : [],
      txCount: toNumber(row.txCount),
      totalUsd: toNumber(row.totalUsd),
      totalCup: toNumber(row.totalCup),
    }));

    const totalTiradoUsd = groups.reduce((acc, row) => acc + row.totalUsd, 0);
    const totalTiradoCup = groups.reduce((acc, row) => acc + row.totalCup, 0);

    let inicioDebt = toNumber(lastPayment?.debtAfterPayment);

    // Fallback only for legacy rows created before debt snapshots were added.
    if (lastPayment?.id && lastPayment?.debtAfterPayment == null) {
      inicioDebt = toNumber(remesero.deudaActual) - totalTiradoCup;
    }

    if (!lastPayment?.id) {
      inicioDebt = 0;
    }

    const finalDebt = inicioDebt + totalTiradoCup;

    const summary: RemeseroShareSummary = {
      remeseroId: String(remesero.id),
      remeseroNombre: String(remesero.nombre),
      cutAt: cutAt ? cutAt.toISOString() : null,
      hasPaymentCut: Boolean(lastPayment?.id),
      lastPaymentAmount:
        lastPayment?.amountPaid === null ||
        lastPayment?.amountPaid === undefined
          ? null
          : toNumber(lastPayment.amountPaid),
      inicioDebt,
      totalTiradoUsd,
      totalTiradoCup,
      finalDebt,
      finalDebtType: finalDebt >= 0 ? "DEUDA" : "FONDO",
      groups,
    };

    return Response.json({ ok: true, summary }, { status: 200 });
  } finally {
    client.release();
  }
}
