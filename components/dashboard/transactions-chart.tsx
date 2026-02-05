"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { chartData } from "@/lib/mock-data"
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

export function TransactionsChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base md:text-lg font-medium text-foreground">
          Transacciones por Banco
        </CardTitle>
        <p className="text-xs md:text-sm text-muted-foreground">Últimos 7 días</p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-[250px] md:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
