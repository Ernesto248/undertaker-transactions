import { z } from "zod";
import type { PoolClient } from "@neondatabase/serverless";
import type {
  Transaction,
  TransactionFeed,
  TransactionFeedFilterOptions,
  TransactionFeedStatus,
  TransactionFeedSummary,
} from "@/lib/types";

const CursorSchema = z.object({
  sortAt: z.string().datetime({ offset: true }),
  id: z.string().uuid(),
});

export type TransactionFeedFilters = {
  status: TransactionFeedStatus;
  limit: number;
  cursor?: string;
  bank?: string;
  account?: string;
  search?: string;
  sender?: string;
  amount?: number;
  remesero?: string;
  from?: string;
  to?: string;
};

type SqlFilter = {
  clauses: string[];
  values: unknown[];
};

function encodeCursor(sortAt: Date | string, id: string) {
  const value = {
    sortAt: new Date(sortAt).toISOString(),
    id,
  };
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return null;
  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return CursorSchema.parse(decoded);
  } catch {
    return null;
  }
}

export function isValidTransactionCursor(cursor?: string) {
  return cursor === undefined || decodeCursor(cursor) !== null;
}

function addValue(filter: SqlFilter, value: unknown) {
  filter.values.push(value);
  return `$${filter.values.length}`;
}

function buildBaseFilter(filters: TransactionFeedFilters): SqlFilter {
  const result: SqlFilter = {
    clauses: [filters.status === "active" ? "t.deleted_at IS NULL" : "t.deleted_at IS NOT NULL"],
    values: [],
  };

  if (filters.bank) {
    result.clauses.push(`b.name = ${addValue(result, filters.bank)}`);
  }
  if (filters.account) {
    result.clauses.push(`g.account_name = ${addValue(result, filters.account)}`);
  }
  if (filters.search) {
    result.clauses.push(`COALESCE(t.actor_name, '') ILIKE ${addValue(result, `%${filters.search}%`)}`);
  }
  if (filters.sender) {
    result.clauses.push(`COALESCE(t.actor_name, '') ILIKE ${addValue(result, `%${filters.sender}%`)}`);
  }
  if (filters.amount !== undefined) {
    result.clauses.push(`t.amount = ${addValue(result, filters.amount)}`);
  }
  if (filters.remesero === "unassigned") {
    result.clauses.push("rta.id IS NULL");
  } else if (filters.remesero) {
    result.clauses.push(`r.nombre = ${addValue(result, filters.remesero)}`);
  }

  return result;
}

function appendDateFilter(filter: SqlFilter, filters: TransactionFeedFilters) {
  if (filters.from) {
    filter.clauses.push(`t.occurred_at >= ${addValue(filter, filters.from)}::timestamptz`);
  }
  if (filters.to) {
    filter.clauses.push(`t.occurred_at <= ${addValue(filter, filters.to)}::timestamptz`);
  }
}

function mapTransaction(row: Record<string, unknown>): Transaction {
  const amount = Number(row.amount);
  const confirmationCode = String(row.confirmationCode ?? "");
  return {
    id: String(row.id),
    bank: String(row.bank ?? ""),
    accountName: String(row.accountName ?? ""),
    senderName: String(row.senderName ?? ""),
    amount,
    confirmationCode,
    createdAt: row.createdAt
      ? new Date(row.createdAt as string | Date).toISOString()
      : new Date().toISOString(),
    deletedAt: row.deletedAt
      ? new Date(row.deletedAt as string | Date).toISOString()
      : null,
    deletionReason: row.deletionReason == null ? null : String(row.deletionReason),
    assignedRemeseroId:
      row.assignedRemeseroId == null ? null : String(row.assignedRemeseroId),
    assignedRemeseroNombre:
      row.assignedRemeseroNombre == null ? null : String(row.assignedRemeseroNombre),
    assignmentHistoryCount: Number(row.assignmentHistoryCount ?? 0),
    type: confirmationCode.startsWith("TR-")
      ? "transfer"
      : amount < 0
        ? "withdrawal"
        : "deposit",
  };
}

