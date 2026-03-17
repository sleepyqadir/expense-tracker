"use client"

import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { ArrowLeft, Wallet, BarChart3, CreditCard, PiggyBank, Heart, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type AppHeaderProps = {
  showBackButton?: boolean
  displayCurrency: "USD" | "PKR"
  onCurrencyChange: (currency: "USD" | "PKR") => void
  rightActions?: React.ReactNode
}

export function AppHeader({
  showBackButton = false,
  displayCurrency,
  onCurrencyChange,
  rightActions,
}: AppHeaderProps) {
  const router = useRouter()
  const { data: session } = useSession()

  return (
    <header className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-md border-b border-gray-700/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="text-white hover:bg-gray-700/50 shrink-0"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <Wallet className="h-6 w-6 text-white" />
            <h1 className="text-xl font-semibold text-white">Expense Tracker</h1>
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-gray-800/60 border border-gray-600/50">
            <span
              className={`text-xs font-medium transition-colors ${
                displayCurrency === "USD" ? "text-white" : "text-gray-400"
              }`}
            >
              USD
            </span>
            <Switch
              checked={displayCurrency === "PKR"}
              onCheckedChange={(checked) => onCurrencyChange(checked ? "PKR" : "USD")}
              className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-600"
            />
            <span
              className={`text-xs font-medium transition-colors ${
                displayCurrency === "PKR" ? "text-white" : "text-gray-400"
              }`}
            >
              PKR
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/analytics")}
            className="rounded-full gap-1 text-white hover:bg-gray-700/50"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/loans")}
            className="rounded-full gap-1 text-white hover:bg-gray-700/50"
          >
            <CreditCard className="h-4 w-4" />
            <span className="hidden sm:inline">Loans</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/assets")}
            className="rounded-full gap-1 text-white hover:bg-gray-700/50"
          >
            <PiggyBank className="h-4 w-4" />
            <span className="hidden sm:inline">Assets</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/zakat")}
            className="rounded-full gap-1 text-white hover:bg-gray-700/50"
          >
            <Heart className="h-4 w-4" />
            <span className="hidden sm:inline">Zakat</span>
          </Button>
          {rightActions}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Avatar className="h-9 w-9 border-2 border-gray-600 bg-gray-700">
                  <AvatarImage
                    src={session?.user?.image || "/placeholder-user.jpg"}
                    alt={session?.user?.name || "User"}
                  />
                  <AvatarFallback className="text-white">
                    {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700/50 w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-white">{session?.user?.name || "User"}</p>
                <p className="text-xs text-gray-400 truncate">{session?.user?.email}</p>
              </div>
              <DropdownMenuItem
                className="text-red-400 focus:text-red-300 focus:bg-red-500/10 cursor-pointer"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
