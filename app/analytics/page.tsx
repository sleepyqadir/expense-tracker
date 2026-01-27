"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ArrowLeft, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"

// Define expense type
type Expense = {
  id: string
  amount: number
  currency: "USD" | "PKR"
  description: string
  category: string
  date: string
  person: string
}

// Exchange rate: 1 USD = 280 PKR
const USD_TO_PKR = 280

// Category colors for charts
const CATEGORY_COLORS: Record<string, string> = {
  Food: "#3b82f6", // blue-500
  Transport: "#4b5563", // gray-600
  Shopping: "#6b7280", // gray-500
  Bills: "#374151", // gray-700
  Entertainment: "#9ca3af", // gray-400
  Medical: "#ef4444", // red-500
  Other: "#4b5563", // gray-600
}

const COLORS = [
  "#3b82f6", // blue-500
  "#4b5563", // gray-600
  "#6b7280", // gray-500
  "#374151", // gray-700
  "#9ca3af", // gray-400
  "#ef4444", // red-500
  "#4b5563", // gray-600
]

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "PKR">("PKR")
  const [activeTab, setActiveTab] = useState<"today" | "week" | "month">("month")
  const hasLoadedRef = useRef(false)

  // Helper function to handle API errors and redirect if needed
  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}))
      if (errorData.requiresAuth) {
        router.push("/login")
        return true
      }
    }
    return false
  }

  // Redirect to login if not authenticated
  useEffect(() => {
    if (session === null) {
      router.push("/login")
    }
  }, [session, router])

  // Load expenses from Google Drive
  useEffect(() => {
    if (!session || hasLoadedRef.current) return

    const loadData = async () => {
      try {
        setIsLoading(true)
        const expensesRes = await fetch("/api/drive/expenses")
        if (await handleApiError(expensesRes)) return
        if (expensesRes.ok) {
          const expensesData = await expensesRes.json()
          if (expensesData.data && expensesData.data.length > 0) {
            setExpenses(expensesData.data)
          }
        }
      } catch (error) {
        console.error("Error loading expenses:", error)
      } finally {
        setIsLoading(false)
        hasLoadedRef.current = true
      }
    }

    loadData()
  }, [session, router])

  // Convert amount to display currency
  const convertToDisplayCurrency = (amount: number, expenseCurrency: "USD" | "PKR"): number => {
    if (displayCurrency === expenseCurrency) {
      return amount
    }
    if (displayCurrency === "PKR" && expenseCurrency === "USD") {
      return amount * USD_TO_PKR
    }
    if (displayCurrency === "USD" && expenseCurrency === "PKR") {
      return amount / USD_TO_PKR
    }
    return amount
  }

  // Format currency
  const formatCurrency = (amount: number): string => {
    const symbol = displayCurrency === "USD" ? "$" : "₨"
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Filter expenses by time period
  const getFilteredExpenses = (): Expense[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return expenses.filter((expense) => {
      const expenseDate = new Date(expense.date)
      expenseDate.setHours(0, 0, 0, 0)

      if (activeTab === "today") {
        return expenseDate.getTime() === today.getTime()
      } else if (activeTab === "week") {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        const endOfWeek = new Date(startOfWeek)
        endOfWeek.setDate(startOfWeek.getDate() + 6)
        endOfWeek.setHours(23, 59, 59, 999)
        return expenseDate >= startOfWeek && expenseDate <= endOfWeek
      } else if (activeTab === "month") {
        return (
          expenseDate.getMonth() === today.getMonth() &&
          expenseDate.getFullYear() === today.getFullYear()
        )
      }
      return false
    })
  }

  // Calculate expenses by category
  const getCategoryData = () => {
    const filteredExpenses = getFilteredExpenses()
    const categoryMap: Record<string, number> = {}

    filteredExpenses.forEach((expense) => {
      const amount = convertToDisplayCurrency(expense.amount, expense.currency)
      categoryMap[expense.category] = (categoryMap[expense.category] || 0) + amount
    })

    const data = Object.entries(categoryMap)
      .map(([name, value]) => ({
        name,
        value: Number(value.toFixed(2)),
        fill: CATEGORY_COLORS[name] || COLORS[0],
      }))
      .sort((a, b) => b.value - a.value)

    return data
  }

  const categoryData = getCategoryData()
  const totalAmount = categoryData.reduce((sum, item) => sum + item.value, 0)

  // Chart configuration
  const chartConfig = categoryData.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: item.fill,
    }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-screen">
            <div className="text-white text-xl">Loading analytics...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/")}
              className="text-white hover:bg-blue-800/50"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-white">Category Analytics</h1>
              <p className="text-gray-400 mt-1">Compare spending across categories</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 rounded-full bg-gray-800/60 border border-gray-600/50">
            <span className={`text-xs font-medium transition-colors ${displayCurrency === "USD" ? "text-white" : "text-gray-400"}`}>
              USD
            </span>
            <Switch
              checked={displayCurrency === "PKR"}
              onCheckedChange={(checked) => setDisplayCurrency(checked ? "PKR" : "USD")}
              className="data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-gray-600"
            />
            <span className={`text-xs font-medium transition-colors ${displayCurrency === "PKR" ? "text-white" : "text-gray-400"}`}>
              PKR
            </span>
          </div>
        </div>

        {/* Time Period Filter */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Time Period</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "today" | "week" | "month")}>
              <TabsList className="grid grid-cols-3 w-full bg-gray-700/40 border border-gray-600/50">
                <TabsTrigger
                  value="today"
                  className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                >
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="week"
                  className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                >
                  This Week
                </TabsTrigger>
                <TabsTrigger
                  value="month"
                  className="data-[state=active]:bg-blue-500 data-[state=active]:text-white"
                >
                  This Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Spent</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Categories</p>
                <p className="text-3xl font-bold text-white mt-1">
                  {categoryData.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        {categoryData.length === 0 ? (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400 text-lg">No expenses found for this period</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div>
            {/* Bar Chart - Full Width */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Spending by Category (Bar Chart)
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Compare amounts across categories
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-hidden p-4">
                <div className="w-full h-[500px] overflow-hidden">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={categoryData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                        barCategoryGap="15%"
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis
                          dataKey="name"
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                          interval={0}
                        />
                        <YAxis
                          stroke="#9ca3af"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          width={80}
                          domain={[0, 'dataMax']}
                          tickFormatter={(value) => {
                            if (displayCurrency === "USD") {
                              return `$${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)}`
                            }
                            return `₨${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)}`
                          }}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0]
                              return (
                                <div className="rounded-lg border bg-gray-800 p-3 shadow-lg">
                                  <div className="grid gap-2">
                                    <div className="flex items-center justify-between gap-4">
                                      <span className="text-white font-medium">{data.name}</span>
                                      <span className="text-blue-400 font-bold">
                                        {formatCurrency(Number(data.value))}
                                      </span>
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                      {((Number(data.value) / totalAmount) * 100).toFixed(1)}% of total
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          radius={[8, 8, 0, 0]}
                          maxBarSize={120}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Category List */}
        {categoryData.length > 0 && (
          <Card className="bg-gray-800/50 border-gray-700 mt-6">
            <CardHeader>
              <CardTitle className="text-white">Category Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {categoryData.map((item, index) => {
                  const percentage = (item.value / totalAmount) * 100
                  return (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-white font-medium">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="w-32 bg-gray-700 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: item.fill,
                            }}
                          />
                        </div>
                        <span className="text-white font-bold w-24 text-right">
                          {formatCurrency(item.value)}
                        </span>
                        <span className="text-gray-400 text-sm w-16 text-right">
                          {percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
