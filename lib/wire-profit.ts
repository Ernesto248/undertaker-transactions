import { roundMoney } from "@/lib/finance-ledger";
import type {
  FinanceCurrency,
  WireProfitSnapshot,
  ZelleValuationSummary,
} from "@/lib/types";

type CalculateWireProfitInput = {
  settlementCurrency: FinanceCurrency;
  settlementAmount: number;
  globalRate: number;
  selected: ZelleValuationSummary;
};

export function calculateWireProfit({
  settlementCurrency,
  settlementAmount,
  globalRate,
  selected,
}: CalculateWireProfitInput): WireProfitSnapshot {
  if (selected.pricedUsd <= 0 || selected.averagePrice == null) {
    return {
      status: "UNAVAILABLE",
      globalRate: roundMoney(globalRate),
      settlementAmount: roundMoney(settlementAmount),
      fifoCostCup: null,
      profitCup: null,
      profitUsd: null,
    };
  }

  const status = selected.unpricedUsd > 0 ? "ESTIMATED" : "EXACT";
  const fifoCostCup = roundMoney(
    selected.costCup + selected.unpricedUsd * selected.averagePrice,
  );
  const settlementCup = settlementCurrency === "CUP"
    ? settlementAmount
    : settlementAmount * globalRate;
  const profitCup = roundMoney(settlementCup - fifoCostCup);

  return {
    status,
    globalRate: roundMoney(globalRate),
    settlementAmount: roundMoney(settlementAmount),
    fifoCostCup,
    profitCup,
    profitUsd: roundMoney(profitCup / globalRate),
  };
}
