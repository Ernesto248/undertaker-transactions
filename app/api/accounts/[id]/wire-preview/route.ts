import { z } from "zod";
import { getPool } from "@/lib/db";
import { roundMoney } from "@/lib/finance-ledger";
import { loadZelleInventories, previewWire } from "@/lib/zelle-inventory";
import { calculateWireProfit } from "@/lib/wire-profit";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: Params) {
  const parsedParams = z
    .object({ id: z.string().uuid() })
    .safeParse(await params);
  const searchParams = new URL(request.url).searchParams;
  const parsedQuery = z.object({
    amount: z.coerce.number().finite().positive(),
    wireFeeUsd: z.coerce.number().finite().min(0).default(0),
    settlementCurrency: z.enum(["USD", "CUP"]).optional(),
    conversionRate: z.coerce.number().finite().positive().optional(),
    feePercent: z.coerce.number().finite().min(0).optional(),
  }).superRefine((value, context) => {
    if (value.settlementCurrency === "CUP" && value.conversionRate === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["conversionRate"], message: "conversionRate is required" });
    }
    if (value.settlementCurrency === "USD" && value.feePercent === undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["feePercent"], message: "feePercent is required" });
    }
  }).safeParse({
    amount: searchParams.get("amount"),
    wireFeeUsd: searchParams.get("wireFeeUsd") ?? 0,
    settlementCurrency: searchParams.get("settlementCurrency") ?? undefined,
    conversionRate: searchParams.get("conversionRate") ?? undefined,
    feePercent: searchParams.get("feePercent") ?? undefined,
  });

  if (!parsedParams.success || !parsedQuery.success) {
    return Response.json(
      { ok: false, error: "validation_error" },
      { status: 400 },
    );
  }

  const client = await getPool().connect();

  try {
    const inventories = await loadZelleInventories(client, parsedParams.data.id);
    const inventory = inventories[0];

    if (!inventory) {
      return Response.json(
        { ok: false, error: "account_not_found" },
        { status: 404 },
      );
    }

    const principalUsd = roundMoney(parsedQuery.data.amount);
    const wireFeeUsd = roundMoney(parsedQuery.data.wireFeeUsd);
    const totalDebitUsd = roundMoney(principalUsd + wireFeeUsd);
    const fifoPreview = previewWire(inventory, totalDebitUsd);
    const rateResult = await client.query(
      `SELECT usd_cup_rate as "globalRate" FROM finance_state WHERE id = 1`,
    );
    const globalRate = Number(rateResult.rows[0]?.globalRate ?? 0);
    const wantsProfit = parsedQuery.data.settlementCurrency !== undefined;

    let profit = null;
    let error = fifoPreview.error;
    let canCreate = fifoPreview.canCreate;
    if (wantsProfit && (!Number.isFinite(globalRate) || globalRate <= 0)) {
      canCreate = false;
      error = "global_rate_required" as const;
    } else if (wantsProfit && fifoPreview.canCreate) {
      const settlementAmount = roundMoney(
        parsedQuery.data.settlementCurrency === "CUP"
          ? principalUsd * (parsedQuery.data.conversionRate ?? 0)
          : principalUsd * (1 + (parsedQuery.data.feePercent ?? 0) / 100),
      );
      profit = calculateWireProfit({
        settlementCurrency: parsedQuery.data.settlementCurrency!,
        settlementAmount,
        globalRate,
        selected: fifoPreview.selected,
      });
    }

    return Response.json(
      {
        ok: true,
        preview: {
          ...fifoPreview,
          requestedUsd: totalDebitUsd,
          principalUsd,
          wireFeeUsd,
          totalDebitUsd,
          canCreate,
          error,
          profit,
        },
      },
      { status: 200 },
    );
  } finally {
    client.release();
  }
}
