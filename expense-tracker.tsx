"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  MoreHorizontal,
  PieChart,
  CreditCard,
  DollarSign,
  Home,
  ShoppingBag,
  Car,
  Film,
  Utensils,
  Zap,
  User,
  X,
  Heart,
  LogOut,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { useSession, signOut } from "next-auth/react"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { ChevronLeft, ChevronRight } from "lucide-react"

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

// Define category type with color
type Category = {
  name: string
  color: string
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: "Food", color: "bg-blue-500" },
  { name: "Transport", color: "bg-gray-600" },
  { name: "Shopping", color: "bg-gray-500" },
  { name: "Bills", color: "bg-gray-700" },
  { name: "Entertainment", color: "bg-gray-400" },
  { name: "Medical", color: "bg-red-500" },
  { name: "Other", color: "bg-gray-600" },
]

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className: string }>> = {
  Food: Utensils,
  Transport: Car,
  Shopping: ShoppingBag,
  Bills: Zap,
  Entertainment: Film,
  Medical: Heart,
  Other: Home,
}

export default function ExpenseTracker() {
  const { data: session } = useSession()

  // State for Drive file IDs
  const [expensesFileMap, setExpensesFileMap] = useState<Record<string, string>>({})
  const [categoriesFileId, setCategoriesFileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const hasLoadedRef = useRef(false)

  // State for categories
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES)
  const [newCategoryName, setNewCategoryName] = useState("")
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)

  // State for display currency
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "PKR">("PKR")

  // State for expenses
  const [expenses, setExpenses] = useState<Expense[]>([])

  const router = useRouter()

  // Helper function to handle API errors and redirect if needed
  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}))
      if (errorData.requiresAuth) {
        // Session expired, redirect to login
        router.push("/login")
        return true
      }
    }
    return false
  }

  // Load data from Google Drive on mount
  useEffect(() => {
    if (!session || hasLoadedRef.current) return

    const loadData = async () => {
      try {
        setIsLoading(true)

        // Load expenses from all monthly files
        const expensesRes = await fetch("/api/drive/expenses")
        if (await handleApiError(expensesRes)) return
        if (expensesRes.ok) {
          const expensesData = await expensesRes.json()
          setExpensesFileMap(expensesData.fileMap || {})
          if (expensesData.data && expensesData.data.length > 0) {
            setExpenses(expensesData.data)
          }
        }

        // Load categories
        const categoriesRes = await fetch("/api/drive/categories")
        if (await handleApiError(categoriesRes)) return
        if (categoriesRes.ok) {
          const categoriesData = await categoriesRes.json()
          setCategoriesFileId(categoriesData.fileId)
          if (categoriesData.data && categoriesData.data.length > 0) {
            setCategories(categoriesData.data)
          }
        }
      } catch (error) {
        console.error("Error loading data from Drive:", error)
      } finally {
        setIsLoading(false)
        hasLoadedRef.current = true
      }
    }

    loadData()
  }, [session, router])

  // Save expenses to Drive (automatically organized by month)
  const saveExpenses = async (expensesToSave: Expense[]) => {
    if (isSaving) return

    try {
      setIsSaving(true)
      const response = await fetch("/api/drive/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenses: expensesToSave,
          fileMap: expensesFileMap,
        }),
      })
      
      if (await handleApiError(response)) return
      
      if (response.ok) {
        const result = await response.json()
        // Update file map with any new monthly files created
        if (result.savedFiles) {
          setExpensesFileMap((prev) => ({ ...prev, ...result.savedFiles }))
        }
      }
    } catch (error) {
      console.error("Error saving expenses:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Save categories to Drive
  const saveCategories = async (categoriesToSave: Category[]) => {
    if (!categoriesFileId || isSaving) return

    try {
      setIsSaving(true)
      const response = await fetch("/api/drive/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: categoriesFileId,
          categories: categoriesToSave,
        }),
      })
      
      if (await handleApiError(response)) return
    } catch (error) {
      console.error("Error saving categories:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // State for new expense
  const [newExpense, setNewExpense] = useState({
    amount: "",
    currency: "PKR" as "USD" | "PKR",
    description: "",
    category: "Food",
    date: new Date().toISOString().split("T")[0],
    person: "",
  })

  // State for search and filter
  const [searchTerm, setSearchTerm] = useState("")
  const [filterCategory, setFilterCategory] = useState("All")
  const [filterPerson, setFilterPerson] = useState("All")
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const expensesPerPage = 5

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

  // Get currency symbol
  const getCurrencySymbol = (currency: "USD" | "PKR"): string => {
    return currency === "USD" ? "$" : "₨"
  }

  // Format amount with currency
  const formatCurrency = (amount: number, currency: "USD" | "PKR"): string => {
    const symbol = getCurrencySymbol(currency)
    if (currency === "PKR") {
      return `${symbol}${amount.toFixed(0)}`
    }
    return `${symbol}${amount.toFixed(2)}`
  }

  // Calculate total expenses in display currency
  const totalExpenses = expenses.reduce((sum, expense) => {
    return sum + convertToDisplayCurrency(expense.amount, expense.currency)
  }, 0)

  // Calculate month-over-month percentage change
  const getMonthOverMonthChange = () => {
    const now = new Date()
    const currentMonth = now.getMonth()
    const currentYear = now.getFullYear()
    
    // Calculate previous month
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear

    // Calculate current month total
    const currentMonthTotal = expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date)
        return (
          expenseDate.getMonth() === currentMonth &&
          expenseDate.getFullYear() === currentYear
        )
      })
      .reduce((sum, expense) => {
        return sum + convertToDisplayCurrency(expense.amount, expense.currency)
      }, 0)

    // Calculate previous month total
    const prevMonthTotal = expenses
      .filter((expense) => {
        const expenseDate = new Date(expense.date)
        return (
          expenseDate.getMonth() === prevMonth &&
          expenseDate.getFullYear() === prevYear
        )
      })
      .reduce((sum, expense) => {
        return sum + convertToDisplayCurrency(expense.amount, expense.currency)
      }, 0)

    // Calculate percentage change
    if (prevMonthTotal === 0) {
      if (currentMonthTotal === 0) {
        return { percentage: 0, isIncrease: false, hasData: false }
      }
      return { percentage: 100, isIncrease: true, hasData: true }
    }

    const percentage = ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
    return {
      percentage: Math.abs(percentage),
      isIncrease: percentage >= 0,
      hasData: true,
    }
  }

  const monthOverMonthChange = getMonthOverMonthChange()

  // Get unique list of people from expenses
  const uniquePeople = Array.from(
    new Set(
      expenses
        .map((expense) => expense.person || "No-one")
        .filter((person) => person !== "No-one")
    )
  ).sort()

  // Filter expenses based on search, category, person, and active tab
  const filteredExpenses = expenses.filter((expense) => {
    const matchesSearch = expense.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = filterCategory === "All" || expense.category === filterCategory
    const matchesPerson =
      filterPerson === "All" ||
      (filterPerson === "No-one" && (!expense.person || expense.person === "No-one")) ||
      (filterPerson !== "No-one" && expense.person === filterPerson)

    // Filter by time period if needed
    const expenseDate = new Date(expense.date)
    expenseDate.setHours(0, 0, 0, 0)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const isToday = expenseDate.getTime() === today.getTime()

    // Calculate start of week (Sunday)
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

  // Sort filtered expenses by date (most recent first)
  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    return dateB - dateA // Most recent first
  })

  // Calculate pagination
  const totalPages = Math.ceil(sortedExpenses.length / expensesPerPage)
  const startIndex = (currentPage - 1) * expensesPerPage
  const endIndex = startIndex + expensesPerPage
  const paginatedExpenses = sortedExpenses.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterCategory, filterPerson, activeTab])

  // Group expenses by category for summary
  const expensesByCategory = categories
    .map((category) => {
      const total = expenses
        .filter((expense) => expense.category === category.name)
        .reduce((sum, expense) => sum + convertToDisplayCurrency(expense.amount, expense.currency), 0)
      return {
        ...category,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  // Get icon for category
  const getCategoryIconComponent = (categoryName: string) => {
    const IconComponent = CATEGORY_ICONS[categoryName] || CreditCard
    return <IconComponent className="h-4 w-4" />
  }

  // Handle adding a new category
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return

    const colors = ["bg-gray-600", "bg-gray-500", "bg-gray-700", "bg-gray-400", "bg-gray-800", "bg-blue-500"]
    const newCategory: Category = {
      name: newCategoryName,
      color: colors[categories.length % colors.length],
    }

    const updatedCategories = [...categories, newCategory]
    setCategories(updatedCategories)
    setNewCategoryName("")
    setIsAddCategoryOpen(false)
    await saveCategories(updatedCategories)
  }

  // Handle removing a category
  const handleRemoveCategory = async (categoryName: string) => {
    const updatedCategories = categories.filter((cat) => cat.name !== categoryName)
    setCategories(updatedCategories)
    await saveCategories(updatedCategories)
  }

  // Handle editing an expense
  const handleEditExpense = (expense: Expense) => {
    setEditingExpenseId(expense.id)
    setNewExpense({
      amount: expense.amount.toString(),
      currency: expense.currency,
      description: expense.description,
      category: expense.category,
      date: expense.date,
      person: expense.person === "No-one" ? "" : expense.person,
    })
    setIsAddExpenseOpen(true)
  }

  // Handle adding or updating an expense
  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.description) return

    let updatedExpenses: Expense[]

    if (editingExpenseId) {
      // Update existing expense
      updatedExpenses = expenses.map((exp) =>
        exp.id === editingExpenseId
          ? {
              ...exp,
              amount: Number.parseFloat(newExpense.amount),
              currency: newExpense.currency,
              description: newExpense.description,
              category: newExpense.category,
              date: newExpense.date,
              person: newExpense.person || "No-one",
            }
          : exp
      )
      setEditingExpenseId(null)
    } else {
      // Add new expense
    const expense: Expense = {
      id: Date.now().toString(),
      amount: Number.parseFloat(newExpense.amount),
        currency: newExpense.currency,
      description: newExpense.description,
      category: newExpense.category,
      date: newExpense.date,
        person: newExpense.person || "No-one",
      }
      updatedExpenses = [expense, ...expenses]
    }

    setExpenses(updatedExpenses)
    setNewExpense({
      amount: "",
      currency: "PKR",
      description: "",
      category: "Food",
      date: new Date().toISOString().split("T")[0],
      person: "",
    })
    setIsAddExpenseOpen(false)
    await saveExpenses(updatedExpenses)
  }

  // Handle deleting an expense
  const handleDeleteExpense = async (id: string) => {
    const updatedExpenses = expenses.filter((expense) => expense.id !== id)
    setExpenses(updatedExpenses)
    await saveExpenses(updatedExpenses)
  }

  // Get category color
  const getCategoryColor = (categoryName: string) => {
    const category = categories.find((c) => c.name === categoryName)
    return category ? category.color : "bg-gray-500/80"
  }

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  // Get category icon (now uses getCategoryIconComponent)
  const getCategoryIcon = (categoryName: string) => {
    return CATEGORY_ICONS[categoryName] || CreditCard
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-neon flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-white">Loading your data from Google Drive...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-neon flex flex-col">
      {isSaving && (
        <div className="fixed top-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
          <span className="text-sm">Saving to Google Drive...</span>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-800/90 backdrop-blur-md border-b border-gray-700/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-6 w-6 text-white" />
            <h1 className="text-xl font-semibold text-white">Expense Tracker</h1>
          </div>
          <div className="flex items-center gap-3">
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
            <Dialog 
              open={isAddExpenseOpen} 
              onOpenChange={(open) => {
                setIsAddExpenseOpen(open)
                if (!open) {
                  setEditingExpenseId(null)
                  setNewExpense({
                    amount: "",
                    currency: "PKR",
                    description: "",
                    category: "Food",
                    date: new Date().toISOString().split("T")[0],
                    person: "",
                  })
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="rounded-full gap-1 bg-blue-500 text-white hover:bg-blue-600 border-0 shadow-lg"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Expense</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px] bg-gray-800/95 backdrop-blur-xl border border-gray-700/50">
                <DialogHeader>
                  <DialogTitle className="text-white">
                    {editingExpenseId ? "Edit Expense" : "Add New Expense"}
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="amount" className="text-gray-300">Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="amount"
                        type="number"
                        placeholder="0.00"
                        className="pl-9 bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency" className="text-gray-300">Currency</Label>
                    <Select
                      value={newExpense.currency}
                      onValueChange={(value: "USD" | "PKR") => setNewExpense({ ...newExpense, currency: value })}
                      defaultValue="PKR"
                    >
                      <SelectTrigger id="currency" className="bg-gray-700/60 border-gray-600/50 text-white">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700/50">
                        <SelectItem value="PKR">PKR (₨)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description" className="text-gray-300">Description</Label>
                    <Input
                      id="description"
                      placeholder="What did you spend on?"
                      className="bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                      value={newExpense.description}
                      onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="person" className="text-gray-300">Spent on whom</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="person"
                        placeholder="Enter name or leave empty for general"
                        className="pl-9 bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                        value={newExpense.person}
                        onChange={(e) => setNewExpense({ ...newExpense, person: e.target.value })}
                        list="person-suggestions"
                      />
                      <datalist id="person-suggestions">
                        <option value="">No-one (General)</option>
                        {uniquePeople.map((person) => (
                          <option key={person} value={person} />
                        ))}
                      </datalist>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="category" className="text-gray-300">Category</Label>
                    <Select
                      value={newExpense.category}
                      onValueChange={(value) => setNewExpense({ ...newExpense, category: value })}
                    >
                      <SelectTrigger id="category" className="bg-gray-700/60 border-gray-600/50 text-white">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700/50">
                        {categories.map((category) => (
                          <SelectItem key={category.name} value={category.name}>
                            <div className="flex items-center">
                              <div className={`w-3 h-3 rounded-full ${category.color} mr-2`}></div>
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="date" className="text-gray-300">Date</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                      <Input
                        id="date"
                        type="date"
                        className="pl-9 bg-gray-700/60 border-gray-600/50 text-white focus:border-blue-500"
                        value={newExpense.date}
                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddExpense}
                    className="w-full bg-blue-500 text-white hover:bg-blue-600 border-0"
                  >
                    {editingExpenseId ? "Update Expense" : "Add Expense"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="grid gap-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="overflow-hidden bg-gray-800/90 border border-gray-700/50 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Total Expenses</CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  {formatCurrency(totalExpenses, displayCurrency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                {monthOverMonthChange.hasData ? (
                  <div className="text-xs text-gray-400 flex items-center">
                    {monthOverMonthChange.isIncrease ? (
                      <>
                        <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                        <span className="text-green-500 font-medium">
                          {monthOverMonthChange.percentage.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <ArrowDownRight className="h-3 w-3 mr-1 text-red-500" />
                        <span className="text-red-500 font-medium">
                          {monthOverMonthChange.percentage.toFixed(1)}%
                        </span>
                      </>
                    )}
                    <span className="ml-1">from last month</span>
                </div>
                ) : (
                  <div className="text-xs text-gray-400 flex items-center">
                    <span>No data from last month</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800/90 border border-gray-700/50 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Top Category</CardDescription>
                <CardTitle className="flex items-center gap-2 text-white">
                  <div className={`w-3 h-3 rounded-full ${expensesByCategory[0]?.color || "bg-blue-500"}`}></div>
                  {expensesByCategory[0]?.name || "None"}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-2xl font-bold text-white">
                  {expensesByCategory[0]?.total ? formatCurrency(expensesByCategory[0].total, displayCurrency) : formatCurrency(0, displayCurrency)}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {Math.round((expensesByCategory[0]?.total / totalExpenses) * 100) || 0}% of total expenses
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/90 border border-gray-700/50 backdrop-blur-xl">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">This Month</CardDescription>
                <CardTitle className="text-3xl font-bold text-white">
                  {formatCurrency(
                    expenses
                    .filter((e) => new Date(e.date).getMonth() === new Date().getMonth())
                      .reduce((sum, e) => sum + convertToDisplayCurrency(e.amount, e.currency), 0),
                    displayCurrency
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-2">
                <div className="text-xs text-gray-400">
                  {expenses.filter((e) => new Date(e.date).getMonth() === new Date().getMonth()).length} transactions
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution and Management */}
          <Card className="bg-gray-800/90 border border-gray-700/50 backdrop-blur-xl shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">Expense Distribution & Categories</CardTitle>
                <Dialog open={isAddCategoryOpen} onOpenChange={setIsAddCategoryOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      className="gap-1 bg-blue-500 text-white hover:bg-blue-600"
                    >
                      <Plus className="h-4 w-4" />
                      Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[425px] bg-gray-800/95 backdrop-blur-xl border-gray-700/50">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add New Category</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="category-name" className="text-gray-300">Category Name</Label>
                        <Input
                          id="category-name"
                          placeholder="Enter category name"
                          className="bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleAddCategory}
                        className="w-full bg-blue-500 text-white hover:bg-blue-600"
                      >
                        Add Category
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {expensesByCategory
                  .filter((category) => category.total > 0)
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
                        <div className="font-medium text-white">{category.name}</div>
                        <div className="text-sm text-gray-400">{formatCurrency(category.total, displayCurrency)}</div>
                      </div>
                      <div className="ml-auto">
                        <div className="text-sm font-medium text-gray-300">
                          {Math.round((category.total / totalExpenses) * 100)}%
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {categories.length > 6 && (
                <div className="mt-4 pt-4 border-t border-gray-700/50">
                  <div className="text-sm font-medium text-gray-300 mb-3">Custom Categories</div>
                  <div className="flex flex-wrap gap-2">
                    {categories.slice(6).map((category) => (
                      <div
                        key={category.name}
                        className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-700/50 border border-gray-600/40 hover:border-gray-600/60"
                      >
                        <span className="text-sm text-gray-300">{category.name}</span>
                        <button
                          onClick={() => handleRemoveCategory(category.name)}
                          className="text-gray-400 hover:text-gray-300"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense List */}
          <Card className="bg-gray-800/90 border border-gray-700/50 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-white">Recent Expenses</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      type="search"
                      placeholder="Search expenses..."
                      className="w-[200px] pl-8 h-9 bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[130px] h-9 bg-gray-700/60 border-gray-600/50 text-white">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-800 border-gray-700/50">
                      <SelectItem value="All">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.name} value={category.name}>
                          <div className="flex items-center">
                            <div className={`w-3 h-3 rounded-full ${category.color} mr-2`}></div>
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterPerson} onValueChange={setFilterPerson}>
                    <SelectTrigger className="w-[130px] h-9 bg-gray-700/60 border-gray-600/50 text-white">
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
              <Tabs value={activeTab} className="mt-2" onValueChange={setActiveTab}>
                <TabsList className="grid grid-cols-4 w-full sm:w-[400px] bg-gray-700/40 border border-gray-600/50">
                  <TabsTrigger value="all" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="today" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    Today
                  </TabsTrigger>
                  <TabsTrigger value="week" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    This Week
                  </TabsTrigger>
                  <TabsTrigger value="month" className="data-[state=active]:bg-blue-500 data-[state=active]:text-white">
                    This Month
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-gray-700/50">
                {paginatedExpenses.length > 0 ? (
                  paginatedExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="p-4 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full ${getCategoryColor(expense.category)} flex items-center justify-center text-white shadow-lg`}
                        >
                          {getCategoryIconComponent(expense.category)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{expense.description}</div>
                          <div className="text-sm text-gray-400 flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="text-xs rounded-full bg-gray-700/50 text-gray-300 hover:bg-gray-700/70 border border-gray-600/50"
                            >
                              {expense.category}
                            </Badge>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {expense.person || "No-one"}
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(expense.date)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-lg font-medium text-white">
                          {formatCurrency(convertToDisplayCurrency(expense.amount, expense.currency), displayCurrency)}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="rounded-full h-8 w-8 text-gray-400 hover:bg-gray-700/50"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700/50">
                            <DropdownMenuItem 
                              className="text-gray-200 hover:text-white"
                              onClick={() => handleEditExpense(expense)}
                            >
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-400 focus:text-red-300"
                              onClick={() => handleDeleteExpense(expense.id)}
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-gray-400">
                    <PieChart className="h-12 w-12 mx-auto mb-3 text-gray-600/30" />
                    <p>No expenses found.</p>
                    <p className="text-sm">Add a new expense or adjust your filters.</p>
                    <Button
                      variant="outline"
                      className="mt-4 bg-blue-500 text-white border-blue-500/30 hover:bg-blue-600"
                      onClick={() => setIsAddExpenseOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Expense
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            {sortedExpenses.length > 0 && (
              <CardFooter className="flex flex-col gap-4 py-4 border-t border-gray-700/50">
                <div className="flex items-center justify-between w-full">
                  <div className="text-sm text-gray-400">
                    Showing {startIndex + 1}-{Math.min(endIndex, sortedExpenses.length)} of {sortedExpenses.length} expenses
                </div>
                <Button
                  variant="outline"
                  size="sm"
                    className="bg-gray-700/20 text-gray-300 border-gray-600/50 hover:bg-gray-700/40"
                    onClick={() => {
                      setActiveTab("all")
                      setSearchTerm("")
                      setFilterCategory("All")
                      setFilterPerson("All")
                      setCurrentPage(1)
                    }}
                >
                  View All
                </Button>
                </div>
                {totalPages > 1 && (
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-300 hover:text-white hover:bg-gray-700/50"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" />
                          Previous
                        </Button>
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                        // Show first page, last page, current page, and pages around current
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <PaginationItem key={page}>
                              <Button
                                variant={currentPage === page ? "outline" : "ghost"}
                                size="sm"
                                className={`${
                                  currentPage === page
                                    ? "bg-blue-500 text-white border-blue-500"
                                    : "text-gray-300 hover:text-white hover:bg-gray-700/50"
                                }`}
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            </PaginationItem>
                          )
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <PaginationItem key={page}>
                              <span className="text-gray-500 px-2">...</span>
                            </PaginationItem>
                          )
                        }
                        return null
                      })}
                      <PaginationItem>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-gray-300 hover:text-white hover:bg-gray-700/50"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                )}
              </CardFooter>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}
