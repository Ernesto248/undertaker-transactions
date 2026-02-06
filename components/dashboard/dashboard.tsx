"use client";

import { useState, useMemo } from "react";
import { Header } from "./header";
import { MobileNav } from "./mobile-nav";
import { BottomNav } from "./bottom-nav";
import { DesktopNav } from "./desktop-nav";
import { StatCard } from "./stat-card";
import { TransactionCard } from "./transaction-card";
import { TransactionsChart } from "./transactions-chart";
import { EmailAccountsCard } from "./email-accounts-card";
import { BankDistributionChart } from "./bank-distribution-chart";
import { BankTotalsCard } from "./bank-totals-card";
import { FilterBar, type DateFilter } from "./filter-bar";
import { SettingsView } from "./settings-view";
import { DollarSign, TrendingUp, Calendar } from "lucide-react";
import { Transaction } from "@/lib/types";
import {
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subMonths,
  isWithinInterval,
} from "date-fns";

interface DashboardProps {
  initialTransactions: Transaction[];
}

export function Dashboard({ initialTransactions }: DashboardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [bankFilter, setBankFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined;
    to: Date | undefined;
  }>({ from: undefined, to: undefined });

  const bankOptions = useMemo(() => {
    return Array.from(new Set(initialTransactions.map((t) => t.bank))).sort(
      (a, b) => a.localeCompare(b),
    );
  }, [initialTransactions]);

  const accountOptions = useMemo(() => {
    return Array.from(
      new Set(initialTransactions.map((t) => t.accountName)),
    ).sort((a, b) => a.localeCompare(b));
  }, [initialTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    const today = startOfDay(now);

    return initialTransactions.filter((transaction) => {
      const matchesBank =
        bankFilter === "all" || transaction.bank === bankFilter;
      const matchesAccount =
        accountFilter === "all" || transaction.accountName === accountFilter;
      const matchesSearch =
        searchQuery === "" ||
        transaction.senderName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        transaction.confirmationCode
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      // Date filtering
      let matchesDate = true;
      const transactionDate = new Date(transaction.createdAt);

      if (dateFilter === "today") {
        matchesDate = isWithinInterval(transactionDate, {
          start: today,
          end: endOfDay(now),
        });
      } else if (dateFilter === "yesterday") {
        const yesterday = subDays(today, 1);
        matchesDate = isWithinInterval(transactionDate, {
          start: yesterday,
          end: endOfDay(yesterday),
        });
      } else if (dateFilter === "week") {
        matchesDate = isWithinInterval(transactionDate, {
          start: subWeeks(today, 1),
          end: endOfDay(now),
        });
      } else if (dateFilter === "month") {
        matchesDate = isWithinInterval(transactionDate, {
          start: subMonths(today, 1),
          end: endOfDay(now),
        });
      } else if (dateFilter === "custom" && customDateRange.from) {
        const start = startOfDay(customDateRange.from);
        const end = customDateRange.to
          ? endOfDay(customDateRange.to)
          : endOfDay(now);
        matchesDate = isWithinInterval(transactionDate, { start, end });
      }

      return matchesBank && matchesAccount && matchesSearch && matchesDate;
    });
  }, [
    bankFilter,
    accountFilter,
    searchQuery,
    dateFilter,
    customDateRange,
    initialTransactions,
  ]);

  const baseFilteredTransactions = useMemo(() => {
    return initialTransactions.filter((transaction) => {
      const matchesBank =
        bankFilter === "all" || transaction.bank === bankFilter;
      const matchesAccount =
        accountFilter === "all" || transaction.accountName === accountFilter;
      const matchesSearch =
        searchQuery === "" ||
        transaction.senderName
          .toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        transaction.confirmationCode
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

      return matchesBank && matchesAccount && matchesSearch;
    });
  }, [bankFilter, accountFilter, searchQuery, initialTransactions]);

  const toTrend = (current: number, previous: number) => {
    if (!Number.isFinite(current) || !Number.isFinite(previous))
      return undefined;
    if (previous === 0) return undefined;
    const change = ((current - previous) / previous) * 100;
    const rounded = Math.round(change * 10) / 10;
    const value = Object.is(rounded, -0) ? 0 : rounded;
    return { value, isPositive: value >= 0 };
  };

  // Calculate dynamic stats based on filtered transactions
  const stats = useMemo(() => {
    const totalAmount = filteredTransactions.reduce(
      (acc, t) => acc + t.amount,
      0,
    );
    const avgTransaction =
      filteredTransactions.length > 0
        ? totalAmount / filteredTransactions.length
        : 0;

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const yesterdayStart = subDays(todayStart, 1);
    const yesterdayEnd = endOfDay(yesterdayStart);

    const todayTx = baseFilteredTransactions.filter((t) =>
      isWithinInterval(new Date(t.createdAt), {
        start: todayStart,
        end: todayEnd,
      }),
    );
    const yesterdayTx = baseFilteredTransactions.filter((t) =>
      isWithinInterval(new Date(t.createdAt), {
        start: yesterdayStart,
        end: yesterdayEnd,
      }),
    );

    const todayAmount = todayTx.reduce((acc, t) => acc + t.amount, 0);
    const yesterdayAmount = yesterdayTx.reduce((acc, t) => acc + t.amount, 0);

    return {
      totalTransactions: filteredTransactions.length,
      totalAmount,
      avgTransaction,
      totalAmountTrend: toTrend(todayAmount, yesterdayAmount),
      todayTransactions: todayTx.length,
      todayTransactionsTrend: toTrend(todayTx.length, yesterdayTx.length),
    };
  }, [filteredTransactions, baseFilteredTransactions]);

  const bankTotals = useMemo(() => {
    const totals = new Map<string, number>();
    filteredTransactions.forEach((t) =>
      totals.set(t.bank, (totals.get(t.bank) ?? 0) + t.amount),
    );
    return Array.from(totals.entries())
      .map(([bank, totalAmount]) => ({ bank, totalAmount }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredTransactions]);

  const accountStats = useMemo(() => {
    const accountMap = new Map<
      string,
      { transactionCount: number; totalAmount: number }
    >();

    filteredTransactions.forEach((t) => {
      const current = accountMap.get(t.accountName) || {
        transactionCount: 0,
        totalAmount: 0,
      };
      accountMap.set(t.accountName, {
        transactionCount: current.transactionCount + 1,
        totalAmount: current.totalAmount + t.amount,
      });
    });

    return Array.from(accountMap.entries())
      .map(([accountName, data]) => ({
        accountName,
        ...data,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredTransactions]);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header
        onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
        isMenuOpen={isMenuOpen}
      />
      <MobileNav
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-6">
          <DesktopNav activeTab={activeTab} setActiveTab={setActiveTab} />

          <div className="mt-4 md:mt-6">
            {activeTab === "dashboard" && (
              <div className="space-y-4 md:space-y-6">
                <FilterBar
                  bankFilter={bankFilter}
                  setBankFilter={setBankFilter}
                  bankOptions={bankOptions}
                  accountFilter={accountFilter}
                  setAccountFilter={setAccountFilter}
                  accountOptions={accountOptions}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  customDateRange={customDateRange}
                  setCustomDateRange={setCustomDateRange}
                />

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <StatCard
                    title="Total Recibido"
                    value={formatCurrency(stats.totalAmount)}
                    subtitle={`${stats.totalTransactions} transacciones`}
                    icon={DollarSign}
                    trend={stats.totalAmountTrend}
                  />
                  <StatCard
                    title="Promedio"
                    value={formatCurrency(stats.avgTransaction)}
                    subtitle="por transacción"
                    icon={TrendingUp}
                  />
                  <BankTotalsCard
                    totals={bankTotals}
                    formatCurrency={formatCurrency}
                  />
                  <StatCard
                    title="Hoy"
                    value={stats.todayTransactions.toString()}
                    subtitle="transacciones"
                    icon={Calendar}
                    trend={stats.todayTransactionsTrend}
                  />
                </div>

                <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
                  <div className="lg:col-span-2">
                    <TransactionsChart transactions={filteredTransactions} />
                  </div>
                  <BankDistributionChart transactions={filteredTransactions} />
                </div>

                <div>
                  <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3">
                    Transacciones Recientes
                  </h2>
                  <div className="grid gap-3">
                    {filteredTransactions.slice(0, 5).map((transaction) => (
                      <TransactionCard
                        key={transaction.id}
                        transaction={transaction}
                      />
                    ))}
                    {filteredTransactions.length === 0 && (
                      <div className="text-center py-12">
                        <p className="text-muted-foreground">
                          No se encontraron transacciones
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "transactions" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    Transacciones
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {filteredTransactions.length} de{" "}
                    {initialTransactions.length} transacciones
                  </p>
                </div>

                <FilterBar
                  bankFilter={bankFilter}
                  setBankFilter={setBankFilter}
                  bankOptions={bankOptions}
                  accountFilter={accountFilter}
                  setAccountFilter={setAccountFilter}
                  accountOptions={accountOptions}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  customDateRange={customDateRange}
                  setCustomDateRange={setCustomDateRange}
                />

                <div className="grid gap-3">
                  {filteredTransactions.map((transaction) => (
                    <TransactionCard
                      key={transaction.id}
                      transaction={transaction}
                    />
                  ))}
                  {filteredTransactions.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">
                        No se encontraron transacciones
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "analytics" && (
              <div className="space-y-4 md:space-y-6">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-foreground">
                    Análisis
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Estadísticas detalladas
                  </p>
                </div>

                <FilterBar
                  bankFilter={bankFilter}
                  setBankFilter={setBankFilter}
                  bankOptions={bankOptions}
                  accountFilter={accountFilter}
                  setAccountFilter={setAccountFilter}
                  accountOptions={accountOptions}
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  dateFilter={dateFilter}
                  setDateFilter={setDateFilter}
                  customDateRange={customDateRange}
                  setCustomDateRange={setCustomDateRange}
                />

                <div className="grid gap-4 md:gap-6">
                  <TransactionsChart transactions={filteredTransactions} />
                  <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                    <BankDistributionChart
                      transactions={filteredTransactions}
                    />
                    <EmailAccountsCard stats={accountStats} />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "settings" && (
              <SettingsView accountOptions={accountOptions} />
            )}
          </div>
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  );
}
