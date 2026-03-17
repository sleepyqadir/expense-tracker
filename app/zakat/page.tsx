"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Plus, Trash2, Heart, Send, Receipt } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { LoadingScreen } from "@/components/loading-screen"
import { useToast } from "@/hooks/use-toast"

const USD_TO_PKR = 280

type ZakatEntry = {
  id: string
  amount: number
  currency: "PKR" | "USD"
  description: string
  date: string
}

export default function ZakatPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [toGive, setToGive] = useState<ZakatEntry[]>([])
  const [given, setGiven] = useState<ZakatEntry[]>([])
  const [fileId, setFileId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "PKR">("PKR")
  const [addToGiveOpen, setAddToGiveOpen] = useState(false)
  const [addGivenOpen, setAddGivenOpen] = useState(false)
  const hasLoadedRef = useRef(false)

  const { toast } = useToast()

  const [newToGive, setNewToGive] = useState({
    amount: "",
    currency: "PKR" as "PKR" | "USD",
    description: "",
    date: new Date().toISOString().split("T")[0],
  })

  const [newGiven, setNewGiven] = useState({
    amount: "",
    currency: "PKR" as "PKR" | "USD",
    description: "",
    date: new Date().toISOString().split("T")[0],
  })

  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      const err = await response.json().catch(() => ({}))
      if (err.requiresAuth) {
        toast({
          title: "Session expired",
          description: "Please sign in with Google again to manage your Zakat.",
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

    const load = async () => {
      try {
        setIsLoading(true)
        const res = await fetch("/api/drive/zakat")
        if (await handleApiError(res)) return
        if (res.ok) {
          const d = await res.json()
          setFileId(d.fileId)
          setToGive(d.data.toGive || [])
          setGiven(d.data.given || [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setIsLoading(false)
        hasLoadedRef.current = true
      }
    }

    load()
  }, [session, router])

  const save = (toGiveData: ZakatEntry[], givenData: ZakatEntry[]) => {
    if (!fileId || isSaving) return
    setIsSaving(true)
    fetch("/api/drive/zakat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileId, data: { toGive: toGiveData, given: givenData } }),
    })
      .then((r) => handleApiError(r))
      .finally(() => setIsSaving(false))
  }

  const toPkr = (amount: number, currency: "PKR" | "USD") =>
    currency === "PKR" ? amount : amount * USD_TO_PKR

  const toDisplay = (amountPkr: number) =>
    displayCurrency === "PKR" ? amountPkr : amountPkr / USD_TO_PKR

  const formatCurrency = (amount: number) =>
    displayCurrency === "USD"
      ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      : `₨${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`

  const totalToGivePkr = toGive.reduce((s, e) => s + toPkr(e.amount, e.currency), 0)
  const totalGivenPkr = given.reduce((s, e) => s + toPkr(e.amount, e.currency), 0)
  const balancePkr = totalToGivePkr - totalGivenPkr

  const addToGiveEntry = () => {
    const amount = parseFloat(newToGive.amount)
    if (!amount || amount <= 0) return

    const entry: ZakatEntry = {
      id: crypto.randomUUID(),
      amount,
      currency: newToGive.currency,
      description: newToGive.description.trim(),
      date: newToGive.date,
    }

    const next = [...toGive, entry]
    setToGive(next)
    save(next, given)
    setNewToGive({ amount: "", currency: "PKR", description: "", date: new Date().toISOString().split("T")[0] })
    setAddToGiveOpen(false)
  }

  const addGivenEntry = () => {
    const amount = parseFloat(newGiven.amount)
    if (!amount || amount <= 0) return

    const entry: ZakatEntry = {
      id: crypto.randomUUID(),
      amount,
      currency: newGiven.currency,
      description: newGiven.description.trim(),
      date: newGiven.date,
    }

    const next = [...given, entry]
    setGiven(next)
    save(toGive, next)
    setNewGiven({ amount: "", currency: "PKR", description: "", date: new Date().toISOString().split("T")[0] })
    setAddGivenOpen(false)
  }

  const removeToGive = (id: string) => {
    const next = toGive.filter((e) => e.id !== id)
    setToGive(next)
    save(next, given)
  }

  const removeGiven = (id: string) => {
    const next = given.filter((e) => e.id !== id)
    setGiven(next)
    save(toGive, next)
  }

  if (isLoading) {
    return <LoadingScreen message="Loading zakat..." />
  }

  return (
    <div className="min-h-screen bg-gradient-neon flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Heart className="h-7 w-7" />
                Zakat
              </h1>
              <p className="text-gray-400 mt-1">Track pending zakat and zakat given</p>
            </div>
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
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Pending (To Give)</CardDescription>
                <CardTitle className="text-2xl font-bold text-amber-400">
                  {formatCurrency(toDisplay(totalToGivePkr))}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Given</CardDescription>
                <CardTitle className="text-2xl font-bold text-green-400">
                  {formatCurrency(toDisplay(totalGivenPkr))}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Balance (Left to Give)</CardDescription>
                <CardTitle className={`text-2xl font-bold ${balancePkr > 0 ? "text-white" : "text-green-400"}`}>
                  {formatCurrency(toDisplay(Math.max(0, balancePkr)))}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Zakat To Give */}
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Zakat To Give
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Pending zakat to distribute
                  </CardDescription>
                </div>
                <Dialog open={addToGiveOpen} onOpenChange={setAddToGiveOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add Zakat To Give</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label className="text-gray-300">Amount</Label>
                        <Input
                          type="number"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          placeholder="0"
                          value={newToGive.amount}
                          onChange={(e) => setNewToGive({ ...newToGive, amount: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Currency</Label>
                        <Select
                          value={newToGive.currency}
                          onValueChange={(v: "PKR" | "USD") => setNewToGive({ ...newToGive, currency: v })}
                        >
                          <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="PKR">PKR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-300">Description</Label>
                        <Textarea
                          className="bg-gray-700/60 border-gray-600 text-white mt-1 resize-none"
                          placeholder="e.g. Zakat for 2024 - calculated from assets"
                          rows={3}
                          value={newToGive.description}
                          onChange={(e) => setNewToGive({ ...newToGive, description: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Date</Label>
                        <Input
                          type="date"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={newToGive.date}
                          onChange={(e) => setNewToGive({ ...newToGive, date: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        className="bg-amber-500 hover:bg-amber-600"
                        onClick={addToGiveEntry}
                      >
                        Add
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {toGive.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No entries yet. Add zakat you need to give.</p>
              ) : (
                <div className="space-y-2">
                  {toGive.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start justify-between py-3 px-3 rounded-lg bg-gray-700/30 border border-gray-600/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">
                            {formatCurrency(toDisplay(toPkr(e.amount, e.currency)))}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {e.currency} • {new Date(e.date).toLocaleDateString()}
                          </span>
                        </div>
                        {e.description && (
                          <p className="text-gray-400 text-sm mt-1">{e.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8 shrink-0"
                        onClick={() => removeToGive(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Zakat Given */}
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Send className="h-5 w-5" />
                    Zakat Given
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    Zakat you have distributed
                  </CardDescription>
                </div>
                <Dialog open={addGivenOpen} onOpenChange={setAddGivenOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="bg-green-500 hover:bg-green-600">
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-gray-800 border-gray-700">
                    <DialogHeader>
                      <DialogTitle className="text-white">Add Zakat Given</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div>
                        <Label className="text-gray-300">Amount</Label>
                        <Input
                          type="number"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          placeholder="0"
                          value={newGiven.amount}
                          onChange={(e) => setNewGiven({ ...newGiven, amount: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Currency</Label>
                        <Select
                          value={newGiven.currency}
                          onValueChange={(v: "PKR" | "USD") => setNewGiven({ ...newGiven, currency: v })}
                        >
                          <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="PKR">PKR</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-gray-300">Description</Label>
                        <Textarea
                          className="bg-gray-700/60 border-gray-600 text-white mt-1 resize-none"
                          placeholder="e.g. Donated to local mosque"
                          rows={3}
                          value={newGiven.description}
                          onChange={(e) => setNewGiven({ ...newGiven, description: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Date</Label>
                        <Input
                          type="date"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={newGiven.date}
                          onChange={(e) => setNewGiven({ ...newGiven, date: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        className="bg-green-500 hover:bg-green-600"
                        onClick={addGivenEntry}
                      >
                        Add
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {given.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No entries yet. Add zakat you have given.</p>
              ) : (
                <div className="space-y-2">
                  {given.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start justify-between py-3 px-3 rounded-lg bg-gray-700/30 border border-gray-600/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-white font-semibold">
                            {formatCurrency(toDisplay(toPkr(e.amount, e.currency)))}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {e.currency} • {new Date(e.date).toLocaleDateString()}
                          </span>
                        </div>
                        {e.description && (
                          <p className="text-gray-400 text-sm mt-1">{e.description}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8 shrink-0"
                        onClick={() => removeGiven(e.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {isSaving && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          Saving...
        </div>
      )}
    </div>
  )
}
