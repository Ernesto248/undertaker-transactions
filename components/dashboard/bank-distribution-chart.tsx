"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Transaction } from "@/lib/mock-data"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Building2, Mail } from "lucide-react"

type ViewMode = "bank" | "email"

interface BankDistributionChartProps {
  transactions: Transaction[]
}

export function BankDistributionChart({ transactions }: BankDistributionChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("bank")

  const bankData = useMemo(() => {
    const wellsFargoTotal = transactions
      .filter((t) => t.bank === "Wells Fargo")
      .reduce((sum, t) => sum + t.amount, 0)

    const bankOfAmericaTotal = transactions
      .filter((t) => t.bank === "Bank of America")
      .reduce((sum, t) => sum + t.amount, 0)

    return [
      { name: "Wells Fargo", value: wellsFargoTotal, color: "hsl(38, 92%, 50%)" },
      { name: "Bank of America", value: bankOfAmericaTotal, color: "hsl(199, 89%, 48%)" },
    ]
  }, [transactions])

  const emailData = useMemo(() => {
    const personalTotal = transactions
      .filter((t) => t.emailAccount === "personal@gmail.com")
      .reduce((sum, t) => sum + t.amount, 0)

    const businessTotal = transactions
      .filter((t) => t.emailAccount === "business@gmail.com")
      .reduce((sum, t) => sum + t.amount, 0)

    const workTotal = transactions
      .filter((t) => t.emailAccount === "work@gmail.com")
      .reduce((sum, t) => sum + t.amount, 0)

    return [
      { name: "personal@gmail.com", value: personalTotal, color: "hsl(142, 71%, 45%)" },
      { name: "business@gmail.com", value: businessTotal, color: "hsl(270, 70%, 60%)" },
      { name: "work@gmail.com", value: workTotal, color: "hsl(340, 75%, 55%)" },
    ]
  }, [transactions])

  const data = viewMode === "bank" ? bankData : emailData

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base md:text-lg font-medium text-foreground">
              {viewMode === "bank" ? "Distribución por Banco" : "Distribución por Email"}
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground">Total acumulado</p>
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
      <CardContent>
        <div className="h-[200px] md:h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(220, 15%, 8%)",
                  border: "1px solid hsl(220, 15%, 18%)",
                  borderRadius: "8px",
                  color: "hsl(0, 0%, 98%)",
                }}
                formatter={(value: number) => [formatAmount(value), "Total"]}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: "hsl(220, 10%, 55%)", fontSize: "11px" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className={`mt-4 grid gap-4 ${viewMode === "bank" ? "grid-cols-2" : "grid-cols-3"}`}>
          {data.map((item) => (
            <div key={item.name} className="text-center">
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{item.name}</p>
              <p className="text-xs sm:text-sm font-semibold text-foreground">{formatAmount(item.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
