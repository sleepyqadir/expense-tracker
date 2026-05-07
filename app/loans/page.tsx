"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, X, DollarSign, User, Trash2, CheckCircle2, MinusCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { LoadingScreen } from "@/components/loading-screen"
import { useToast } from "@/hooks/use-toast"

// Exchange rate: 1 USD = 280 PKR
const USD_TO_PKR = 280

type Loan = {
  id: string
  person: string
  amount: number
  currency: "USD" | "PKR"
  type: "given" | "taken" // "given" = they owe me, "taken" = I owe them
  description?: string
  date: string
  cleared?: boolean
  clearedDate?: string
}

export default function LoansPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loans, setLoans] = useState<Loan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "PKR">("PKR")
  const [loansFileId, setLoansFileId] = useState<string | null>(null)
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false)
  const [partialClearLoanId, setPartialClearLoanId] = useState<string | null>(null)
  const [partialClearAmount, setPartialClearAmount] = useState("")
  const hasLoadedRef = useRef(false)

  const [newLoan, setNewLoan] = useState({
    person: "",
    amount: "",
    currency: "PKR" as "USD" | "PKR",
    type: "given" as "given" | "taken",
    description: "",
    date: new Date().toISOString().split("T")[0],
  })

  // Helper function to handle API errors and redirect if needed
  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}))
      if (errorData.requiresAuth) {
        toast({
          title: "Session expired",
          description: "Please sign in with Google again to manage your loans.",
        })
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

  // Load loans from Google Drive
  useEffect(() => {
    if (!session || hasLoadedRef.current) return

    const loadData = async () => {
      try {
        setIsLoading(true)
        const loansRes = await fetch("/api/drive/loans")
        if (await handleApiError(loansRes)) return
        if (loansRes.ok) {
          const loansData = await loansRes.json()
          setLoansFileId(loansData.fileId)
          if (loansData.data && loansData.data.length > 0) {
            setLoans(loansData.data)
          }
        }
      } catch (error) {
        console.error("Error loading loans:", error)
      } finally {
        setIsLoading(false)
        hasLoadedRef.current = true
      }
    }

    loadData()
  }, [session, router])

  // Save loans to Drive
  const saveLoans = async (loansToSave: Loan[]) => {
    if (!loansFileId || isSaving) return

    try {
      setIsSaving(true)
      const response = await fetch("/api/drive/loans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: loansFileId,
          loans: loansToSave,
        }),
      })

      if (await handleApiError(response)) return
    } catch (error) {
      console.error("Error saving loans:", error)
    } finally {
      setIsSaving(false)
    }
  }

  // Convert amount to display currency
  const convertToDisplayCurrency = (amount: number, loanCurrency: "USD" | "PKR"): number => {
    if (displayCurrency === loanCurrency) {
      return amount
    }
    if (displayCurrency === "PKR" && loanCurrency === "USD") {
      return amount * USD_TO_PKR
    }
    if (displayCurrency === "USD" && loanCurrency === "PKR") {
      return amount / USD_TO_PKR
    }
    return amount
  }

  // Format currency
  const formatCurrency = (amount: number): string => {
    const symbol = displayCurrency === "USD" ? "$" : "₨"
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  // Add new loan
  const handleAddLoan = () => {
    if (!newLoan.person || !newLoan.amount) return

    const loan: Loan = {
      id: Date.now().toString(),
      person: newLoan.person,
      amount: parseFloat(newLoan.amount),
      currency: newLoan.currency,
      type: newLoan.type,
      description: newLoan.description,
      date: newLoan.date,
      cleared: false,
    }

    const updatedLoans = [...loans, loan]
    setLoans(updatedLoans)
    saveLoans(updatedLoans)

    // Reset form
    setNewLoan({
      person: "",
      amount: "",
      currency: "PKR",
      type: "given",
      description: "",
      date: new Date().toISOString().split("T")[0],
    })
    setIsAddLoanOpen(false)
  }

  // Clear a loan (full)
  const handleClearLoan = (loanId: string) => {
    const updatedLoans = loans.map((loan) =>
      loan.id === loanId
        ? { ...loan, cleared: true, clearedDate: new Date().toISOString().split("T")[0] }
        : loan
    )
    setLoans(updatedLoans)
    saveLoans(updatedLoans)
  }

  // Partially clear a loan
  const handlePartialClear = (loanId: string) => {
    const amount = parseFloat(partialClearAmount)
    if (!amount || amount <= 0) return

    const loan = loans.find((l) => l.id === loanId)
    if (!loan) return

    const deduct = Math.min(amount, loan.amount)
    const newAmount = loan.amount - deduct

    const updatedLoans = loans.map((l) =>
      l.id === loanId
        ? {
            ...l,
            amount: newAmount,
            ...(newAmount <= 0
              ? { cleared: true, clearedDate: new Date().toISOString().split("T")[0] }
              : {}),
          }
        : l
    )
    setLoans(updatedLoans)
    saveLoans(updatedLoans)
    setPartialClearLoanId(null)
    setPartialClearAmount("")
  }

  // Delete a loan
  const handleDeleteLoan = (loanId: string) => {
    const updatedLoans = loans.filter((loan) => loan.id !== loanId)
    setLoans(updatedLoans)
    saveLoans(updatedLoans)
  }

  // Filter loans
  const activeLoans = loans.filter((loan) => !loan.cleared)
  const clearedLoans = loans.filter((loan) => loan.cleared)

  // Calculate totals
  const givenLoans = activeLoans.filter((loan) => loan.type === "given")
  const takenLoans = activeLoans.filter((loan) => loan.type === "taken")

  const totalGiven = givenLoans.reduce(
    (sum, loan) => sum + convertToDisplayCurrency(loan.amount, loan.currency),
    0
  )
  const totalTaken = takenLoans.reduce(
    (sum, loan) => sum + convertToDisplayCurrency(loan.amount, loan.currency),
    0
  )
  const netAmount = totalGiven - totalTaken

  if (isLoading) {
    return <LoadingScreen message="Loading loans..." />
  }

  return (
    <div className="min-h-screen bg-gradient-neon flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Loans</h1>
              <p className="text-gray-400 mt-1">Track money given and taken</p>
            </div>
            <div className="flex items-center gap-3">
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
                  onCheckedChange={(checked) => setDisplayCurrency(checked ? "PKR" : "USD")}
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
              <Dialog open={isAddLoanOpen} onOpenChange={setIsAddLoanOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="rounded-full gap-1 bg-blue-500 text-white hover:bg-blue-600 border-0 shadow-lg"
                  >
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Loan</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] bg-gray-800/95 backdrop-blur-xl border border-gray-700/50">
                  <DialogHeader>
                    <DialogTitle className="text-white">Add New Loan</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="type" className="text-gray-300">
                        Loan Type
                      </Label>
                      <Select
                        value={newLoan.type}
                        onValueChange={(value: "given" | "taken") =>
                          setNewLoan({ ...newLoan, type: value })
                        }
                      >
                        <SelectTrigger
                          id="type"
                          className="bg-gray-700/60 border-gray-600/50 text-white"
                        >
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700/50">
                          <SelectItem value="given">Given (They owe me)</SelectItem>
                          <SelectItem value="taken">Taken (I owe them)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="person" className="text-gray-300">
                        Person
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="person"
                          placeholder="Enter person's name"
                          className="pl-9 bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                          value={newLoan.person}
                          onChange={(e) => setNewLoan({ ...newLoan, person: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="amount" className="text-gray-300">
                        Amount
                      </Label>
                      <div className="relative">
                        <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          id="amount"
                          type="number"
                          placeholder="0.00"
                          className="pl-9 bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                          value={newLoan.amount}
                          onChange={(e) => setNewLoan({ ...newLoan, amount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="currency" className="text-gray-300">
                        Currency
                      </Label>
                      <Select
                        value={newLoan.currency}
                        onValueChange={(value: "USD" | "PKR") =>
                          setNewLoan({ ...newLoan, currency: value })
                        }
                      >
                        <SelectTrigger
                          id="currency"
                          className="bg-gray-700/60 border-gray-600/50 text-white"
                        >
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700/50">
                          <SelectItem value="PKR">PKR (₨)</SelectItem>
                          <SelectItem value="USD">USD ($)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description" className="text-gray-300">
                        Description (Optional)
                      </Label>
                      <Input
                        id="description"
                        placeholder="What is this loan for?"
                        className="bg-gray-700/60 border-gray-600/50 text-white placeholder:text-gray-400 focus:border-blue-500"
                        value={newLoan.description}
                        onChange={(e) =>
                          setNewLoan({ ...newLoan, description: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="date" className="text-gray-300">
                        Date
                      </Label>
                      <Input
                        id="date"
                        type="date"
                        className="bg-gray-700/60 border-gray-600/50 text-white focus:border-blue-500"
                        value={newLoan.date}
                        onChange={(e) => setNewLoan({ ...newLoan, date: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={handleAddLoan}
                      className="w-full bg-blue-500 text-white hover:bg-blue-600 border-0"
                    >
                      Add Loan
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {isSaving && (
                <span className="text-gray-400 text-sm">Saving...</span>
              )}
            </div>
          </div>

          {/* Partial clear dialog */}
          <Dialog
            open={!!partialClearLoanId}
            onOpenChange={(open) => !open && setPartialClearLoanId(null)}
          >
            <DialogContent className="sm:max-w-[380px] bg-gray-800/95 border-gray-700/50">
              <DialogHeader>
                <DialogTitle className="text-white">Partial clear</DialogTitle>
                <CardDescription className="text-gray-400">
                  Reduce the loan amount. If the amount equals or exceeds the balance, the
                  loan will be marked cleared.
                </CardDescription>
              </DialogHeader>
              {partialClearLoanId &&
                (() => {
                  const loan = loans.find((l) => l.id === partialClearLoanId)
                  if (!loan) return null
                  return (
                    <div className="grid gap-4 py-4">
                      <div className="text-sm text-gray-400">
                        <span className="text-white font-medium">{loan.person}</span>
                        {" • "}
                        Current:{" "}
                        {formatCurrency(
                          convertToDisplayCurrency(loan.amount, loan.currency)
                        )}{" "}
                        ({loan.currency})
                      </div>
                      <div>
                        <Label className="text-gray-300">
                          Amount to deduct ({loan.currency})
                        </Label>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={partialClearAmount}
                          onChange={(e) => setPartialClearAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  )
                })()}
              <DialogFooter>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-400"
                  onClick={() => {
                    setPartialClearLoanId(null)
                    setPartialClearAmount("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-amber-500 hover:bg-amber-600"
                  onClick={() => partialClearLoanId && handlePartialClear(partialClearLoanId)}
                  disabled={!partialClearAmount || parseFloat(partialClearAmount) <= 0}
                >
                  Deduct
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 mt-6">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total Given</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {formatCurrency(totalGiven)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-gray-400">
                {givenLoans.length} active loan{givenLoans.length !== 1 ? "s" : ""}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Total Taken</CardDescription>
              <CardTitle className="text-2xl font-bold text-white">
                {formatCurrency(totalTaken)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-gray-400">
                {takenLoans.length} active loan{takenLoans.length !== 1 ? "s" : ""}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardDescription className="text-gray-400">Net Amount</CardDescription>
              <CardTitle className={`text-2xl font-bold ${netAmount >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatCurrency(Math.abs(netAmount))}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-gray-400">
                {netAmount >= 0 ? "You are owed" : "You owe"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Loans */}
        <Card className="bg-gray-800/50 border-gray-700 mb-6">
          <CardHeader>
            <CardTitle className="text-white">Active Loans</CardTitle>
            <CardDescription className="text-gray-400">
              Loans that are not yet cleared
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeLoans.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No active loans
              </div>
            ) : (
              <div className="space-y-3">
                {activeLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-start sm:items-center justify-between p-4 bg-gray-700/30 rounded-lg border border-gray-600/50 gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <User className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-white font-medium truncate">{loan.person}</span>
                        <Badge
                          variant="outline"
                          className={loan.type === "given" ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}
                        >
                          {loan.type === "given" ? "Given" : "Taken"}
                        </Badge>
                      </div>
                      <div className="text-gray-400 text-sm">
                        {loan.description && `${loan.description} • `}
                        {new Date(loan.date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <div className="text-right mr-1">
                        <div className="text-white font-bold text-sm sm:text-base">
                          {formatCurrency(convertToDisplayCurrency(loan.amount, loan.currency))}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {loan.currency}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setPartialClearLoanId(loan.id)
                          setPartialClearAmount("")
                        }}
                        className="text-amber-500 hover:bg-amber-500/10 h-8 w-8"
                        title="Partial clear"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleClearLoan(loan.id)}
                        className="text-green-500 hover:bg-green-500/10 h-8 w-8"
                        title="Clear loan (full)"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="text-red-500 hover:bg-red-500/10 h-8 w-8"
                        title="Delete loan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cleared Loans */}
        {clearedLoans.length > 0 && (
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Cleared Loans</CardTitle>
              <CardDescription className="text-gray-400">
                Loans that have been cleared
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clearedLoans.map((loan) => (
                  <div
                    key={loan.id}
                    className="flex items-start sm:items-center justify-between p-4 bg-gray-700/20 rounded-lg border border-gray-600/30 opacity-60 gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <User className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="text-white font-medium truncate">{loan.person}</span>
                        <Badge
                          variant="outline"
                          className={loan.type === "given" ? "border-green-500 text-green-500" : "border-red-500 text-red-500"}
                        >
                          {loan.type === "given" ? "Given" : "Taken"}
                        </Badge>
                        <Badge variant="outline" className="border-gray-500 text-gray-500">
                          Cleared
                        </Badge>
                      </div>
                      <div className="text-gray-400 text-sm">
                        {loan.description && `${loan.description} • `}
                        Cleared on {loan.clearedDate ? new Date(loan.clearedDate).toLocaleDateString() : "N/A"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                      <div className="text-right mr-1">
                        <div className="text-white font-bold text-sm sm:text-base">
                          {formatCurrency(convertToDisplayCurrency(loan.amount, loan.currency))}
                        </div>
                        <div className="text-gray-400 text-xs">
                          {loan.currency}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteLoan(loan.id)}
                        className="text-red-500 hover:bg-red-500/10 h-8 w-8"
                        title="Delete loan"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>
  )
}
