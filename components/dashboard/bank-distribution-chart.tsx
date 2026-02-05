"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { stats } from "@/lib/mock-data"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

const data = [
  { name: "Wells Fargo", value: stats.wellsFargoTotal, color: "hsl(38, 92%, 50%)" },
  { name: "Bank of America", value: stats.bankOfAmericaTotal, color: "hsl(199, 89%, 48%)" },
]

export function BankDistributionChart() {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg font-medium text-foreground">
          Distribución por Banco
        </CardTitle>
        <p className="text-xs md:text-sm text-muted-foreground">Total acumulado</p>
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
                  <span style={{ color: "hsl(220, 10%, 55%)", fontSize: "12px" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          {data.map((bank) => (
            <div key={bank.name} className="text-center">
              <p className="text-xs text-muted-foreground">{bank.name}</p>
              <p className="text-sm font-semibold text-foreground">{formatAmount(bank.value)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
