import { getPool } from "@/lib/db";
import {
  calculateCapitalTotal,
  signedFinanceAmount,
} from "@/lib/finances";
import {
  loadZelleInventories,
  summarizeZelleInventories,
} from "@/lib/zelle-inventory";
import type {
  FinanceCounterparty,
  FinanceCashMovement,
  FinanceCurrencyExchange,
  FinanceDebtMovement,
  FinanceExpense,
  FinanceMovementType,
  FinanceOverview,
  FinanceSettingChange,
  WireProfitPeriodSummary,
} from "@/lib/types";

export const runtime = "nodejs";

function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapWireProfitPeriod(
  row: Record<string, unknown>,
  prefix: "lifetime" | "month",
): WireProfitPeriodSummary {
  return {
    profitCup: toNumber(row[`${prefix}ProfitCup`]),
    profitUsd: toNumber(row[`${prefix}ProfitUsd`]),
    exactProfitCup: toNumber(row[`${prefix}ExactProfitCup`]),
    exactProfitUsd: toNumber(row[`${prefix}ExactProfitUsd`]),
    estimatedProfitCup: toNumber(row[`${prefix}EstimatedProfitCup`]),
    estimatedProfitUsd: toNumber(row[`${prefix}EstimatedProfitUsd`]),
    exactCount: toNumber(row[`${prefix}ExactCount`]),
    estimatedCount: toNumber(row[`${prefix}EstimatedCount`]),
    pendingCount: toNumber(row[`${prefix}PendingCount`]),
    ownerFeeCup: toNumber(row[`${prefix}OwnerFeeCup`]),
    ownerFeeUsd: toNumber(row[`${prefix}OwnerFeeUsd`]),
    netProfitCup: toNumber(row[`${prefix}NetProfitCup`]),
    netProfitUsd: toNumber(row[`${prefix}NetProfitUsd`]),
    netExactProfitCup: toNumber(row[`${prefix}NetExactProfitCup`]),
    netExactProfitUsd: toNumber(row[`${prefix}NetExactProfitUsd`]),
    netEstimatedProfitCup: toNumber(row[`${prefix}NetEstimatedProfitCup`]),
    netEstimatedProfitUsd: toNumber(row[`${prefix}NetEstimatedProfitUsd`]),
    netExactCount: toNumber(row[`${prefix}NetExactCount`]),
    netEstimatedCount: toNumber(row[`${prefix}NetEstimatedCount`]),
    netPendingCount: toNumber(row[`${prefix}NetPendingCount`]),
  };
}

