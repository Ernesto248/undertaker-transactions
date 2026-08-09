import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AccountsView } from "@/components/dashboard/accounts-view";
import type { AccountBalance } from "@/lib/types";

const account: AccountBalance = {
  id: "account-1",
  accountName: "Cuenta principal",
  incomingTotal: 1000.5,
  outgoingTotal: 125.75,
  balance: 874.75,
  transactionCount: 1,
  lastTransactionAt: null,
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

function renderAccountsView(onCreateMovement = vi.fn()) {
  render(
    <AccountsView
      accounts={[account]}
      movementsByAccount={{}}
      loadingAccounts={false}
      loadingMovementsByAccount={{}}
      onRefreshAccounts={vi.fn()}
      onLoadMovements={vi.fn().mockResolvedValue(undefined)}
      onCreateMovement={onCreateMovement}
      onRevertMovement={vi.fn()}
    />,
  );

  return onCreateMovement;
}

describe("AccountsView", () => {
  it("accepts and submits decimal account movement amounts", async () => {
    const onCreateMovement = renderAccountsView(
      vi.fn().mockResolvedValue(undefined),
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Expandir" }));
    });

    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: "GASTO" }));

    const amountInput = screen.getByPlaceholderText("0.00");
    expect(amountInput.getAttribute("inputmode")).toBe("decimal");

    fireEvent.change(amountInput, { target: { value: "125.75" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Registrar" }));
    });

    expect(onCreateMovement).toHaveBeenCalledWith("account-1", {
      movementType: "expense",
      amount: 125.75,
      note: undefined,
    });
  });

  it("shows stored account decimals instead of rounding them", () => {
    renderAccountsView();

    expect(screen.getAllByText("125.75").length).toBeGreaterThan(0);
    expect(screen.getAllByText("874.75").length).toBeGreaterThan(0);
  });
});
