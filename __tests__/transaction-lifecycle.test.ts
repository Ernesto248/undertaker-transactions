import { describe, expect, it } from "vitest";
import { calculateZelleInventory } from "@/lib/zelle-inventory";
import {
  createTransactionLifecyclePreview,
  type TransactionLifecycleRecord,
} from "@/lib/transaction-lifecycle";

const occurredAt = "2026-08-01T12:00:00.000Z";

function record(
  overrides: Partial<TransactionLifecycleRecord> = {},
): TransactionLifecycleRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    accountId: "22222222-2222-4222-8222-222222222222",
    accountName: "BDR",
    amountUsd: 100,
    deletedAt: null,
    activeAssignmentCount: 0,
    assignmentHistoryCount: 0,
    ...overrides,
  };
}

function inventory(
  transactions: Array<{
    id: string;
    amountUsd: number;
    priceApplied: number | null;
    occurredAt: string;
  }>,
  outflows: Array<{ id: string; amountUsd: number; occurredAt: string }> = [],
) {
  return calculateZelleInventory({
    accountId: "22222222-2222-4222-8222-222222222222",
    accountName: "BDR",
    transactions,
    outflows,
  });
}

describe("transaction lifecycle preview", () => {
  it("allows deleting a complete unconsumed FIFO lot", () => {
    const transaction = record();
    const before = inventory([
      { id: transaction.id, amountUsd: 100, priceApplied: null, occurredAt },
      { id: "later", amountUsd: 50, priceApplied: 680, occurredAt: "2026-08-01T13:00:00.000Z" },
    ]);
    const after = inventory([
      { id: "later", amountUsd: 50, priceApplied: 680, occurredAt: "2026-08-01T13:00:00.000Z" },
    ]);

    const preview = createTransactionLifecyclePreview(transaction, "delete", before, after);

    expect(preview.canProceed).toBe(true);
    expect(preview.blocker).toBeNull();
    expect(preview.availableFromLotUsd).toBe(100);
    expect(preview.balanceBeforeUsd).toBe(150);
    expect(preview.balanceAfterUsd).toBe(50);
  });

  it("blocks partially consumed and fully consumed FIFO lots", () => {
    const transaction = record();
    const source = { id: transaction.id, amountUsd: 100, priceApplied: null, occurredAt };

    const partial = createTransactionLifecyclePreview(
      transaction,
      "delete",
      inventory([source], [{ id: "wire", amountUsd: 40, occurredAt: "2026-08-01T13:00:00.000Z" }]),
      inventory([], [{ id: "wire", amountUsd: 40, occurredAt: "2026-08-01T13:00:00.000Z" }]),
    );
    const full = createTransactionLifecyclePreview(
      transaction,
      "delete",
      inventory([source], [{ id: "wire", amountUsd: 100, occurredAt: "2026-08-01T13:00:00.000Z" }]),
      inventory([], [{ id: "wire", amountUsd: 100, occurredAt: "2026-08-01T13:00:00.000Z" }]),
    );

    expect(partial).toMatchObject({
      canProceed: false,
      blocker: "fifo_partially_consumed",
      availableFromLotUsd: 60,
    });
    expect(full).toMatchObject({
      canProceed: false,
      blocker: "fifo_fully_consumed",
      availableFromLotUsd: 0,
    });
  });

  it("blocks active assignments and non-positive transactions", () => {
    const positive = record({ activeAssignmentCount: 1 });
    const positiveInventory = inventory([
      { id: positive.id, amountUsd: 100, priceApplied: 680, occurredAt },
    ]);
    const empty = inventory([]);
    const assigned = createTransactionLifecyclePreview(
      positive,
      "delete",
      positiveInventory,
      empty,
    );

    const negative = record({ amountUsd: -100 });
    const negativeInventory = inventory([
      { id: negative.id, amountUsd: -100, priceApplied: null, occurredAt },
    ]);
    const nonPositive = createTransactionLifecyclePreview(
      negative,
      "delete",
      negativeInventory,
      empty,
    );

    expect(assigned.blocker).toBe("active_assignment");
    expect(nonPositive.blocker).toBe("non_positive_transaction");
  });

  it("restores a deleted transaction without reactivating assignment history", () => {
    const transaction = record({
      deletedAt: "2026-08-02T12:00:00.000Z",
      assignmentHistoryCount: 2,
    });
    const before = inventory([]);
    const after = inventory([
      { id: transaction.id, amountUsd: 100, priceApplied: null, occurredAt },
    ]);

    const preview = createTransactionLifecyclePreview(transaction, "restore", before, after);

    expect(preview).toMatchObject({
      canProceed: true,
      blocker: null,
      balanceBeforeUsd: 0,
      balanceAfterUsd: 100,
      assignmentHistoryCount: 2,
    });
  });
});
