"use client"

import { cn } from "@/lib/utils"
import { LayoutDashboard, List, PieChart, Settings } from "lucide-react"

interface BottomNavProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

const navItems = [
  { id: "dashboard", label: "Inicio", icon: LayoutDashboard },
  { id: "transactions", label: "Transacc.", icon: List },
  { id: "analytics", label: "Análisis", icon: PieChart },
  { id: "settings", label: "Config.", icon: Settings },
]

export function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "scale-110 transition-transform")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
