"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { stats, emailAccounts } from "@/lib/mock-data"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Building2, Mail } from "lucide-react"

type ViewMode = "bank" | "email"

const bankData = [
  { name: "Wells Fargo", value: stats.wellsFargoTotal, color: "hsl(38, 92%, 50%)" },
  { name: "Bank of America", value: stats.bankOfAmericaTotal, color: "hsl(199, 89%, 48%)" },
]

const emailData = emailAccounts.map((account, index) => ({
  name: account.email,
  value: account.totalAmount,
  color: index === 0 ? "hsl(142, 71%, 45%)" : index === 1 ? "hsl(270, 70%, 60%)" : "hsl(340, 75%, 55%)",
}))

export function BankDistributionChart() {
  const [viewMode, setViewMode] = useState<ViewMode>("bank")

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
              <span className="hidden sm:inline">Banco</span>
            </Button>
            <Button
              variant={viewMode === "email" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("email")}
              className="h-7 px-2 text-xs gap-1"
            >
              <Mail className="h-3 w-3" />
              <span className="hidden sm:inline">Email</span>
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
