import { getPool } from "@/lib/db";
import type {
  Remesero,
  RemeseroDetailAssignment,
  RemeseroDetailData,
  RemeseroDetailRangeOption,
  RemeseroDetailSummary,
  RemeseroPayment,
} from "@/lib/types";

export const runtime = "nodejs";

function idFromParams(params: { id?: string }) {
  return String(params.id ?? "").trim();
}

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDateParam(rawValue: string | null) {
  if (!rawValue) return null;
  const parsed = new Date(rawValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatPaymentLabel(isoDate: string) {
  const date = new Date(isoDate);
  return date.toLocaleString("es-DO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function mapRemeseroRow(row: any): Remesero {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    precioActual: toNumber(row.precioActual),
    deudaActual: toNumber(row.deudaActual),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

function mapPaymentRow(row: any): RemeseroPayment {
  return {
    id: String(row.id),
    remeseroId: String(row.remeseroId),
    amountPaid: toNumber(row.amountPaid),
    debtBeforePayment:
      row.debtBeforePayment === null || row.debtBeforePayment === undefined
        ? null
        : toNumber(row.debtBeforePayment),
    debtAfterPayment:
      row.debtAfterPayment === null || row.debtAfterPayment === undefined
        ? null
        : toNumber(row.debtAfterPayment),
    note: row.note === null || row.note === undefined ? null : String(row.note),
    paidAt: new Date(row.paidAt).toISOString(),
    revertedAt:
      row.revertedAt === null || row.revertedAt === undefined
        ? null
        : new Date(row.revertedAt).toISOString(),
    revertedReason:
      row.revertedReason === null || row.revertedReason === undefined
        ? null
        : String(row.revertedReason),
  };
}

function buildRangeOptions(
  validPayments: RemeseroPayment[],
): RemeseroDetailRangeOption[] {
  const options: RemeseroDetailRangeOption[] = [];

  const latestPaidAt = validPayments[0]?.paidAt ?? null;
  options.push({
    id: "current",
    label: latestPaidAt
      ? `Desde ultimo pago (${formatPaymentLabel(latestPaidAt)})`
      : "Desde el inicio (sin pagos)",
    from: latestPaidAt,
    to: null,
  });

  for (let i = 0; i < validPayments.length - 1; i += 1) {
    const newer = validPayments[i];
    const older = validPayments[i + 1];

    options.push({
      id: `between:${newer.id}:${older.id}`,
      label: `Entre ${formatPaymentLabel(older.paidAt)} y ${formatPaymentLabel(newer.paidAt)}`,
      from: older.paidAt,
      to: newer.paidAt,
    });
  }

  if (validPayments.length > 0) {
    const oldest = validPayments[validPayments.length - 1];
    options.push({
      id: `before:${oldest.id}`,
      label: `Antes del primer pago (${formatPaymentLabel(oldest.paidAt)})`,
      from: null,
      to: oldest.paidAt,
    });
  }

  return options;
}

function mapAssignmentRow(row: any): RemeseroDetailAssignment {
  return {
    assignmentId: String(row.assignmentId),
    transactionId: String(row.transactionId),
    senderName:
      row.senderName === null || row.senderName === undefined
        ? "Sin nombre"
        : String(row.senderName),
    bank: row.bank === null || row.bank === undefined ? null : String(row.bank),
    accountName:
      row.accountName === null || row.accountName === undefined
        ? null
        : String(row.accountName),
    confirmationCode:
      row.confirmationCode === null || row.confirmationCode === undefined
        ? null
        : String(row.confirmationCode),
    transactionAmount: toNumber(row.transactionAmount),
    amountUsd: toNumber(row.amountUsd),
    priceApplied: toNumber(row.priceApplied),
    debtAmount: toNumber(row.debtAmount),
    assignedAt: new Date(row.assignedAt).toISOString(),
    unassignedAt:
      row.unassignedAt === null || row.unassignedAt === undefined
        ? null
        : new Date(row.unassignedAt).toISOString(),
    isActive: row.unassignedAt === null || row.unassignedAt === undefined,
  };
}

function buildSummary(
  assignments: RemeseroDetailAssignment[],
): RemeseroDetailSummary {
  const totalUsd = assignments.reduce((acc, row) => acc + row.amountUsd, 0);
  const totalCup = assignments.reduce((acc, row) => acc + row.debtAmount, 0);

  const grouped = new Map<
    number,
    {
      txCount: number;
      totalUsd: number;
      totalCup: number;
      amountsUsd: number[];
    }
  >();

  const sortedForGroup = [...assignments].sort((a, b) =>
    a.assignedAt.localeCompare(b.assignedAt),
  );

  for (const row of sortedForGroup) {
    const current = grouped.get(row.priceApplied) ?? {
      txCount: 0,
      totalUsd: 0,
      totalCup: 0,
      amountsUsd: [],
    };

    current.txCount += 1;
    current.totalUsd += row.amountUsd;
    current.totalCup += row.debtAmount;
    current.amountsUsd.push(row.amountUsd);

    grouped.set(row.priceApplied, current);
  }

  const groups = Array.from(grouped.entries())
    .map(([priceApplied, value]) => ({
      priceApplied,
      txCount: value.txCount,
      totalUsd: value.totalUsd,
      totalCup: value.totalCup,
      amountsUsd: value.amountsUsd,
    }))
    .sort((a, b) => a.priceApplied - b.priceApplied);

  return {
    txCount: assignments.length,
    totalUsd,
    totalCup,
    groups,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = idFromParams(resolvedParams);

  if (!id) {
    return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  const requestUrl = new URL(request.url);
  const fromParam = parseDateParam(requestUrl.searchParams.get("from"));
  const toParam = parseDateParam(requestUrl.searchParams.get("to"));

  if (fromParam && toParam && fromParam >= toParam) {
    return Response.json(
      { ok: false, error: "invalid_range" },
      { status: 400 },
    );
  }

  const client = await getPool().connect();

  try {
    const remeseroResult = await client.query(
      `
      SELECT
        id,
        nombre,
        precio_actual as "precioActual",
        deuda_actual as "deudaActual",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM remeseros
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    if (!remeseroResult.rows[0]?.id) {
      return Response.json(
        { ok: false, error: "remesero_not_found" },
        { status: 404 },
      );
    }

    const remesero = mapRemeseroRow(remeseroResult.rows[0]);

    const paymentsResult = await client.query(
      `
      SELECT
        id,
        remesero_id as "remeseroId",
        amount_paid as "amountPaid",
        deuda_antes_pago as "debtBeforePayment",
        deuda_despues_pago as "debtAfterPayment",
        note,
        paid_at as "paidAt",
        reverted_at as "revertedAt",
        reverted_reason as "revertedReason"
      FROM remesero_payments
      WHERE remesero_id = $1
      ORDER BY paid_at DESC
      `,
      [id],
    );

    const payments = paymentsResult.rows.map(mapPaymentRow);
    const validPayments = payments.filter(
      (payment) => payment.revertedAt === null,
    );

    const defaultFrom = validPayments[0]?.paidAt ?? null;
    const effectiveFrom =
      fromParam ?? (defaultFrom ? new Date(defaultFrom) : null);
    const effectiveTo = toParam ?? null;

    if (effectiveFrom && effectiveTo && effectiveFrom >= effectiveTo) {
      return Response.json(
        { ok: false, error: "invalid_range" },
        { status: 400 },
      );
    }

    const assignmentsResult = await client.query(
      `
      SELECT
        a.id as "assignmentId",
        a.transaction_id as "transactionId",
        t.actor_name as "senderName",
        b.name as bank,
        g.account_name as "accountName",
        t.confirmation_code as "confirmationCode",
        t.amount as "transactionAmount",
        a.amount_usd as "amountUsd",
        a.price_applied as "priceApplied",
        a.debt_amount as "debtAmount",
        a.assigned_at as "assignedAt",
        a.unassigned_at as "unassignedAt"
      FROM remesero_transaction_assignments a
      JOIN transactions t ON t.id = a.transaction_id
      LEFT JOIN banks b ON b.id = t.bank_id
      LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
      WHERE a.remesero_id = $1
        AND ($2::timestamptz IS NULL OR a.assigned_at >= $2::timestamptz)
        AND ($3::timestamptz IS NULL OR a.assigned_at < $3::timestamptz)
      ORDER BY a.assigned_at DESC
      `,
      [id, effectiveFrom, effectiveTo],
    );

    const assignments = assignmentsResult.rows.map(mapAssignmentRow);
    const summary = buildSummary(assignments);

    const detail: RemeseroDetailData = {
      remesero,
      payments,
      rangeOptions: buildRangeOptions(validPayments),
      selectedRange: {
        from: effectiveFrom ? effectiveFrom.toISOString() : null,
        to: effectiveTo ? effectiveTo.toISOString() : null,
      },
      summary,
      assignments,
    };

    return Response.json({ ok: true, detail }, { status: 200 });
  } finally {
    client.release();
  }
}
