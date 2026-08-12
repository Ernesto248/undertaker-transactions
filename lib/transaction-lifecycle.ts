import type {
  TransactionLifecycleAction,
  TransactionLifecyclePreview,
} from "@/lib/types";
import { loadZelleInventories } from "@/lib/zelle-inventory";
import type { LoadedZelleInventory } from "@/lib/zelle-inventory";

export type TransactionLifecycleQueryClient = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[] }>;
};

export type TransactionLifecycleRecord = {
  id: string;
  accountId: string;
  accountName: string;
  amountUsd: number;
  deletedAt: string | null;
  activeAssignmentCount: number;
  assignmentHistoryCount: number;
};

function toIsoString(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function loadTransactionLifecycleRecord(
  client: TransactionLifecycleQueryClient,
  transactionId: string,
  lock = false,
): Promise<TransactionLifecycleRecord | null> {
  const result = await client.query(
    `SELECT t.id,
            t.gmail_account_id as "accountId",
            g.account_name as "accountName",
            t.amount as "amountUsd",
            t.deleted_at as "deletedAt",
            COALESCE(assignments.active_count, 0) as "activeAssignmentCount",
            COALESCE(assignments.history_count, 0) as "assignmentHistoryCount"
     FROM transactions t
     JOIN gmail_accounts g ON g.id = t.gmail_account_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*) FILTER (WHERE a.unassigned_at IS NULL) as active_count,
              COUNT(*) as history_count
       FROM remesero_transaction_assignments a
       WHERE a.transaction_id = t.id
     ) assignments ON true
     WHERE t.id = $1
     LIMIT 1
     ${lock ? "FOR UPDATE OF t" : ""}`,
    [transactionId],
  );

  const row = result.rows[0];
  if (!row?.id) return null;

  return {
    id: String(row.id),
    accountId: String(row.accountId),
    accountName: String(row.accountName),
    amountUsd: Number(row.amountUsd ?? 0),
    deletedAt: toIsoString(row.deletedAt),
    activeAssignmentCount: Number(row.activeAssignmentCount ?? 0),
    assignmentHistoryCount: Number(row.assignmentHistoryCount ?? 0),
  };
}

export async function lockTransactionAccount(
  client: TransactionLifecycleQueryClient,
  accountId: string,
) {
  const result = await client.query(
    "SELECT id FROM gmail_accounts WHERE id = $1 FOR UPDATE",
    [accountId],
  );
  return Boolean(result.rows[0]?.id);
}

export function createTransactionLifecyclePreview(
  transaction: TransactionLifecycleRecord,
  action: TransactionLifecycleAction,
  beforeInventory: LoadedZelleInventory,
  afterInventory: LoadedZelleInventory,
): TransactionLifecyclePreview {
  const sourceLot = beforeInventory.lots.find(
    (lot) => lot.id === transaction.id,
  );
  const availableFromLotUsd = sourceLot
    ? Number((sourceLot.amountCents / 100).toFixed(2))
    : 0;
  const expectedAmountCents = Math.round(transaction.amountUsd * 100);
  const availableAmountCents = sourceLot?.amountCents ?? 0;

  let blocker: TransactionLifecyclePreview["blocker"] = null;

  if (action === "delete") {
    if (transaction.deletedAt) blocker = "already_deleted";
    else if (transaction.activeAssignmentCount > 0) blocker = "active_assignment";
    else if (transaction.amountUsd <= 0) blocker = "non_positive_transaction";
    else if (availableAmountCents <= 0) blocker = "fifo_fully_consumed";
    else if (availableAmountCents < expectedAmountCents) {
      blocker = "fifo_partially_consumed";
    } else if (afterInventory.valuation.balanceUsd < 0) {
      blocker = "account_would_be_negative";
    }
  } else if (!transaction.deletedAt) {
    blocker = "not_deleted";
  }

  return {
    action,
    transactionId: transaction.id,
    amountUsd: transaction.amountUsd,
    accountId: transaction.accountId,
    accountName: transaction.accountName,
    assignmentHistoryCount: transaction.assignmentHistoryCount,
    canProceed: blocker === null,
    blocker,
    availableFromLotUsd,
    balanceBeforeUsd: beforeInventory.valuation.balanceUsd,
    balanceAfterUsd: afterInventory.valuation.balanceUsd,
    valuationBefore: beforeInventory.valuation,
    valuationAfter: afterInventory.valuation,
  };
}

export async function buildTransactionLifecyclePreview(
  client: TransactionLifecycleQueryClient,
  transaction: TransactionLifecycleRecord,
  action: TransactionLifecycleAction,
): Promise<TransactionLifecyclePreview> {
  const beforeInventory = (
    await loadZelleInventories(client, transaction.accountId)
  )[0];
  const afterInventory = (
    await loadZelleInventories(
      client,
      transaction.accountId,
      action === "delete"
        ? { excludeTransactionId: transaction.id }
        : { includeDeletedTransactionId: transaction.id },
    )
  )[0];

  if (!beforeInventory || !afterInventory) {
    throw new Error("transaction_account_inventory_not_found");
  }

  return createTransactionLifecyclePreview(
    transaction,
    action,
    beforeInventory,
    afterInventory,
  );
}

export async function insertTransactionLifecycleAudit(
  client: TransactionLifecycleQueryClient,
  transactionId: string,
  action: "DELETED" | "RESTORED",
  reason: string | null,
  preview: TransactionLifecyclePreview,
) {
  await client.query(
    `INSERT INTO transaction_deletion_events
       (transaction_id, action, reason, account_balance_before,
        account_balance_after, zelle_valuation_before, zelle_valuation_after)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)`,
    [
      transactionId,
      action,
      reason,
      preview.balanceBeforeUsd,
      preview.balanceAfterUsd,
      JSON.stringify(preview.valuationBefore),
      JSON.stringify(preview.valuationAfter),
    ],
  );
}
