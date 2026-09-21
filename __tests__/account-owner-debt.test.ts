import { describe, expect, it, vi } from "vitest";
import { insertOwnerDebtMovement } from "@/lib/account-owner-debt";

describe("account owner debt ledger", () => {
  it("uses the current signed balance and stores an auditable delta", async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ balance: "125.50" }] })
      .mockResolvedValueOnce({ rows: [{ id: "movement-1" }] });

    const result = await insertOwnerDebtMovement({ query }, {
      accountId: "account-1",
      ownerId: "owner-1",
      category: "MANUAL_ADJUSTMENT",
      movementType: "ADJUSTMENT",
      signedDelta: -25.26,
      note: "Corrección auditada",
      sourceType: "MANUAL",
      sourceId: "source-1",
    });

    expect(result).toEqual({
      id: "movement-1",
      balanceBefore: 125.5,
      balanceAfter: 100.24,
      signedDelta: -25.26,
    });
    expect(query.mock.calls[1][1]).toEqual([
      "account-1", "owner-1", "MANUAL_ADJUSTMENT", "ADJUSTMENT", 25.26,
      -25.26, 125.5, 100.24, "Corrección auditada", "MANUAL", "source-1", null,
    ]);
  });

  it("rejects zero-value ledger movements", async () => {
    await expect(insertOwnerDebtMovement({ query: vi.fn() }, {
      accountId: "account-1",
      ownerId: "owner-1",
      category: "COMMISSION",
      movementType: "ACCRUAL",
      signedDelta: 0,
    })).rejects.toThrow("owner_debt_delta_must_be_non_zero");
  });
});
