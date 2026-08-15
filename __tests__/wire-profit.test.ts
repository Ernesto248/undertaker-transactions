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
      principalUsd: 10_000,
      settlementCurrency: "CUP",
      settlementAmount: 7_000_000,
      globalRate: 675,
      ownerFeePercent: 2,
      selected: selection(10_025, 0, 6_817_000, 680),
    })).toEqual({
      status: "EXACT",
      globalRate: 675,
      settlementAmount: 7_000_000,
      fifoCostCup: 6_817_000,
      profitCup: 183_000,
      profitUsd: 271.11,
      ownerFeePercent: 2,
      ownerFeeAmount: 140_000,
      ownerFeeCup: 140_000,
      ownerFeeUsd: 207.41,
      netProfitCup: 43_000,
      netProfitUsd: 63.7,
    });
  });

  it("estimates the unpriced portion with the priced average", () => {
    expect(calculateWireProfit({
      principalUsd: 1_000,
      settlementCurrency: "CUP",
      settlementAmount: 700_000,
      globalRate: 675,
      ownerFeePercent: 2,
      selected: selection(800, 200, 544_000, 680),
    })).toMatchObject({ status: "ESTIMATED", fifoCostCup: 680_000, profitCup: 20_000 });
  });

  it("leaves profit unavailable when the whole debit is unpriced", () => {
    expect(calculateWireProfit({
      principalUsd: 1_000,
      settlementCurrency: "USD",
      settlementAmount: 1_050,
      globalRate: 675,
      ownerFeePercent: 2,
      selected: selection(0, 1_000, 0, null),
    })).toMatchObject({ status: "UNAVAILABLE", fifoCostCup: null, profitCup: null, profitUsd: null });
  });

  it("allows and reports losses", () => {
    expect(calculateWireProfit({
      principalUsd: 1_000,
      settlementCurrency: "USD",
      settlementAmount: 1_000,
      globalRate: 675,
      ownerFeePercent: 2,
      selected: selection(1_000, 0, 700_000, 700),
    })).toMatchObject({ status: "EXACT", profitCup: -25_000, profitUsd: -37.04 });
  });

  it("calculates the owner fee on USD principal, excluding client surcharge", () => {
    expect(calculateWireProfit({
      principalUsd: 10_000,
      settlementCurrency: "USD",
      settlementAmount: 10_500,
      globalRate: 675,
      ownerFeePercent: 2,
      selected: selection(10_000, 0, 6_800_000, 680),
    })).toMatchObject({
      ownerFeeAmount: 200,
      ownerFeeUsd: 200,
      ownerFeeCup: 135_000,
      profitCup: 287_500,
      netProfitCup: 152_500,
      netProfitUsd: 225.93,
    });
  });
});