function trend(current: number, previous: number) {
  if (previous === 0) return null;
  const value = Math.round((((current - previous) / previous) * 100) * 10) / 10;
  return Object.is(value, -0) ? 0 : value;
}

function mapSummaryResult(row: Record<string, unknown>) {
  const todayTransactions = Number(row.today_transactions ?? 0);
  const yesterdayTransactions = Number(row.yesterday_transactions ?? 0);
  const todayAmount = Number(row.today_amount ?? 0);
  const yesterdayAmount = Number(row.yesterday_amount ?? 0);
  const numberItems = (value: unknown) =>
    (Array.isArray(value) ? value : []).map((item: Record<string, unknown>) => ({
      name: String(item.name ?? ""),
      value: Number(item.value ?? 0),
    }));

  const bankTotals = numberItems(row.bank_totals).map((item) => ({
    bank: item.name,
    totalAmount: item.value,
  }));
  const summary: TransactionFeedSummary = {
    totalTransactions: Number(row.total_transactions ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    avgTransaction: Number(row.avg_transaction ?? 0),
    todayTransactions,
    todayTransactionsTrend: trend(todayTransactions, yesterdayTransactions),
    totalAmountTrend: trend(todayAmount, yesterdayAmount),
    bankTotals,
    bankDistribution: numberItems(row.bank_distribution),
    accountDistribution: numberItems(row.account_distribution),
    chartPoints: (Array.isArray(row.chart_points) ? row.chart_points : []).map(
      (item: Record<string, unknown>) => ({
        date: String(item.date ?? ""),
        bank: String(item.bank ?? ""),
        accountName: String(item.accountName ?? ""),
        amount: Number(item.amount ?? 0),
      }),
    ),
  };
  const filterOptions: TransactionFeedFilterOptions = {
    banks: Array.isArray(row.filter_banks) ? row.filter_banks.map(String) : [],
    accounts: Array.isArray(row.filter_accounts) ? row.filter_accounts.map(String) : [],
    remeseros: Array.isArray(row.filter_remeseros) ? row.filter_remeseros.map(String) : [],
  };
  return { summary, filterOptions };
}

async function loadPage(client: PoolClient, filters: TransactionFeedFilters) {
  const base = buildBaseFilter(filters);
  appendDateFilter(base, filters);
  const cursor = decodeCursor(filters.cursor);
  const sortColumn = filters.status === "active" ? "t.occurred_at" : "t.deleted_at";
  if (cursor) {
    const sortParam = addValue(base, cursor.sortAt);
    const idParam = addValue(base, cursor.id);
    base.clauses.push(`(${sortColumn}, t.id) < (${sortParam}::timestamptz, ${idParam}::uuid)`);
  }
  const limitParam = addValue(base, filters.limit + 1);

  const result = await client.query(
    `WITH page AS (
       SELECT t.id, b.name AS bank, g.account_name AS "accountName",
              t.actor_name AS "senderName", t.amount,
              t.confirmation_code AS "confirmationCode",
              t.occurred_at AS "createdAt", t.deleted_at AS "deletedAt",
              t.deletion_reason AS "deletionReason",
              rta.remesero_id AS "assignedRemeseroId",
              r.nombre AS "assignedRemeseroNombre",
              ${sortColumn} AS sort_at
       FROM transactions t
       LEFT JOIN banks b ON b.id = t.bank_id
       LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
       LEFT JOIN remesero_transaction_assignments rta
         ON rta.transaction_id = t.id AND rta.unassigned_at IS NULL
       LEFT JOIN remeseros r ON r.id = rta.remesero_id
       WHERE ${base.clauses.join(" AND ")}
       ORDER BY ${sortColumn} DESC, t.id DESC
       LIMIT ${limitParam}
     ), history AS (
       SELECT a.transaction_id, COUNT(*)::int AS history_count
       FROM remesero_transaction_assignments a
       JOIN page p ON p.id = a.transaction_id
       GROUP BY a.transaction_id
     )
     SELECT p.*, COALESCE(h.history_count, 0) AS "assignmentHistoryCount"
     FROM page p
     LEFT JOIN history h ON h.transaction_id = p.id
     ORDER BY p.sort_at DESC, p.id DESC`,
    base.values,
  );

  const hasMore = result.rows.length > filters.limit;
  const rows = hasMore ? result.rows.slice(0, filters.limit) : result.rows;
  const transactions = rows.map(mapTransaction);
  const lastRow = rows.at(-1);
  return {
    transactions,
    pageInfo: {
      hasMore,
      nextCursor: hasMore && lastRow
        ? encodeCursor(lastRow.sort_at as Date | string, String(lastRow.id))
        : null,
    },
  };
}

async function loadSummary(client: PoolClient, filters: TransactionFeedFilters) {
  const base = buildBaseFilter(filters);
  const filtered: SqlFilter = {
    clauses: [...base.clauses],
    values: [...base.values],
  };
  appendDateFilter(filtered, filters);

  // Both CTEs use the same base parameters. Date parameters are appended only to filtered.
  const result = await client.query(
    `WITH base_filtered AS (
       SELECT t.amount, t.occurred_at, b.name AS bank,
              g.account_name AS account_name
       FROM transactions t
       LEFT JOIN banks b ON b.id = t.bank_id
       LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
       LEFT JOIN remesero_transaction_assignments rta
         ON rta.transaction_id = t.id AND rta.unassigned_at IS NULL
       LEFT JOIN remeseros r ON r.id = rta.remesero_id
       WHERE ${base.clauses.join(" AND ")}
     ), filtered AS (
       SELECT t.amount, t.occurred_at, b.name AS bank,
              g.account_name AS account_name
       FROM transactions t
       LEFT JOIN banks b ON b.id = t.bank_id
       LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
       LEFT JOIN remesero_transaction_assignments rta
         ON rta.transaction_id = t.id AND rta.unassigned_at IS NULL
       LEFT JOIN remeseros r ON r.id = rta.remesero_id
       WHERE ${filtered.clauses.join(" AND ")}
     ), bank_totals AS (
       SELECT COALESCE(bank, '') AS name, SUM(amount)::numeric AS value
       FROM filtered GROUP BY bank ORDER BY value DESC
     ), account_totals AS (
       SELECT COALESCE(account_name, '') AS name, SUM(amount)::numeric AS value
       FROM filtered GROUP BY account_name ORDER BY value DESC
     ), chart_points AS (
       SELECT to_char(occurred_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS date,
              COALESCE(bank, '') AS bank,
              COALESCE(account_name, '') AS account_name,
              SUM(amount)::numeric AS amount
       FROM filtered
       WHERE occurred_at >= (CURRENT_DATE - INTERVAL '6 days') AT TIME ZONE 'America/New_York'
       GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
     )
     SELECT
       (SELECT COUNT(*)::int FROM filtered) AS total_transactions,
       COALESCE((SELECT SUM(amount) FROM filtered), 0)::numeric AS total_amount,
       COALESCE((SELECT AVG(amount) FROM filtered), 0)::numeric AS avg_transaction,
       (SELECT COUNT(*)::int FROM base_filtered
         WHERE (occurred_at AT TIME ZONE 'America/New_York')::date =
               (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date) AS today_transactions,
       COALESCE((SELECT SUM(amount) FROM base_filtered
         WHERE (occurred_at AT TIME ZONE 'America/New_York')::date =
               (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date), 0)::numeric AS today_amount,
       (SELECT COUNT(*)::int FROM base_filtered
         WHERE (occurred_at AT TIME ZONE 'America/New_York')::date =
               (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - 1) AS yesterday_transactions,
       COALESCE((SELECT SUM(amount) FROM base_filtered
         WHERE (occurred_at AT TIME ZONE 'America/New_York')::date =
               (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - 1), 0)::numeric AS yesterday_amount,
       COALESCE((SELECT json_agg(json_build_object('name', name, 'value', value)) FROM bank_totals), '[]') AS bank_totals,
       COALESCE((SELECT json_agg(json_build_object('name', name, 'value', value)) FROM (SELECT * FROM bank_totals LIMIT 4) top_banks), '[]') AS bank_distribution,
       COALESCE((SELECT json_agg(json_build_object('name', name, 'value', value)) FROM (SELECT * FROM account_totals LIMIT 4) top_accounts), '[]') AS account_distribution,
       COALESCE((SELECT json_agg(json_build_object('date', date, 'bank', bank, 'accountName', account_name, 'amount', amount)) FROM chart_points), '[]') AS chart_points,
       COALESCE((SELECT json_agg(name ORDER BY name) FROM banks), '[]') AS filter_banks,
       COALESCE((SELECT json_agg(account_name ORDER BY account_name) FROM gmail_accounts), '[]') AS filter_accounts,
       COALESCE((SELECT json_agg(nombre ORDER BY nombre) FROM remeseros WHERE deleted_at IS NULL), '[]') AS filter_remeseros`,
    filtered.values,
  );

  return mapSummaryResult(result.rows[0] ?? {});
}

async function loadCombinedFeed(client: PoolClient, filters: TransactionFeedFilters) {
  const parameters = buildBaseFilter(filters);
  const baseClauses = [...parameters.clauses];
  appendDateFilter(parameters, filters);
  const filteredClauses = [...parameters.clauses];
  const pageClauses = [...filteredClauses];
  const cursor = decodeCursor(filters.cursor);
  const sortColumn = filters.status === "active" ? "t.occurred_at" : "t.deleted_at";
  if (cursor) {
    const sortParam = addValue(parameters, cursor.sortAt);
    const idParam = addValue(parameters, cursor.id);
    pageClauses.push(`(${sortColumn}, t.id) < (${sortParam}::timestamptz, ${idParam}::uuid)`);
  }
  const limitParam = addValue(parameters, filters.limit + 1);

  const result = await client.query(
    `WITH base_filtered AS (
       SELECT t.amount, t.occurred_at, b.name AS bank, g.account_name AS account_name
       FROM transactions t
       LEFT JOIN banks b ON b.id = t.bank_id
       LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
       LEFT JOIN remesero_transaction_assignments rta
         ON rta.transaction_id = t.id AND rta.unassigned_at IS NULL
       LEFT JOIN remeseros r ON r.id = rta.remesero_id
       WHERE ${baseClauses.join(" AND ")}
     ), filtered AS (
       SELECT t.amount, t.occurred_at, b.name AS bank, g.account_name AS account_name
       FROM transactions t
       LEFT JOIN banks b ON b.id = t.bank_id
       LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
       LEFT JOIN remesero_transaction_assignments rta
         ON rta.transaction_id = t.id AND rta.unassigned_at IS NULL
       LEFT JOIN remeseros r ON r.id = rta.remesero_id
       WHERE ${filteredClauses.join(" AND ")}
     ), page AS (
       SELECT t.id, b.name AS bank, g.account_name AS "accountName",
              t.actor_name AS "senderName", t.amount,
              t.confirmation_code AS "confirmationCode",
              t.occurred_at AS "createdAt", t.deleted_at AS "deletedAt",
              t.deletion_reason AS "deletionReason",
              rta.remesero_id AS "assignedRemeseroId",
              r.nombre AS "assignedRemeseroNombre",
              ${sortColumn} AS sort_at
       FROM transactions t
       LEFT JOIN banks b ON b.id = t.bank_id
       LEFT JOIN gmail_accounts g ON g.id = t.gmail_account_id
       LEFT JOIN remesero_transaction_assignments rta
         ON rta.transaction_id = t.id AND rta.unassigned_at IS NULL
       LEFT JOIN remeseros r ON r.id = rta.remesero_id
       WHERE ${pageClauses.join(" AND ")}
       ORDER BY ${sortColumn} DESC, t.id DESC
       LIMIT ${limitParam}
     ), history AS (
       SELECT a.transaction_id, COUNT(*)::int AS history_count
       FROM remesero_transaction_assignments a
       JOIN page p ON p.id = a.transaction_id
       GROUP BY a.transaction_id
     ), transaction_rows AS (
       SELECT p.*, COALESCE(h.history_count, 0) AS "assignmentHistoryCount"
       FROM page p LEFT JOIN history h ON h.transaction_id = p.id
     ), bank_totals AS (
       SELECT COALESCE(bank, '') AS name, SUM(amount)::numeric AS value
       FROM filtered GROUP BY bank ORDER BY value DESC
     ), account_totals AS (
       SELECT COALESCE(account_name, '') AS name, SUM(amount)::numeric AS value
       FROM filtered GROUP BY account_name ORDER BY value DESC
     ), chart_points AS (
       SELECT to_char(occurred_at AT TIME ZONE 'America/New_York', 'YYYY-MM-DD') AS date,
              COALESCE(bank, '') AS bank, COALESCE(account_name, '') AS account_name,
              SUM(amount)::numeric AS amount
       FROM filtered
       WHERE occurred_at >= (CURRENT_DATE - INTERVAL '6 days') AT TIME ZONE 'America/New_York'
       GROUP BY 1, 2, 3 ORDER BY 1, 2, 3
     )
     SELECT
       COALESCE((SELECT json_agg(transaction_rows ORDER BY sort_at DESC, id DESC) FROM transaction_rows), '[]') AS transaction_rows,
       (SELECT COUNT(*)::int FROM filtered) AS total_transactions,
       COALESCE((SELECT SUM(amount) FROM filtered), 0)::numeric AS total_amount,
       COALESCE((SELECT AVG(amount) FROM filtered), 0)::numeric AS avg_transaction,
       (SELECT COUNT(*)::int FROM base_filtered WHERE (occurred_at AT TIME ZONE 'America/New_York')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date) AS today_transactions,
       COALESCE((SELECT SUM(amount) FROM base_filtered WHERE (occurred_at AT TIME ZONE 'America/New_York')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date), 0)::numeric AS today_amount,
       (SELECT COUNT(*)::int FROM base_filtered WHERE (occurred_at AT TIME ZONE 'America/New_York')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - 1) AS yesterday_transactions,
       COALESCE((SELECT SUM(amount) FROM base_filtered WHERE (occurred_at AT TIME ZONE 'America/New_York')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/New_York')::date - 1), 0)::numeric AS yesterday_amount,
       COALESCE((SELECT json_agg(json_build_object('name', name, 'value', value)) FROM bank_totals), '[]') AS bank_totals,
       COALESCE((SELECT json_agg(json_build_object('name', name, 'value', value)) FROM (SELECT * FROM bank_totals LIMIT 4) top_banks), '[]') AS bank_distribution,
       COALESCE((SELECT json_agg(json_build_object('name', name, 'value', value)) FROM (SELECT * FROM account_totals LIMIT 4) top_accounts), '[]') AS account_distribution,
       COALESCE((SELECT json_agg(json_build_object('date', date, 'bank', bank, 'accountName', account_name, 'amount', amount)) FROM chart_points), '[]') AS chart_points,
       COALESCE((SELECT json_agg(name ORDER BY name) FROM banks), '[]') AS filter_banks,
       COALESCE((SELECT json_agg(account_name ORDER BY account_name) FROM gmail_accounts), '[]') AS filter_accounts,
       COALESCE((SELECT json_agg(nombre ORDER BY nombre) FROM remeseros WHERE deleted_at IS NULL), '[]') AS filter_remeseros`,
    parameters.values,
  );

  const row = result.rows[0] ?? {};
  const rawRows = Array.isArray(row.transaction_rows) ? row.transaction_rows : [];
  const hasMore = rawRows.length > filters.limit;
  const visibleRows = hasMore ? rawRows.slice(0, filters.limit) : rawRows;
  const transactions = visibleRows.map(mapTransaction);
  const lastRow = visibleRows.at(-1);
  const { summary, filterOptions } = mapSummaryResult(row);
  return {
    transactions,
    pageInfo: {
      hasMore,
      nextCursor: hasMore && lastRow
        ? encodeCursor(lastRow.sort_at as Date | string, String(lastRow.id))
        : null,
    },
    summary,
    filterOptions,
  } satisfies TransactionFeed;
}

export async function loadTransactionFeed(
  client: PoolClient,
  filters: TransactionFeedFilters,
): Promise<TransactionFeed> {
  return loadCombinedFeed(client, filters);
}
