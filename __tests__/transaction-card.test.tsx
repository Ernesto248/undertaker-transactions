import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TransactionCard } from "@/components/dashboard/transaction-card";
import type { Transaction } from "@/lib/types";

const transaction: Transaction = {
  id: "11111111-1111-4111-8111-111111111111",
  bank: "TD Bank",
  accountName: "BDR",
  senderName: "Cliente",
  amount: 100,
  confirmationCode: "12345",
  createdAt: "2026-08-11T12:00:00.000Z",
  type: "deposit",
};

describe("TransactionCard lifecycle actions", () => {
  it("only shows delete when the parent enables it", () => {
    const { rerender } = render(<TransactionCard transaction={transaction} />);
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();

    rerender(<TransactionCard transaction={transaction} onDelete={vi.fn()} />);
    const deleteButton = screen.getByRole("button", { name: "Eliminar" });
    expect(deleteButton).toBeDefined();
    expect(deleteButton.className).toContain("bg-amber-500/15");
    expect(deleteButton.className).not.toContain("bg-destructive");
  });

  it("hides deletion while an active remesero is assigned", () => {
    render(
      <TransactionCard
        transaction={{ ...transaction, assignedRemeseroId: "remesero-1" }}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
  });

  it("shows deletion metadata and restore action in the trash", () => {
    render(
      <TransactionCard
        transaction={{
          ...transaction,
          deletedAt: "2026-08-11T13:00:00.000Z",
          deletionReason: "Duplicada",
        }}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.getByText("En papelera")).toBeDefined();
    expect(screen.getByText("Motivo: Duplicada")).toBeDefined();
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeDefined();
  });
});
