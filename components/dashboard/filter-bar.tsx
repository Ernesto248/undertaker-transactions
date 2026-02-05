"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, SlidersHorizontal } from "lucide-react"

interface FilterBarProps {
  bankFilter: string
  setBankFilter: (value: string) => void
  emailFilter: string
  setEmailFilter: (value: string) => void
  searchQuery: string
  setSearchQuery: (value: string) => void
}

export function FilterBar({
  bankFilter,
  setBankFilter,
  emailFilter,
  setEmailFilter,
  searchQuery,
  setSearchQuery,
}: FilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Filtros</span>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-full sm:w-[180px] bg-secondary border-border text-foreground">
            <SelectValue placeholder="Banco" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todos los bancos</SelectItem>
            <SelectItem value="Wells Fargo">Wells Fargo</SelectItem>
            <SelectItem value="Bank of America">Bank of America</SelectItem>
          </SelectContent>
        </Select>
        <Select value={emailFilter} onValueChange={setEmailFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-secondary border-border text-foreground">
            <SelectValue placeholder="Cuenta email" />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Todas las cuentas</SelectItem>
            <SelectItem value="personal@gmail.com">personal@gmail.com</SelectItem>
            <SelectItem value="business@gmail.com">business@gmail.com</SelectItem>
            <SelectItem value="work@gmail.com">work@gmail.com</SelectItem>
          </SelectContent>
        </Select>
        {(bankFilter !== "all" || emailFilter !== "all" || searchQuery) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBankFilter("all")
              setEmailFilter("all")
              setSearchQuery("")
            }}
            className="bg-transparent border-border text-muted-foreground hover:text-foreground"
          >
            Limpiar
          </Button>
        )}
      </div>
    </div>
  )
}
