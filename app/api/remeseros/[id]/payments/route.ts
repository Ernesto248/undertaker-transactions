import { z } from "zod";
import { getPool } from "@/lib/db";
import type { RemeseroPayment } from "@/lib/types";

export const runtime = "nodejs";

const CreatePaymentSchema = z.object({
  amountPaid: z
    .union([z.number(), z.string().trim()])
    .transform((v) => (typeof v === "string" ? Number(v) : v))
    .refine((v) => Number.isFinite(v) && v > 0, "amountPaid must be > 0"),
  note: z.string().trim().max(500).optional(),
  paidAt: z.string().datetime({ offset: true }).optional(),
});

const RevertPaymentSchema = z.object({
  paymentId: z.string().trim().uuid(),
  reason: z.string().trim().max(500).optional(),
});

function idFromParams(params: { id?: string }) {
  return String(params.id ?? "").trim();
}

function mapPaymentRow(row: any): RemeseroPayment {
  return {
    id: String(row.id),
    remeseroId: String(row.remeseroId),
    amountPaid: Number(row.amountPaid ?? 0),
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
    const remesero = await client.query(
      `
      SELECT id
      FROM remeseros
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    if (!remesero.rows[0]?.id) {
      return Response.json(
        { ok: false, error: "remesero_not_found" },
        { status: 404 },
      );
    }

    const result = await client.query(
      `
      SELECT
        id,
        remesero_id as "remeseroId",
        amount_paid as "amountPaid",
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

    const payments: RemeseroPayment[] = result.rows.map(mapPaymentRow);
    return Response.json({ ok: true, payments }, { status: 200 });
  } finally {
    client.release();
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = idFromParams(resolvedParams);

  if (!id) {
    return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = CreatePaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const client = await getPool().connect();

  try {
    const remesero = await client.query(
      `
      SELECT id
      FROM remeseros
      WHERE id = $1 AND deleted_at IS NULL
      LIMIT 1
      `,
      [id],
    );

    if (!remesero.rows[0]?.id) {
      return Response.json(
        { ok: false, error: "remesero_not_found" },
        { status: 404 },
      );
    }

    const paidAt = parsed.data.paidAt
      ? new Date(parsed.data.paidAt)
      : new Date();

    const inserted = await client.query(
      `
      INSERT INTO remesero_payments (remesero_id, amount_paid, note, paid_at)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        remesero_id as "remeseroId",
        amount_paid as "amountPaid",
        note,
        paid_at as "paidAt",
        reverted_at as "revertedAt",
        reverted_reason as "revertedReason"
      `,
      [id, parsed.data.amountPaid, parsed.data.note ?? null, paidAt],
    );

    const payment = mapPaymentRow(inserted.rows[0]);

    return Response.json({ ok: true, payment }, { status: 201 });
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;
  const id = idFromParams(resolvedParams);

  if (!id) {
    return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = RevertPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const client = await getPool().connect();

  try {
    const updated = await client.query(
      `
      UPDATE remesero_payments
      SET reverted_at = now(), reverted_reason = $3
      WHERE id = $1 AND remesero_id = $2 AND reverted_at IS NULL
      RETURNING
        id,
        remesero_id as "remeseroId",
        amount_paid as "amountPaid",
        note,
        paid_at as "paidAt",
        reverted_at as "revertedAt",
        reverted_reason as "revertedReason"
      `,
      [parsed.data.paymentId, id, parsed.data.reason ?? null],
    );

    if (!updated.rows[0]?.id) {
      return Response.json(
        { ok: false, error: "payment_not_found_or_already_reverted" },
        { status: 404 },
      );
    }

    return Response.json(
      { ok: true, payment: mapPaymentRow(updated.rows[0]) },
      { status: 200 },
    );
  } finally {
    client.release();
  }
}
