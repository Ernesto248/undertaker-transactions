import { describe, expect, it } from "vitest";
import { calculateWireProfit } from "@/lib/wire-profit";

const selection = (pricedUsd: number, unpricedUsd: number, costCup: number, averagePrice: number | null) => ({
  balanceUsd: pricedUsd + unpricedUsd,
  inventoryUsd: pricedUsd + unpricedUsd,
  deficitUsd: 0,
  pricedUsd,
  unpricedUsd,
  costCup,
  averagePrice,
  coveragePercent: pricedUsd + unpricedUsd === 0 ? 0 : pricedUsd / (pricedUsd + unpricedUsd) * 100,
});

describe("calculateWireProfit", () => {
  it("calculates the confirmed exact CUP example", () => {
    expect(calculateWireProfit({
      settlementCurrency: "CUP",
      settlementAmount: 7_000_000,
      globalRate: 675,
      selected: selection(10_025, 0, 6_817_000, 680),
    })).toEqual({
      status: "EXACT",
      globalRate: 675,
      settlementAmount: 7_000_000,
      fifoCostCup: 6_817_000,
      profitCup: 183_000,
      profitUsd: 271.11,
    });
  });

  it("estimates the unpriced portion with the priced average", () => {
    expect(calculateWireProfit({
      settlementCurrency: "CUP",
      settlementAmount: 700_000,
      globalRate: 675,
      selected: selection(800, 200, 544_000, 680),
    })).toMatchObject({ status: "ESTIMATED", fifoCostCup: 680_000, profitCup: 20_000 });
  });

  it("leaves profit unavailable when the whole debit is unpriced", () => {
    expect(calculateWireProfit({
      settlementCurrency: "USD",
      settlementAmount: 1_050,
      globalRate: 675,
      selected: selection(0, 1_000, 0, null),
    })).toMatchObject({ status: "UNAVAILABLE", fifoCostCup: null, profitCup: null, profitUsd: null });
  });

  it("allows and reports losses", () => {
    expect(calculateWireProfit({
      settlementCurrency: "USD",
      settlementAmount: 1_000,
      globalRate: 675,
      selected: selection(1_000, 0, 700_000, 700),
    })).toMatchObject({ status: "EXACT", profitCup: -25_000, profitUsd: -37.04 });
  });
});
