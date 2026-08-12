import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TransactionLifecyclePreview } from "@/lib/types";

const connectMock = vi.fn();
const loadRecordMock = vi.fn();
const lockAccountMock = vi.fn();
const buildPreviewMock = vi.fn();
const insertAuditMock = vi.fn();

vi.mock("@/lib/db", () => ({
  getPool: () => ({ connect: connectMock }),
}));

vi.mock("@/lib/transaction-lifecycle", () => ({
  loadTransactionLifecycleRecord: loadRecordMock,
  lockTransactionAccount: lockAccountMock,
  buildTransactionLifecyclePreview: buildPreviewMock,
  insertTransactionLifecycleAudit: insertAuditMock,
}));

const transactionId = "11111111-1111-4111-8111-111111111111";
const record = {
  id: transactionId,
  accountId: "22222222-2222-4222-8222-222222222222",
  accountName: "BDR",
  amountUsd: 100,
  deletedAt: null,
  activeAssignmentCount: 0,
  assignmentHistoryCount: 0,
};
const valuation = {
  accountId: record.accountId,
  accountName: record.accountName,
  balanceUsd: 100,
  inventoryUsd: 100,
  deficitUsd: 0,
  pricedUsd: 0,
  unpricedUsd: 100,
  costCup: 0,
  averagePrice: null,
  coveragePercent: 0,
};
const preview: TransactionLifecyclePreview = {
  action: "delete",
  transactionId,
  amountUsd: 100,
  accountId: record.accountId,
  accountName: record.accountName,
  assignmentHistoryCount: 0,
  canProceed: true,
  blocker: null,
  availableFromLotUsd: 100,
  balanceBeforeUsd: 100,
  balanceAfterUsd: 0,
  valuationBefore: valuation,
  valuationAfter: { ...valuation, balanceUsd: 0, inventoryUsd: 0, unpricedUsd: 0 },
};

describe("transaction lifecycle API", () => {
  beforeEach(() => {
    connectMock.mockReset();
    loadRecordMock.mockReset();
    lockAccountMock.mockReset();
    buildPreviewMock.mockReset();
    insertAuditMock.mockReset();
  });

  it("soft-deletes and audits an eligible transaction atomically", async () => {
    const client = { query: vi.fn(), release: vi.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ deletedAt: "2026-08-11T12:00:00.000Z" }] })
      .mockResolvedValueOnce({ rows: [] });
    connectMock.mockResolvedValue(client);
    loadRecordMock.mockResolvedValue(record);
    lockAccountMock.mockResolvedValue(true);
    buildPreviewMock.mockResolvedValue(preview);
    insertAuditMock.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/transactions/[id]/route");
    const response = await DELETE(
      new Request(`http://localhost/api/transactions/${transactionId}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: "Duplicada" }),
      }),
      { params: Promise.resolve({ id: transactionId }) },
    );

    expect(response.status).toBe(200);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("SET deleted_at = now()"))).toBe(true);
    expect(insertAuditMock).toHaveBeenCalledWith(
      client,
      transactionId,
      "DELETED",
      "Duplicada",
      preview,
    );
    expect(client.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it("rolls back when FIFO reports the lot as consumed", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }), release: vi.fn() };
    connectMock.mockResolvedValue(client);
    loadRecordMock.mockResolvedValue(record);
    lockAccountMock.mockResolvedValue(true);
    buildPreviewMock.mockResolvedValue({
      ...preview,
      canProceed: false,
      blocker: "fifo_partially_consumed",
      availableFromLotUsd: 40,
    });

    const { DELETE } = await import("@/app/api/transactions/[id]/route");
    const response = await DELETE(
      new Request(`http://localhost/api/transactions/${transactionId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: transactionId }) },
    );

    expect(response.status).toBe(409);
    expect(insertAuditMock).not.toHaveBeenCalled();
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("UPDATE transactions"))).toBe(false);
  });

  it("restores without recreating historical assignments", async () => {
    const deletedRecord = { ...record, deletedAt: "2026-08-11T12:00:00.000Z", assignmentHistoryCount: 2 };
    const restorePreview = { ...preview, action: "restore" as const, assignmentHistoryCount: 2 };
    const client = { query: vi.fn(), release: vi.fn() };
    client.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: transactionId }] })
      .mockResolvedValueOnce({ rows: [] });
    connectMock.mockResolvedValue(client);
    loadRecordMock.mockResolvedValue(deletedRecord);
    lockAccountMock.mockResolvedValue(true);
    buildPreviewMock.mockResolvedValue(restorePreview);

    const { POST } = await import("@/app/api/transactions/[id]/restore/route");
    const response = await POST(
      new Request(`http://localhost/api/transactions/${transactionId}/restore`, {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ id: transactionId }) },
    );

    expect(response.status).toBe(200);
    expect(client.query.mock.calls.some((call) => String(call[0]).includes("SET deleted_at = NULL"))).toBe(true);
    expect(insertAuditMock).toHaveBeenCalledWith(
      client,
      transactionId,
      "RESTORED",
      null,
      restorePreview,
    );
  });
});
