"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Transaction } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Copy, Check } from "lucide-react"
import { useState } from "react"

interface TransactionCardProps {
  transaction: Transaction
}

const bankColors: Record<string, string> = {
  "Wells Fargo": "bg-[hsl(var(--warning))]/10 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/20",
  "Bank of America": "bg-destructive/10 text-destructive border-destructive/20",
}

const typeIcons = {
  deposit: ArrowDownLeft,
  withdrawal: ArrowUpRight,
  transfer: ArrowLeftRight,
}

const typeColors = {
  deposit: "text-[hsl(var(--success))]",
  withdrawal: "text-destructive",
  transfer: "text-primary",
}

export function TransactionCard({ transaction }: TransactionCardProps) {
  const [copied, setCopied] = useState(false)
  const TypeIcon = typeIcons[transaction.type]

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Toronto",
    }).format(date)
  }

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount)
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(transaction.confirmationCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="bg-card border-border hover:bg-secondary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-full bg-secondary", typeColors[transaction.type])}>
            <TypeIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{transaction.senderName}</p>
                <p className="text-xs text-muted-foreground truncate">{transaction.accountName}</p>
              </div>
              <p className={cn("text-base md:text-lg font-semibold shrink-0", typeColors[transaction.type])}>
                {transaction.type === "withdrawal" ? "-" : "+"}{formatAmount(transaction.amount)}
              </p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px] md:text-xs", bankColors[transaction.bank])}>
                {transaction.bank}
              </Badge>
              <button
                type="button"
                onClick={copyToClipboard}
                className="flex items-center gap-1 max-w-full min-w-0 overflow-hidden text-[10px] md:text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-[hsl(var(--success))]" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                <span
                  className="font-mono truncate inline-block max-w-[150px] sm:max-w-[220px] md:max-w-none"
                  title={transaction.confirmationCode}
                >
                  {transaction.confirmationCode}
                </span>
              </button>
            </div>
            <p className="mt-2 text-[10px] md:text-xs text-muted-foreground">
              {formatDate(transaction.createdAt)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
