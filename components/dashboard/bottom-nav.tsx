"use client"

import { cn } from "@/lib/utils"
import { LayoutDashboard, List, PieChart, Settings } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

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
  const [bottomOffsetPx, setBottomOffsetPx] = useState(0)

  useEffect(() => {
    const update = () => {
      const layoutHeight = document.documentElement.clientHeight
      const visualHeight = window.innerHeight
      setBottomOffsetPx(Math.max(0, layoutHeight - visualHeight))
    }

    update()

    window.addEventListener("resize", update)
    window.addEventListener("orientationchange", update)

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", update)
      window.visualViewport.addEventListener("scroll", update)
    }

    return () => {
      window.removeEventListener("resize", update)
      window.removeEventListener("orientationchange", update)
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", update)
        window.visualViewport.removeEventListener("scroll", update)
      }
    }
  }, [])

  const navStyle = useMemo(() => ({ bottom: `${bottomOffsetPx}px` }), [bottomOffsetPx])

  return (
    <nav
      className="fixed inset-x-0 z-50 bg-card/95 backdrop-blur-lg border-t border-border md:hidden pb-[env(safe-area-inset-bottom)]"
      style={navStyle}
    >
      <div className="flex items-center justify-around px-2 py-2">
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
