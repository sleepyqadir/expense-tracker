"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  MoreHorizontal,
  CreditCard,
  Home,
  ShoppingBag,
  Car,
  Film,
  Utensils,
  Zap,
  User,
  X,
  Heart,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { LoadingScreen } from "@/components/loading-screen"
import { useToast } from "@/hooks/use-toast"

type Expense = {
  id: string
  amount: number
  currency: "USD" | "PKR"
  description: string
  category: string
  date: string
  person: string
}

type Category = {
  name: string
  color: string
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className: string }>> = {
  Food: Utensils,
  Transport: Car,
  Shopping: ShoppingBag,
  Bills: Zap,
  Entertainment: Film,
  Medical: Heart,
  Other: Home,
}

const USD_TO_PKR = 280

export default function HistoryPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "PKR">("PKR")
  const [isLoading, setIsLoading] = useState(true)
  const hasLoadedRef = useRef(false)

  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterPerson, setFilterPerson] = useState("All")
  const [activeTab, setActiveTab] = useState("all")

  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null)

  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}))
      if (errorData.requiresAuth) {
        toast({
          title: "Session expired",
          description: "Please sign in with Google again to view your history.",
        })
        router.push("/login")
        return true
      }
    }
    return false
  }

  useEffect(() => {
    if (session === null) router.push("/login")
  }, [session, router])

  useEffect(() => {
    if (!session || hasLoadedRef.current) return

    const loadData = async () => {
      try {
        setIsLoading(true)

        const expensesRes = await fetch("/api/drive/expenses")
        if (await handleApiError(expensesRes)) return
        if (expensesRes.ok) {
          const data = await expensesRes.json()
          if (data.data && data.data.length > 0) {
            setExpenses(data.data)
          }
        }

        const categoriesRes = await fetch("/api/drive/categories")
        if (await handleApiError(categoriesRes)) return
        if (categoriesRes.ok) {
          const catData = await categoriesRes.json()
          if (catData.data && catData.data.length > 0) {
            setCategories(catData.data)
          }
        }
      } catch (error) {
        console.error("Error loading history data:", error)
      } finally {
        setIsLoading(false)
        hasLoadedRef.current = true
      }
    }

    loadData()
  }, [session, router])

  const convertToDisplayCurrency = (amount: number, expenseCurrency: "USD" | "PKR") => {
    if (displayCurrency === expenseCurrency) return amount
    if (displayCurrency === "PKR" && expenseCurrency === "USD") return amount * USD_TO_PKR
    if (displayCurrency === "USD" && expenseCurrency === "PKR") return amount / USD_TO_PKR
    return amount
  }

  const formatCurrency = (amount: number) => {
    const symbol = displayCurrency === "USD" ? "$" : "₨"
    return `${symbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`
  }

  const formatMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`

  const allMonthKeys = Array.from(
    new Set(
      expenses.map((e) => {
        const d = new Date(e.date)
        return formatMonthKey(d)
      })
    )
  ).sort((a, b) => (a < b ? 1 : -1))

  const initialKey = (() => {
    const now = new Date()
    const currentKey = formatMonthKey(now)
    if (allMonthKeys.includes(currentKey)) return currentKey
    return allMonthKeys[0] || currentKey
  })()

  const monthKey = selectedMonthKey || initialKey
  const [yearStr, monthStr] = monthKey.split("-")
  const selectedYear = Number(yearStr)
  const selectedMonthIndex = Number(monthStr) - 1

  const expensesInMonth = expenses.filter((expense) => {
    const d = new Date(expense.date)
    return d.getFullYear() === selectedYear && d.getMonth() === selectedMonthIndex
  })

  const uniquePeople = Array.from(
    new Set(
      expensesInMonth
        .map((expense) => expense.person || "No-one")
        .filter((person) => person !== "No-one")
    )
  ).sort()

  const filteredExpenses = expensesInMonth.filter((expense) => {
    const matchesSearch = expense.description
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
    const matchesCategory =
      filterCategory === "All" || expense.category === filterCategory
    const matchesPerson =
      filterPerson === "All" ||
      (filterPerson === "No-one" &&
        (!expense.person || expense.person === "No-one")) ||
      (filterPerson !== "No-one" && expense.person === filterPerson)

    const expenseDate = new Date(expense.date)
    expenseDate.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isToday = expenseDate.getTime() === today.getTime()

    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const isThisWeek = expenseDate >= startOfWeek && expenseDate <= today

    const isThisMonth =
      expenseDate.getMonth() === today.getMonth() &&
      expenseDate.getFullYear() === today.getFullYear()

    let matchesTab = true
    if (activeTab === "today") matchesTab = isToday
    else if (activeTab === "week") matchesTab = isThisWeek
    else if (activeTab === "month") matchesTab = isThisMonth

    return matchesSearch && matchesCategory && matchesPerson && matchesTab
  })

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    return dateB - dateA
  })

  const expensesByCategory = categories
    .map((category) => {
      const total = expensesInMonth
        .filter((expense) => expense.category === category.name)
        .reduce(
          (sum, expense) =>
            sum + convertToDisplayCurrency(expense.amount, expense.currency),
          0
        )
      return {
        ...category,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  const totalMonthAmount = expensesByCategory.reduce(
    (sum, c) => sum + c.total,
    0
  )

  const monthOptions = allMonthKeys.map((key) => {
    const [y, m] = key.split("-")
    const d = new Date(Number(y), Number(m) - 1, 1)
    const label = d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    })
    return { key, label }
  })

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  const groupedExpenses = sortedExpenses.reduce(
    (groups: { dateLabel: string; items: Expense[] }[], expense) => {
      const dateLabel = formatDate(expense.date)
      const existing = groups.find((g) => g.dateLabel === dateLabel)
      if (existing) {
        existing.items.push(expense)
      } else {
        groups.push({ dateLabel, items: [expense] })
      }
      return groups
    },
    []
  )

  const getCategoryIconComponent = (categoryName: string) => {
    const IconComponent = CATEGORY_ICONS[categoryName] || CreditCard
    return <IconComponent className="h-4 w-4" />
  }

  const getCategoryColor = (categoryName: string) => {
    const category = categories.find((c) => c.name === categoryName)
    return category ? category.color : "bg-gray-500/80"
  }

  if (isLoading) {
    return (
      <LoadingScreen
        message="Loading history..."
        gradientClass="bg-gradient-neon"
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-neon flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Monthly Overview</h1>
              <p className="text-gray-400 mt-1">
                Explore category distribution and expenses for any month
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-gray-950/80 border border-gray-800/80">
                <span
                  className={`text-xs font-medium transition-colors ${
                    displayCurrency === "USD" ? "text-white" : "text-gray-400"
                  }`}
                >
                  USD
                </span>
                <Switch
                  checked={displayCurrency === "PKR"}
                  onCheckedChange={(checked) =>
                    setDisplayCurrency(checked ? "PKR" : "USD")
                  }
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
              <Select
                value={monthKey}
                onValueChange={(v) => {
                  setSelectedMonthKey(v)
                }}
              >
                <SelectTrigger className="w-full sm:w-[210px] h-9 bg-gray-900/80 border-gray-800 text-white">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-800 text-white">
                  {monthOptions.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Expense Distribution & Categories */}
          <Card className="bg-gray-800/60 border border-gray-700/60 backdrop-blur-xl shadow-xl mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">
                  Expense Distribution &amp; Categories
                </CardTitle>
                <div className="text-sm text-gray-400">
                  Total: {formatCurrency(totalMonthAmount)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {expensesByCategory
                  .filter((c) => c.total > 0)
                  .map((category) => (
                    <div
                      key={category.name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-gray-700/30 hover:bg-gray-700/50 transition-colors border border-gray-600/20 hover:border-gray-600/40"
                    >
                      <div
                        className={`w-10 h-10 rounded-full ${category.color} flex items-center justify-center text-white shadow-lg`}
                      >
                        {getCategoryIconComponent(category.name)}
                      </div>
                      <div>
                        <div className="font-medium text-white">
                          {category.name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {formatCurrency(category.total)}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {totalMonthAmount > 0
                            ? `${Math.round(
                                (category.total / totalMonthAmount) * 100
                              )}% of month`
                            : "No spending this month"}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {categories.length > 6 && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <div className="text-sm font-medium text-gray-300 mb-3">
                    All Categories
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {categories.map((category) => (
                      <div
                        key={category.name}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-700/50 border border-gray-600/40"
                      >
                        <span className="text-sm text-gray-300">
                          {category.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Expenses for selected month */}
          <Card className="bg-gray-800/60 border border-gray-700/60 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-lg text-white">
                    Recent Expenses
                  </CardTitle>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="inline-flex w-full bg-gray-800/70 border border-gray-700/70 rounded-full p-0.5">
                      <TabsTrigger
                        value="all"
                        className="rounded-full px-4 py-1 text-xs sm:text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                      >
                        All
                      </TabsTrigger>
                      <TabsTrigger
                        value="today"
                        className="rounded-full px-4 py-1 text-xs sm:text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                      >
                        Today
                      </TabsTrigger>
                      <TabsTrigger
                        value="week"
                        className="rounded-full px-4 py-1 text-xs sm:text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                      >
                        This Week
                      </TabsTrigger>
                      <TabsTrigger
                        value="month"
                        className="rounded-full px-4 py-1 text-xs sm:text-sm data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                      >
                        This Month
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Search expenses..."
                      className="w-full sm:w-[200px] pl-8 h-9 bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                  <Select
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                  >
                    <SelectTrigger className="flex-1 sm:w-[130px] h-9 bg-gray-700/60 border-gray-600/50 text-white">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700/50">
                      <SelectItem value="All">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          <div className="flex items-center">
                            <div
                              className={`w-3 h-3 rounded-full ${category.color} mr-2`}
                            ></div>
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={filterPerson}
                    onValueChange={setFilterPerson}
                  >
                    <SelectTrigger className="flex-1 sm:w-[130px] h-9 bg-gray-700/60 border-gray-600/50 text-white">
                      <SelectValue placeholder="Person" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700/50">
                      <SelectItem value="All">All People</SelectItem>
                      <SelectItem value="No-one">No-one (General)</SelectItem>
                      {uniquePeople.map((person) => (
                        <SelectItem key={person} value={person}>
                          {person}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div>
                {sortedExpenses.length > 0 ? (
                  groupedExpenses.map((group) => (
                    <div
                      key={group.dateLabel}
                      className="border-b border-gray-800/60 last:border-b-0"
                    >
                      <div className="px-5 pt-4 pb-2 text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                        {group.dateLabel}
                      </div>
                      {group.items.map((expense) => (
                        <div
                          key={expense.id}
                          className="px-5 py-3 flex items-center justify-between hover:bg-gray-800/40 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-lg ${getCategoryColor(
                                expense.category
                              )} flex items-center justify-center text-white shadow-md`}
                            >
                              {getCategoryIconComponent(expense.category)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-white">
                                {expense.description || expense.category}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                                <span className="inline-flex items-center gap-1">
                                  <span className="inline-block h-2 w-2 rounded-full bg-gray-400" />
                                  {expense.category}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-gray-500" />
                                <span className="inline-flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {expense.person || "No-one"}
                                </span>
                                <span className="h-1 w-1 rounded-full bg-gray-500" />
                                <span className="inline-flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(expense.date).toLocaleTimeString(
                                    undefined,
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    }
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-sm sm:text-base font-semibold text-white">
                              {formatCurrency(
                                convertToDisplayCurrency(
                                  expense.amount,
                                  expense.currency
                                )
                              )}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="rounded-full h-8 w-8 text-gray-400 hover:bg-gray-700/60"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="bg-gray-900 border-gray-700/70 shadow-xl"
                              >
                                <DropdownMenuItem className="text-gray-500 text-xs">
                                  View details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    <p>No expenses for this month.</p>
                    <p className="text-sm">
                      Pick a different month from the dropdown above.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

