"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Transaction } from "@/lib/mock-data"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Building2, Mail } from "lucide-react"
import { format, parseISO, startOfDay, eachDayOfInterval, subDays } from "date-fns"
import { es } from "date-fns/locale"

type ViewMode = "bank" | "email"

interface TransactionsChartProps {
  transactions: Transaction[]
}

export function TransactionsChart({ transactions }: TransactionsChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("bank")

  const chartDataByBank = useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, 6)
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    return days.map((day) => {
      const dayStart = startOfDay(day)
      const dayTransactions = transactions.filter((t) => {
        const txDate = startOfDay(parseISO(t.createdAt))
        return txDate.getTime() === dayStart.getTime()
      })

      const wellsFargo = dayTransactions
        .filter((t) => t.bank === "Wells Fargo")
        .reduce((sum, t) => sum + t.amount, 0)

      const bankOfAmerica = dayTransactions
        .filter((t) => t.bank === "Bank of America")
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        date: format(day, "dd MMM", { locale: es }),
        wellsFargo,
        bankOfAmerica,
      }
    })
  }, [transactions])

  const chartDataByEmail = useMemo(() => {
    const endDate = new Date()
    const startDate = subDays(endDate, 6)
    const days = eachDayOfInterval({ start: startDate, end: endDate })

    return days.map((day) => {
      const dayStart = startOfDay(day)
      const dayTransactions = transactions.filter((t) => {
        const txDate = startOfDay(parseISO(t.createdAt))
        return txDate.getTime() === dayStart.getTime()
      })

      const personal = dayTransactions
        .filter((t) => t.emailAccount === "personal@gmail.com")
        .reduce((sum, t) => sum + t.amount, 0)

      const business = dayTransactions
        .filter((t) => t.emailAccount === "business@gmail.com")
        .reduce((sum, t) => sum + t.amount, 0)

      const work = dayTransactions
        .filter((t) => t.emailAccount === "work@gmail.com")
        .reduce((sum, t) => sum + t.amount, 0)

      return {
        date: format(day, "dd MMM", { locale: es }),
        personal,
        business,
        work,
      }
    })
  }, [transactions])

  const chartData = viewMode === "bank" ? chartDataByBank : chartDataByEmail

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base md:text-lg font-medium text-foreground">
              {viewMode === "bank" ? "Transacciones por Banco" : "Transacciones por Email"}
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground">Últimos 7 días</p>
          </div>
          <div className="flex gap-1 p-1 bg-secondary rounded-lg">
            <Button
              variant={viewMode === "bank" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("bank")}
              className="h-7 px-2 text-xs gap-1"
            >
              <Building2 className="h-3 w-3" />
              <span>Banco</span>
            </Button>
            <Button
              variant={viewMode === "email" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("email")}
              className="h-7 px-2 text-xs gap-1"
            >
              <Mail className="h-3 w-3" />
              <span>Email</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[250px] md:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {viewMode === "bank" ? (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="wellsFargoGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="boaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(199, 89%, 48%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220, 15%, 8%)",
                    border: "1px solid hsl(220, 15%, 18%)",
                    borderRadius: "8px",
                    color: "hsl(0, 0%, 98%)",
                  }}
                  labelStyle={{ color: "hsl(0, 0%, 98%)" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span style={{ color: "hsl(220, 10%, 55%)", fontSize: "12px" }}>
                      {value === "wellsFargo" ? "Wells Fargo" : "Bank of America"}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="wellsFargo"
                  stroke="hsl(38, 92%, 50%)"
                  strokeWidth={2}
                  fill="url(#wellsFargoGradient)"
                  name="wellsFargo"
                />
                <Area
                  type="monotone"
                  dataKey="bankOfAmerica"
                  stroke="hsl(199, 89%, 48%)"
                  strokeWidth={2}
                  fill="url(#boaGradient)"
                  name="bankOfAmerica"
                />
              </AreaChart>
            ) : (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="personalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="businessGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(270, 70%, 60%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="workGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(340, 75%, 55%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(340, 75%, 55%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" vertical={false} />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(220, 10%, 55%)", fontSize: 11 }}
                  tickFormatter={(value) => `$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(220, 15%, 8%)",
                    border: "1px solid hsl(220, 15%, 18%)",
                    borderRadius: "8px",
                    color: "hsl(0, 0%, 98%)",
                  }}
                  labelStyle={{ color: "hsl(0, 0%, 98%)" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, ""]}
                />
                <Legend
                  wrapperStyle={{ paddingTop: "20px" }}
                  formatter={(value) => (
                    <span style={{ color: "hsl(220, 10%, 55%)", fontSize: "12px" }}>
                      {value === "personal" ? "personal@gmail.com" : value === "business" ? "business@gmail.com" : "work@gmail.com"}
                    </span>
                  )}
                />
                <Area
                  type="monotone"
                  dataKey="personal"
                  stroke="hsl(142, 71%, 45%)"
                  strokeWidth={2}
                  fill="url(#personalGradient)"
                  name="personal"
                />
                <Area
                  type="monotone"
                  dataKey="business"
                  stroke="hsl(270, 70%, 60%)"
                  strokeWidth={2}
                  fill="url(#businessGradient)"
                  name="business"
                />
                <Area
                  type="monotone"
                  dataKey="work"
                  stroke="hsl(340, 75%, 55%)"
                  strokeWidth={2}
                  fill="url(#workGradient)"
                  name="work"
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
