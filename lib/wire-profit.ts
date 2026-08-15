import { roundMoney } from "@/lib/finance-ledger";
import type {
  FinanceCurrency,
  WireProfitSnapshot,
  ZelleValuationSummary,
} from "@/lib/types";

type CalculateWireProfitInput = {
  principalUsd: number;
  settlementCurrency: FinanceCurrency;
  settlementAmount: number;
  globalRate: number;
  ownerFeePercent: number;
  selected: ZelleValuationSummary;
};

export function calculateWireProfit({
  principalUsd,
  settlementCurrency,
  settlementAmount,
  globalRate,
  ownerFeePercent,
  selected,
}: CalculateWireProfitInput): WireProfitSnapshot {
  const ownerFeeAmount = roundMoney(
    (settlementCurrency === "CUP" ? settlementAmount : principalUsd)
      * ownerFeePercent / 100,
  );
  const ownerFeeCup = roundMoney(
    settlementCurrency === "CUP" ? ownerFeeAmount : ownerFeeAmount * globalRate,
  );
  const ownerFeeUsd = roundMoney(
    settlementCurrency === "USD" ? ownerFeeAmount : ownerFeeAmount / globalRate,
  );

  if (selected.pricedUsd <= 0 || selected.averagePrice == null) {
    return {
      status: "UNAVAILABLE",
      globalRate: roundMoney(globalRate),
      settlementAmount: roundMoney(settlementAmount),
      fifoCostCup: null,
      profitCup: null,
      profitUsd: null,
      ownerFeePercent: roundMoney(ownerFeePercent),
      ownerFeeAmount,
      ownerFeeCup,
      ownerFeeUsd,
      netProfitCup: null,
      netProfitUsd: null,
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
  const netProfitCup = roundMoney(profitCup - ownerFeeCup);

  return {
    status,
    globalRate: roundMoney(globalRate),
    settlementAmount: roundMoney(settlementAmount),
    fifoCostCup,
    profitCup,
    profitUsd: roundMoney(profitCup / globalRate),
    ownerFeePercent: roundMoney(ownerFeePercent),
    ownerFeeAmount,
    ownerFeeCup,
    ownerFeeUsd,
    netProfitCup,
    netProfitUsd: roundMoney(netProfitCup / globalRate),
  };
}
