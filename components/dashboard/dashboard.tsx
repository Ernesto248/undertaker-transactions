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
import { FilterBar } from "./filter-bar"
import { SettingsView } from "./settings-view"
import { mockTransactions, stats } from "@/lib/mock-data"
import { DollarSign, TrendingUp, CreditCard, Calendar } from "lucide-react"

export function Dashboard() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("dashboard")
  const [bankFilter, setBankFilter] = useState("all")
  const [emailFilter, setEmailFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const filteredTransactions = useMemo(() => {
    return mockTransactions.filter((transaction) => {
      const matchesBank = bankFilter === "all" || transaction.bank === bankFilter
      const matchesEmail = emailFilter === "all" || transaction.emailAccount === emailFilter
      const matchesSearch =
        searchQuery === "" ||
        transaction.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        transaction.confirmationCode.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesBank && matchesEmail && matchesSearch
    })
  }, [bankFilter, emailFilter, searchQuery])

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
                  <TransactionsChart />
                </div>
                <BankDistributionChart />
              </div>

              {/* Recent Transactions */}
              <div>
                <h2 className="text-lg md:text-xl font-semibold text-foreground mb-3">
                  Transacciones Recientes
                </h2>
                <div className="grid gap-3">
                  {mockTransactions.slice(0, 5).map((transaction) => (
                    <TransactionCard key={transaction.id} transaction={transaction} />
                  ))}
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

              <div className="grid gap-4 md:gap-6">
                <TransactionsChart />
                <div className="grid md:grid-cols-2 gap-4 md:gap-6">
                  <BankDistributionChart />
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
