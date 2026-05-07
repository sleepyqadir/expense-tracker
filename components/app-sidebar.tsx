"use client"

import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { LayoutGrid, BarChart3, CreditCard, Banknote, Heart, CalendarRange } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const NAV_ITEMS = [
  { href: "/", icon: LayoutGrid, label: "Dashboard" },
  { href: "/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/history", icon: CalendarRange, label: "History" },
  { href: "/loans", icon: CreditCard, label: "Loans" },
  { href: "/assets", icon: Banknote, label: "Assets" },
  { href: "/zakat", icon: Heart, label: "Zakat" },
]

export function AppSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col justify-between py-6 px-3 w-20 bg-black/85 border-r border-gray-900/80">
        <div className="flex flex-col items-center gap-4">
          {/* User avatar */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => router.push("/")}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-500 shadow-lg"
                aria-label="Dashboard"
              >
                <Avatar className="h-10 w-10 border-2 border-blue-300">
                  <AvatarImage
                    src={session?.user?.image || "/placeholder-user.jpg"}
                    alt={session?.user?.name || "User"}
                  />
                  <AvatarFallback className="text-xs text-white">
                    {session?.user?.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-gray-900 text-gray-100 border-gray-700">
              <p className="text-xs">Dashboard</p>
            </TooltipContent>
          </Tooltip>

          <div className="mt-4 flex flex-col items-center gap-3">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => router.push(item.href)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                        active
                          ? "bg-blue-500 text-white"
                          : "bg-transparent text-gray-400 hover:bg-gray-800/80 hover:text-white"
                      }`}
                      aria-label={item.label}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-gray-900 text-gray-100 border-gray-700">
                    <p className="text-xs">{item.label}</p>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden bg-black/95 border-t border-gray-800/80 backdrop-blur-md safe-area-pb">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 px-1 transition-colors min-h-[56px] ${
                active ? "text-blue-400" : "text-gray-500"
              }`}
              aria-label={item.label}
            >
              <Icon className={`h-5 w-5 ${active ? "text-blue-400" : "text-gray-500"}`} />
              <span className={`text-[9px] font-medium leading-none ${active ? "text-blue-400" : "text-gray-500"}`}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>
    </TooltipProvider>
  )
}

