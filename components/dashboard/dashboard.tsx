"use client"

import { useState, useMemo } from "react"
import { Header } from "./header"
import { MobileNav } from "./mobile-nav"
import { BottomNav } from "./bottom-nav"
import { StatCard } from "./stat-card"
import { TransactionCard } from "./transaction-card"
import { TransactionsChart } from "./transactions-chart"
import { EmailAccountsCard } from "./email-accounts-card"
import { BankDistributionChart } from "./bank-distribution-chart"
import { FilterBar, type DateFilter } from "./filter-bar"
import { SettingsView } from "./settings-view"
import { mockTransactions } from "@/lib/mock-data"
import { DollarSign, TrendingUp, CreditCard, Calendar } from "lucide-react"
import {
  startOfDay,
  endOfDay,
  subDays,
  subWeeks,
  subMonths,
  isWithinInterval,
} from "date-fns"

export function Dashboard() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [bankFilter, setBankFilter] = useState("all")
  const [emailFilter, setEmailFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFilter, setDateFilter] = useState<DateFilter>("all")
  const [customDateRange, setCustomDateRange] = useState<{
    from: Date | undefined
    to: Date | undefined
  }>({ from: undefined, to: undefined })

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const filteredTransactions = useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)

    return mockTransactions.filter((transaction) => {
      const matchesBank = bankFilter === "all" || transaction.bank === bankFilter
      const matchesEmail = emailFilter === "all" || transaction.emailAccount === emailFilter
      const matchesSearch =
        searchQuery === "" ||
        transaction.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.confirmationCode.toLowerCase().includes(searchQuery.toLowerCase())

      // Date filtering
      let matchesDate = true
      const transactionDate = new Date(transaction.createdAt)

      if (dateFilter === "today") {
        matchesDate = isWithinInterval(transactionDate, {
          start: today,
          end: endOfDay(now),
        })
      } else if (dateFilter === "yesterday") {
        const yesterday = subDays(today, 1)
        matchesDate = isWithinInterval(transactionDate, {
          start: yesterday,
          end: endOfDay(yesterday),
        })
      } else if (dateFilter === "week") {
        matchesDate = isWithinInterval(transactionDate, {
          start: subWeeks(today, 1),
          end: endOfDay(now),
        })
      } else if (dateFilter === "month") {
        matchesDate = isWithinInterval(transactionDate, {
          start: subMonths(today, 1),
          end: endOfDay(now),
        })
      } else if (dateFilter === "custom" && customDateRange.from) {
        const start = startOfDay(customDateRange.from)
        const end = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(now)
        matchesDate = isWithinInterval(transactionDate, { start, end })
      }

      return matchesBank && matchesEmail && matchesSearch && matchesDate
    })
  }, [bankFilter, emailFilter, searchQuery, dateFilter, customDateRange])

  // Calculate dynamic stats based on filtered transactions
  const stats = useMemo(() => {
    const totalAmount = filteredTransactions.reduce((acc, t) => acc + t.amount, 0)
    const wellsFargoTotal = filteredTransactions
      .filter((t) => t.bank === "Wells Fargo")
      .reduce((acc, t) => acc + t.amount, 0)
    const todayTransactions = filteredTransactions.filter((t) =>
      t.createdAt.startsWith("2026-02-05")
    ).length

    return {
      totalTransactions: filteredTransactions.length,
      totalAmount,
      wellsFargoTotal,
      avgTransaction: filteredTransactions.length > 0 ? totalAmount / filteredTransactions.length : 0,
      todayTransactions,
    }
  }, [filteredTransactions])

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsMenuOpen(!isMenuOpen)} isMenuOpen={isMenuOpen} />
      <MobileNav
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <main className="pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto px-4 py-4 md:px-6 md:py-6">
          {activeTab === "dashboard" && (
            <div className="space-y-4 md:space-y-6">
              {/* Filters for Dashboard */}
              <FilterBar
                bankFilter={bankFilter}
                setBankFilter={setBankFilter}
                emailFilter={emailFilter}
                setEmailFilter={setEmailFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                customDateRange={customDateRange}
                setCustomDateRange={setCustomDateRange}
              />

              {/* Stats Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <StatCard
                  title="Total Recibido"
                  value={formatCurrency(stats.totalAmount)}
                  subtitle={`${stats.totalTransactions} transacciones`}
                  icon={DollarSign}
                  trend={{ value: 12.5, isPositive: true }}
                />
                <StatCard
                  title="Promedio"
                  value={formatCurrency(stats.avgTransaction)}
                  subtitle="por transacción"
                  icon={TrendingUp}
                />
                <StatCard
                  title="Wells Fargo"
                  value={formatCurrency(stats.wellsFargoTotal)}
                  icon={CreditCard}
                />
                <StatCard
                  title="Hoy"
                  value={stats.todayTransactions.toString()}
                  subtitle="transacciones"
                  icon={Calendar}
                  trend={{ value: 33, isPositive: true }}
                />
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2">
                  <TransactionsChart transactions={filteredTransactions} />
                </div>
                <BankDistributionChart transactions={filteredTransactions} />
              </div>

              {/* Recent Transactions */}
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3">
                  Transacciones Recientes
                </h2>
                <div className="grid gap-3">
                  {filteredTransactions.slice(0, 5).map((transaction) => (
                    <TransactionCard key={transaction.id} transaction={transaction} />
                  ))}
                  {filteredTransactions.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No se encontraron transacciones</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "transactions" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Transacciones</h2>
                <p className="text-sm text-muted-foreground">
                  {filteredTransactions.length} de {mockTransactions.length} transacciones
                </p>
              </div>

              <FilterBar
                bankFilter={bankFilter}
                setBankFilter={setBankFilter}
                emailFilter={emailFilter}
                setEmailFilter={setEmailFilter}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                dateFilter={dateFilter}
                setDateFilter={setDateFilter}
                customDateRange={customDateRange}
                setCustomDateRange={setCustomDateRange}
              />

              <div className="grid gap-3">
                {filteredTransactions.map((transaction) => (
                  <TransactionCard key={transaction.id} transaction={transaction} />
                ))}
                {filteredTransactions.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No se encontraron transacciones</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "analytics" && (
            <div className="space-y-4 md:space-y-6">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-foreground">Análisis</h2>
                <p className="text-sm text-muted-foreground">Estadísticas detalladas</p>
              </div>

              <FilterBar
                bankFilter={bankFilter}
                setBankFilter={setBankFilter}
                emailFilter={emailFilter}
                setEmailFilter={setEmailFilter}
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
                  <BankDistributionChart transactions={filteredTransactions} />
                  <EmailAccountsCard />
                </div>
              </div>
            </div>
          )}

          {activeTab === "settings" && <SettingsView />}
        </div>
      </main>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}
