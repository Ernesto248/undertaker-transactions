import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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
  ownerFeePercent: 2,
};

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => vi.unstubAllGlobals());

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
      onUpdateAccountOwnerFee={vi.fn().mockResolvedValue(true)}
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

  it("shows the FIFO price and remaining inventory before creating a wire", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/wire-preview")) {
        return {
          ok: true,
          json: async () => ({
            ok: true,
            preview: {
              accountId: "account-1",
              accountName: "Cuenta principal",
              requestedUsd: 100,
              principalUsd: 90,
              wireFeeUsd: 10,
              totalDebitUsd: 100,
              availableUsd: 874.75,
              canCreate: true,
              error: null,
              selected: {
                balanceUsd: 100,
                inventoryUsd: 100,
                deficitUsd: 0,
                pricedUsd: 90,
                unpricedUsd: 10,
                costCup: 61200,
                averagePrice: 680,
                coveragePercent: 90,
              },
              remaining: {
                balanceUsd: 774.75,
                inventoryUsd: 774.75,
                deficitUsd: 0,
                pricedUsd: 774.75,
                unpricedUsd: 0,
                costCup: 526830,
                averagePrice: 680,
                coveragePercent: 100,
              },
              profit: {
                status: "ESTIMATED",
                globalRate: 675,
                settlementAmount: 63000,
                fifoCostCup: 68000,
                profitCup: -5000,
                profitUsd: -7.41,
                ownerFeePercent: 2,
                ownerFeeAmount: 1260,
                ownerFeeCup: 1260,
                ownerFeeUsd: 1.87,
                netProfitCup: -6260,
                netProfitUsd: -9.27,
              },
            },
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ ok: true, counterparties: [] }),
      };
    }));

    renderAccountsView(vi.fn().mockResolvedValue(true));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Expandir" }));
    });
    fireEvent.change(screen.getAllByPlaceholderText("0.00")[0], { target: { value: "90" } });
    fireEvent.change(screen.getByPlaceholderText("700"), { target: { value: "700" } });
    fireEvent.change(screen.getAllByPlaceholderText("0.00")[1], { target: { value: "10" } });

    expect(await screen.findByText(/se tiraron a un promedio de 680 CUP\/USD/i)).toBeTruthy();
    expect(screen.getByText(/Ganancia neta estimada/i)).toBeTruthy();
    expect(screen.getByText(/Quedarán 774.75 USD a un promedio de 680 CUP\/USD/i)).toBeTruthy();
    expect(screen.getByText(/hay 10 USD sin precio/i)).toBeTruthy();
  });
});