export async function GET(request?: Request) {
  const client = await getPool().connect();

  try {
    const summaryView = request
      ? new URL(request.url).searchParams.get("view") === "summary"
      : false;
    const [coreResult, zelleInventories, counterpartiesResult, movementsResult] =
      await Promise.all([
        client.query(`
          SELECT
            (SELECT row_to_json(state_row) FROM (
              SELECT cash_usd as "cashUsd", cash_cup as "cashCup",
                     usd_cup_rate as "usdCupRate", updated_at as "updatedAt"
              FROM finance_state WHERE id = 1
            ) state_row) AS state,
            (SELECT row_to_json(remesero_row) FROM (
              SELECT COALESCE(SUM(GREATEST(-deuda_actual, 0)), 0) as "receivableCup",
                     COALESCE(SUM(GREATEST(deuda_actual, 0)), 0) as "payableCup",
                     COALESCE(-SUM(deuda_actual), 0) as "netCup"
              FROM remeseros WHERE deleted_at IS NULL
            ) remesero_row) AS remeseros,
            (SELECT COALESCE(json_agg(row_to_json(change_row)), '[]') FROM (
              SELECT id, field_name as "fieldName", previous_value as "previousValue",
                     new_value as "newValue", note, changed_at as "changedAt"
              FROM finance_state_changes ORDER BY changed_at DESC LIMIT 10
            ) change_row) AS changes,
            (SELECT COALESCE(json_agg(row_to_json(expense_row)), '[]') FROM (
              SELECT id, currency, amount, description,
                     balance_before as "balanceBefore", balance_after as "balanceAfter",
                     cash_movement_id as "cashMovementId",
                     reversal_cash_movement_id as "reversalCashMovementId",
                     occurred_at as "occurredAt", reverted_at as "revertedAt",
                     reverted_reason as "revertedReason"
              FROM finance_expenses ORDER BY occurred_at DESC, created_at DESC LIMIT 10
            ) expense_row) AS expenses,
            (SELECT COALESCE(json_agg(row_to_json(exchange_row)), '[]') FROM (
              SELECT id, direction, source_amount as "sourceAmount", rate,
                     target_amount as "targetAmount", note,
                     occurred_at as "occurredAt", reverted_at as "revertedAt",
                     reverted_reason as "revertedReason"
              FROM finance_currency_exchanges ORDER BY occurred_at DESC, created_at DESC LIMIT 10
            ) exchange_row) AS exchanges,
            CASE WHEN $1::boolean THEN '[]'::json ELSE
              (SELECT COALESCE(json_agg(row_to_json(cash_row)), '[]') FROM (
                SELECT id, currency, signed_amount as "signedAmount",
                       balance_before as "balanceBefore", balance_after as "balanceAfter",
                       operation_type as "operationType", operation_id as "operationId",
                       reversal_of_id as "reversalOfId", note, occurred_at as "occurredAt"
                FROM finance_cash_movements ORDER BY occurred_at DESC, created_at DESC LIMIT 20
              ) cash_row)
            END AS cash_movements,
            (SELECT row_to_json(profit_row) FROM (
              SELECT
                COALESCE(SUM(wire_profit_cup) FILTER (WHERE wire_profit_status IN ('EXACT', 'ESTIMATED')), 0) AS "lifetimeProfitCup",
                COALESCE(SUM(wire_profit_usd) FILTER (WHERE wire_profit_status IN ('EXACT', 'ESTIMATED')), 0) AS "lifetimeProfitUsd",
                COALESCE(SUM(wire_profit_cup) FILTER (WHERE wire_profit_status = 'EXACT'), 0) AS "lifetimeExactProfitCup",
                COALESCE(SUM(wire_profit_usd) FILTER (WHERE wire_profit_status = 'EXACT'), 0) AS "lifetimeExactProfitUsd",
                COALESCE(SUM(wire_profit_cup) FILTER (WHERE wire_profit_status = 'ESTIMATED'), 0) AS "lifetimeEstimatedProfitCup",
                COALESCE(SUM(wire_profit_usd) FILTER (WHERE wire_profit_status = 'ESTIMATED'), 0) AS "lifetimeEstimatedProfitUsd",
                COUNT(*) FILTER (WHERE wire_profit_status = 'EXACT')::int AS "lifetimeExactCount",
                COUNT(*) FILTER (WHERE wire_profit_status = 'ESTIMATED')::int AS "lifetimeEstimatedCount",
                COUNT(*) FILTER (WHERE wire_profit_status = 'UNAVAILABLE')::int AS "lifetimePendingCount",
                COALESCE(SUM(wire_owner_fee_cup) FILTER (WHERE wire_owner_fee_percent IS NOT NULL), 0) AS "lifetimeOwnerFeeCup",
                COALESCE(SUM(wire_owner_fee_usd) FILTER (WHERE wire_owner_fee_percent IS NOT NULL), 0) AS "lifetimeOwnerFeeUsd",
                COALESCE(SUM(wire_net_profit_cup) FILTER (WHERE wire_net_profit_cup IS NOT NULL), 0) AS "lifetimeNetProfitCup",
                COALESCE(SUM(wire_net_profit_usd) FILTER (WHERE wire_net_profit_usd IS NOT NULL), 0) AS "lifetimeNetProfitUsd",
                COALESCE(SUM(wire_net_profit_cup) FILTER (WHERE wire_profit_status = 'EXACT'), 0) AS "lifetimeNetExactProfitCup",
                COALESCE(SUM(wire_net_profit_usd) FILTER (WHERE wire_profit_status = 'EXACT'), 0) AS "lifetimeNetExactProfitUsd",
                COALESCE(SUM(wire_net_profit_cup) FILTER (WHERE wire_profit_status = 'ESTIMATED'), 0) AS "lifetimeNetEstimatedProfitCup",
                COALESCE(SUM(wire_net_profit_usd) FILTER (WHERE wire_profit_status = 'ESTIMATED'), 0) AS "lifetimeNetEstimatedProfitUsd",
                COUNT(*) FILTER (WHERE wire_profit_status = 'EXACT' AND wire_owner_fee_percent IS NOT NULL)::int AS "lifetimeNetExactCount",
                COUNT(*) FILTER (WHERE wire_profit_status = 'ESTIMATED' AND wire_owner_fee_percent IS NOT NULL)::int AS "lifetimeNetEstimatedCount",
                COUNT(*) FILTER (WHERE wire_profit_status IS NOT NULL AND (wire_owner_fee_percent IS NULL OR wire_profit_status = 'UNAVAILABLE'))::int AS "lifetimeNetPendingCount",
                COALESCE(SUM(wire_profit_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status IN ('EXACT', 'ESTIMATED')), 0) AS "monthProfitCup",
                COALESCE(SUM(wire_profit_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status IN ('EXACT', 'ESTIMATED')), 0) AS "monthProfitUsd",
                COALESCE(SUM(wire_profit_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'EXACT'), 0) AS "monthExactProfitCup",
                COALESCE(SUM(wire_profit_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'EXACT'), 0) AS "monthExactProfitUsd",
                COALESCE(SUM(wire_profit_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'ESTIMATED'), 0) AS "monthEstimatedProfitCup",
                COALESCE(SUM(wire_profit_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'ESTIMATED'), 0) AS "monthEstimatedProfitUsd",
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'EXACT')::int AS "monthExactCount",
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'ESTIMATED')::int AS "monthEstimatedCount",
                COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'UNAVAILABLE')::int AS "monthPendingCount"
                ,COALESCE(SUM(wire_owner_fee_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_owner_fee_percent IS NOT NULL), 0) AS "monthOwnerFeeCup"
                ,COALESCE(SUM(wire_owner_fee_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_owner_fee_percent IS NOT NULL), 0) AS "monthOwnerFeeUsd"
                ,COALESCE(SUM(wire_net_profit_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_net_profit_cup IS NOT NULL), 0) AS "monthNetProfitCup"
                ,COALESCE(SUM(wire_net_profit_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_net_profit_usd IS NOT NULL), 0) AS "monthNetProfitUsd"
                ,COALESCE(SUM(wire_net_profit_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'EXACT'), 0) AS "monthNetExactProfitCup"
                ,COALESCE(SUM(wire_net_profit_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'EXACT'), 0) AS "monthNetExactProfitUsd"
                ,COALESCE(SUM(wire_net_profit_cup) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'ESTIMATED'), 0) AS "monthNetEstimatedProfitCup"
                ,COALESCE(SUM(wire_net_profit_usd) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'ESTIMATED'), 0) AS "monthNetEstimatedProfitUsd"
                ,COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'EXACT' AND wire_owner_fee_percent IS NOT NULL)::int AS "monthNetExactCount"
                ,COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status = 'ESTIMATED' AND wire_owner_fee_percent IS NOT NULL)::int AS "monthNetEstimatedCount"
                ,COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York') AT TIME ZONE 'America/New_York' AND wire_profit_status IS NOT NULL AND (wire_owner_fee_percent IS NULL OR wire_profit_status = 'UNAVAILABLE'))::int AS "monthNetPendingCount"
              FROM account_outflow_movements
              WHERE movement_type = 'wire'
                AND reverted_at IS NULL
                AND wire_profit_status IS NOT NULL
            ) profit_row) AS wire_profits
        `, [summaryView]),
        loadZelleInventories(client),
        client.query(`
          SELECT c.id, c.name, c.archived_at as "archivedAt",
                 c.created_at as "createdAt", c.updated_at as "updatedAt",
                 COALESCE(SUM(CASE WHEN m.currency = 'USD' THEN
                   COALESCE(m.signed_delta,
                     CASE WHEN m.movement_type IN ('RECEIVABLE', 'PAID') THEN m.amount ELSE -m.amount END)
                 ELSE 0 END), 0) as "balanceUsd",
                 COALESCE(SUM(CASE WHEN m.currency = 'CUP' THEN
                   COALESCE(m.signed_delta,
                     CASE WHEN m.movement_type IN ('RECEIVABLE', 'PAID') THEN m.amount ELSE -m.amount END)
                 ELSE 0 END), 0) as "balanceCup"
          FROM finance_counterparties c
          LEFT JOIN finance_debt_movements m
            ON m.counterparty_id = c.id AND m.reverted_at IS NULL
          WHERE c.archived_at IS NULL
          GROUP BY c.id
          ORDER BY c.name
        `),
        summaryView ? Promise.resolve({ rows: [] }) : client.query(`
          WITH ranked AS (
            SELECT m.*,
                   row_number() OVER (
                     PARTITION BY m.counterparty_id
                     ORDER BY m.occurred_at DESC, m.created_at DESC
                   ) AS row_number
            FROM finance_debt_movements m
            JOIN finance_counterparties c ON c.id = m.counterparty_id
            WHERE c.archived_at IS NULL
          )
          SELECT id, counterparty_id as "counterpartyId", currency,
                 movement_type as "movementType", amount, note,
                 signed_delta as "signedDelta",
                 balance_before as "balanceBefore", balance_after as "balanceAfter",
                 cash_movement_id as "cashMovementId",
                 source_type as "sourceType", source_id as "sourceId",
                 occurred_at as "occurredAt", reverted_at as "revertedAt",
                 reverted_reason as "revertedReason"
          FROM ranked WHERE row_number <= 10
          ORDER BY occurred_at DESC, id
        `),
      ]);

    const core = coreResult.rows[0] ?? {};
    const state = core.state ?? {};
    const remeseroRow = core.remeseros ?? {};
    const changesRows = Array.isArray(core.changes) ? core.changes : [];
    const expensesRows = Array.isArray(core.expenses) ? core.expenses : [];
    const exchangesRows = Array.isArray(core.exchanges) ? core.exchanges : [];
    const cashMovementRows = Array.isArray(core.cash_movements) ? core.cash_movements : [];
    const wireProfitRows = core.wire_profits ?? {};
    const settings = {
      cashUsd: toNumber(state.cashUsd),
      cashCup: toNumber(state.cashCup),
      usdCupRate: state.usdCupRate == null ? null : toNumber(state.usdCupRate),
      updatedAt: new Date(state.updatedAt).toISOString(),
    };

    const movementsByCounterparty = new Map<string, FinanceDebtMovement[]>();
    for (const row of movementsResult.rows) {
      const movementType = String(row.movementType) as FinanceMovementType;
      const amount = toNumber(row.amount);
      const signedAmount = row.signedDelta == null
        ? signedFinanceAmount(movementType, amount)
        : toNumber(row.signedDelta);
      const movement: FinanceDebtMovement = {
        id: String(row.id),
        counterpartyId: String(row.counterpartyId),
        currency: row.currency === "CUP" ? "CUP" : "USD",
        movementType,
        amount,
        signedAmount,
        note: row.note == null ? null : String(row.note),
        occurredAt: new Date(row.occurredAt).toISOString(),
        revertedAt: row.revertedAt == null ? null : new Date(row.revertedAt).toISOString(),
        revertedReason: row.revertedReason == null ? null : String(row.revertedReason),
        balanceBefore: row.balanceBefore == null ? null : toNumber(row.balanceBefore),
        balanceAfter: row.balanceAfter == null ? null : toNumber(row.balanceAfter),
        cashMovementId: row.cashMovementId == null ? null : String(row.cashMovementId),
        sourceType: row.sourceType === "WIRE" ? "WIRE" : null,
        sourceId: row.sourceId == null ? null : String(row.sourceId),
      };
      const current = movementsByCounterparty.get(movement.counterpartyId) ?? [];
      current.push(movement);
      movementsByCounterparty.set(movement.counterpartyId, current);
    }

    const counterparties: FinanceCounterparty[] = counterpartiesResult.rows.map((row: any) => ({
      id: String(row.id),
      name: String(row.name),
      balanceUsd: toNumber(row.balanceUsd),
      balanceCup: toNumber(row.balanceCup),
      archivedAt: row.archivedAt == null ? null : new Date(row.archivedAt).toISOString(),
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
      movements: movementsByCounterparty.get(String(row.id)) ?? [],
    }));

    const external = counterparties.reduce(
      (total, counterparty) => {
        total.receivableUsd += Math.max(counterparty.balanceUsd, 0);
        total.payableUsd += Math.max(-counterparty.balanceUsd, 0);
        total.receivableCup += Math.max(counterparty.balanceCup, 0);
        total.payableCup += Math.max(-counterparty.balanceCup, 0);
        return total;
      },
      { receivableUsd: 0, payableUsd: 0, receivableCup: 0, payableCup: 0 },
    );
    const externalNetUsd = external.receivableUsd - external.payableUsd;
    const externalNetCup = external.receivableCup - external.payableCup;
    const remeserosNetCup = toNumber(remeseroRow.netCup);
    const rate = settings.usdCupRate;
    const zelleValuation = summarizeZelleInventories(zelleInventories);
    const zelleUsd = zelleValuation.summary.balanceUsd;

    const settingChanges: FinanceSettingChange[] = changesRows.map((row: any) => ({
      id: String(row.id),
      fieldName: row.fieldName,
      previousValue: row.previousValue == null ? null : toNumber(row.previousValue),
      newValue: row.newValue == null ? null : toNumber(row.newValue),
      note: row.note == null ? null : String(row.note),
      changedAt: new Date(row.changedAt).toISOString(),
    }));

    const expenses: FinanceExpense[] = expensesRows.map((row: any) => ({
      id: String(row.id),
      currency: row.currency === "CUP" ? "CUP" : "USD",
      amount: toNumber(row.amount),
      description: String(row.description),
      balanceBefore: toNumber(row.balanceBefore),
      balanceAfter: toNumber(row.balanceAfter),
      occurredAt: new Date(row.occurredAt).toISOString(),
      cashMovementId: row.cashMovementId == null ? null : String(row.cashMovementId),
      reversalCashMovementId:
        row.reversalCashMovementId == null ? null : String(row.reversalCashMovementId),
      revertedAt: row.revertedAt == null ? null : new Date(row.revertedAt).toISOString(),
      revertedReason: row.revertedReason == null ? null : String(row.revertedReason),
    }));

    const cashMovements: FinanceCashMovement[] = cashMovementRows.map((row: any) => ({
      id: String(row.id),
      currency: row.currency === "CUP" ? "CUP" : "USD",
      signedAmount: toNumber(row.signedAmount),
      balanceBefore: toNumber(row.balanceBefore),
      balanceAfter: toNumber(row.balanceAfter),
      operationType: row.operationType,
      operationId: String(row.operationId),
      reversalOfId: row.reversalOfId == null ? null : String(row.reversalOfId),
      note: row.note == null ? null : String(row.note),
      occurredAt: new Date(row.occurredAt).toISOString(),
    }));

    const exchanges: FinanceCurrencyExchange[] = exchangesRows.map((row: any) => ({
      id: String(row.id),
      direction: row.direction,
      sourceAmount: toNumber(row.sourceAmount),
      rate: toNumber(row.rate),
      targetAmount: toNumber(row.targetAmount),
      note: row.note == null ? null : String(row.note),
      occurredAt: new Date(row.occurredAt).toISOString(),
      revertedAt: row.revertedAt == null ? null : new Date(row.revertedAt).toISOString(),
      revertedReason: row.revertedReason == null ? null : String(row.revertedReason),
    }));

    const overview: FinanceOverview = {
      settings,
      counterparties,
      settingChanges,
      expenses,
      cashMovements,
      exchanges,
      totals: {
        zelleUsd,
        zelleValuation: {
          ...zelleValuation.summary,
          accounts: zelleValuation.accounts,
        },
        remeseros: {
          receivableCup: toNumber(remeseroRow.receivableCup),
          payableCup: toNumber(remeseroRow.payableCup),
          netCup: remeserosNetCup,
          netUsd: rate ? remeserosNetCup / rate : null,
        },
        external: {
          ...external,
          netUsd: externalNetUsd,
          netCup: externalNetCup,
          netCupUsd: rate ? externalNetCup / rate : null,
        },
        wireProfits: {
          lifetime: mapWireProfitPeriod(wireProfitRows, "lifetime"),
          currentMonth: mapWireProfitPeriod(wireProfitRows, "month"),
        },
        capitalTotalUsd: calculateCapitalTotal({
          cashUsd: settings.cashUsd,
          cashCup: settings.cashCup,
          usdCupRate: rate,
          zelleUsd,
          remeserosNetCup,
          externalNetUsd,
          externalNetCup,
        }),
      },
    };

    return Response.json({ ok: true, overview }, { status: 200 });
  } finally {
    client.release();
  }
}
