"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  Plus,
  Trash2,
  Settings2,
  Coins,
  Landmark,
  Banknote,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import { LoadingScreen } from "@/components/loading-screen"
import { useToast } from "@/hooks/use-toast"

const USD_TO_PKR = 280
const TOLA_TO_GRAM = 11.6638

// Frankfurter supports: EUR, GBP, CHF, JPY, AUD, CAD, CNY, INR, MYR, etc. AED/SAR/AZN need manual rate.
const FRANKFURTER_CURRENCIES = [
  "EUR",
  "GBP",
  "CHF",
  "JPY",
  "AUD",
  "CAD",
  "CNY",
  "INR",
  "SGD",
  "MYR",  // Ringgit (Malaysian)
  "AZN",  // Manat (Azerbaijani)
  "AED",
  "SAR",
]

const CRYPTO_TOKENS = ["BTC", "ETH", "SOL", "USDT", "BNB", "ARB", "OP", "USDC", "POL"] as const

type AssetSettings = {
  goldPricePerTola: number
  goldPricePerGram: number
  silverPricePerTola: number
  silverPricePerGram: number
  goldUnit: "tola" | "gram"
  silverUnit: "tola" | "gram"
}

type GoldAsset = { id: string; category: "gold"; amount: number; unit: "tola" | "gram" }
type SilverAsset = { id: string; category: "silver"; amount: number; unit: "tola" | "gram" }
type CashAsset = { id: string; category: "cash"; amount: number; currency: "PKR" | "USD" }
type AlMeezanAsset = { id: string; category: "al_meezan"; amount: number }
type CurrencyAsset = {
  id: string
  category: "currency"
  currency: string
  amount: number
  type: "cash" | "in_bank"
  manualRate?: number
}

type CryptoAsset = {
  id: string
  category: "crypto"
  token: string
  amount: number
}

type Asset = GoldAsset | SilverAsset | CashAsset | AlMeezanAsset | CurrencyAsset | CryptoAsset

type Loan = {
  id: string
  amount: number
  currency: "USD" | "PKR"
  type: "given" | "taken"
  cleared?: boolean
}

type BinanceBalance = {
  asset: string
  free: string
  locked: string
  total: number
  usdtValue: number | null
}

export default function AssetsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [assets, setAssets] = useState<{
    settings: AssetSettings
    holdings: Asset[]
  }>({
    settings: {
      goldPricePerTola: 220000,
      goldPricePerGram: 18868,
      silverPricePerTola: 2500,
      silverPricePerGram: 214,
      goldUnit: "tola",
      silverUnit: "tola",
    },
    holdings: [],
  })
  const [assetsFileId, setAssetsFileId] = useState<string | null>(null)
  const [loans, setLoans] = useState<Loan[]>([])
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({})
  const [binanceBalances, setBinanceBalances] = useState<BinanceBalance[]>([])
  const [binanceTotalUsd, setBinanceTotalUsd] = useState(0)
  const [binanceConfigured, setBinanceConfigured] = useState(false)
  const [binanceLoading, setBinanceLoading] = useState(false)
  const [usdToPkr, setUsdToPkr] = useState(USD_TO_PKR)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "PKR">("PKR")
  const [settingsOpen, setSettingsOpen] = useState(false)
  const hasLoadedRef = useRef(false)

  const { toast } = useToast()

  const handleApiError = async (response: Response) => {
    if (response.status === 401) {
      const err = await response.json().catch(() => ({}))
      if (err.requiresAuth) {
        toast({
          title: "Session expired",
          description: "Please sign in with Google again to view your assets.",
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
        const [assetsRes, loansRes] = await Promise.all([
          fetch("/api/drive/assets"),
          fetch("/api/drive/loans"),
        ])
        if (await handleApiError(assetsRes)) return
        if (await handleApiError(loansRes)) return

        if (assetsRes.ok) {
          const d = await assetsRes.json()
          setAssetsFileId(d.fileId)
          setAssets(d.data)
        }
        if (loansRes.ok) {
          const d = await loansRes.json()
          setLoans((d.data || []).filter((l: Loan) => !l.cleared))
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

  const fetchBinanceBalances = async () => {
    try {
      setBinanceLoading(true)
      const res = await fetch("/api/binance/balance", { cache: "no-store" })
      if (await handleApiError(res)) return
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.details || err?.error || "Failed to fetch Binance balances")
      }
      const data = await res.json()
      setBinanceConfigured(Boolean(data.configured))
      setBinanceBalances(Array.isArray(data.balances) ? data.balances : [])
      setBinanceTotalUsd(Number(data.totalUsd || 0))
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load Binance balances"
      toast({
        title: "Binance sync failed",
        description: message,
      })
    } finally {
      setBinanceLoading(false)
    }
  }

  useEffect(() => {
    if (!session) return
    fetchBinanceBalances()
  }, [session])

  const currencyHoldings = assets.holdings.filter(
    (h): h is CurrencyAsset => h.category === "currency"
  )
  const currencyCodes = [...new Set(currencyHoldings.map((h) => h.currency))].filter(
    (c) => c !== "USD" && c !== "PKR"
  )

  useEffect(() => {
    if (currencyCodes.length === 0) return

    const fetchRates = async () => {
      try {
        const res = await fetch(
          `/api/exchange-rates?base=USD&currencies=${currencyCodes.join(",")}`
        )
        if (res.ok) {
          const d = await res.json()
          setExchangeRates(d.rates || {})
        }
      } catch (e) {
        console.error("Failed to fetch rates", e)
      }
    }

    fetchRates()
  }, [currencyCodes.join(",")])

  const cryptoHoldings = assets.holdings.filter(
    (h): h is CryptoAsset => h.category === "crypto"
  )
  const hasCrypto = cryptoHoldings.length > 0

  useEffect(() => {
    if (!hasCrypto) return

    const fetchCrypto = async () => {
      try {
        const res = await fetch("/api/crypto-prices")
        if (res.ok) {
          const d = await res.json()
          setCryptoPrices(d.prices || {})
        }
      } catch (e) {
        console.error("Failed to fetch crypto prices", e)
      }
    }

    fetchCrypto()
  }, [hasCrypto])

  const saveAssets = async () => {
    if (!assetsFileId || isSaving) return
    setIsSaving(true)
    try {
      const res = await fetch("/api/drive/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: assetsFileId, data: assets }),
      })
      if (await handleApiError(res)) return
    } catch (e) {
      console.error(e)
    } finally {
      setIsSaving(false)
    }
  }

  const addHolding = (holding: Asset) => {
    const next = {
      ...assets,
      holdings: [...assets.holdings, { ...holding, id: crypto.randomUUID() }],
    }
    setAssets(next)
    if (assetsFileId) {
      fetch("/api/drive/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: assetsFileId, data: next }),
      }).then(() => {})
    }
  }

  const removeHolding = (id: string) => {
    const next = {
      ...assets,
      holdings: assets.holdings.filter((h) => h.id !== id),
    }
    setAssets(next)
    if (assetsFileId) {
      fetch("/api/drive/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: assetsFileId, data: next }),
      }).then(() => {})
    }
  }

  const updateSettings = (updates: Partial<AssetSettings>) => {
    const next = { ...assets, settings: { ...assets.settings, ...updates } }
    setAssets(next)
    if (assetsFileId) {
      fetch("/api/drive/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: assetsFileId, data: next }),
      }).then(() => {})
    }
  }

  const updateHolding = (id: string, updates: Partial<Asset>) => {
    const next = {
      ...assets,
      holdings: assets.holdings.map((h) =>
        h.id === id ? { ...h, ...updates } : h
      ),
    }
    setAssets(next)
    if (assetsFileId) {
      fetch("/api/drive/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId: assetsFileId, data: next }),
      }).then(() => {})
    }
  }

  const toDisplay = (amountPkr: number) =>
    displayCurrency === "PKR"
      ? amountPkr
      : amountPkr / usdToPkr

  const formatCurrency = (amount: number) =>
    displayCurrency === "USD"
      ? `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
      : `₨${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`

  const goldHoldings = assets.holdings.filter((h): h is GoldAsset => h.category === "gold")
  const silverHoldings = assets.holdings.filter((h): h is SilverAsset => h.category === "silver")
  const cashHoldings = assets.holdings.filter((h): h is CashAsset => h.category === "cash")
  const alMeezanHoldings = assets.holdings.filter(
    (h): h is AlMeezanAsset => h.category === "al_meezan"
  )

  const goldValue =
    goldHoldings.reduce((s, h) => {
      const price =
        h.unit === "tola"
          ? assets.settings.goldPricePerTola
          : assets.settings.goldPricePerGram
      return s + h.amount * price
    }, 0) / (displayCurrency === "USD" ? usdToPkr : 1)

  const silverValue =
    silverHoldings.reduce((s, h) => {
      const price =
        h.unit === "tola"
          ? assets.settings.silverPricePerTola
          : assets.settings.silverPricePerGram
      return s + h.amount * price
    }, 0) / (displayCurrency === "USD" ? usdToPkr : 1)

  const cashValuePkr = cashHoldings.reduce((s, h) => {
    if (h.currency === "PKR") return s + h.amount
    return s + h.amount * usdToPkr
  }, 0)

  const alMeezanValuePkr = alMeezanHoldings.reduce((s, h) => s + h.amount, 0)

  const currencyValuePkr = currencyHoldings.reduce((s, h) => {
    if (h.currency === "USD") return s + h.amount * usdToPkr
    if (h.currency === "PKR") return s + h.amount
    const rateUsdPerUnit = h.manualRate ?? exchangeRates[h.currency]
    if (rateUsdPerUnit && rateUsdPerUnit > 0) return s + (h.amount * usdToPkr) / rateUsdPerUnit
    return s
  }, 0)

  const cryptoValuePkr = cryptoHoldings.reduce((s, h) => {
    const priceUsd = cryptoPrices[h.token]
    if (priceUsd && priceUsd > 0) return s + h.amount * priceUsd * usdToPkr
    return s
  }, 0)

  const totalLoanGivenPkr = loans
    .filter((l) => l.type === "given")
    .reduce((s, l) => s + (l.currency === "PKR" ? l.amount : l.amount * usdToPkr), 0)

  const totalLoanTakenPkr = loans
    .filter((l) => l.type === "taken")
    .reduce((s, l) => s + (l.currency === "PKR" ? l.amount : l.amount * usdToPkr), 0)

  const totalAssetsPkr =
    goldHoldings.reduce((s, h) => {
      const price =
        h.unit === "tola"
          ? assets.settings.goldPricePerTola
          : assets.settings.goldPricePerGram
      return s + h.amount * price
    }, 0) +
    silverHoldings.reduce((s, h) => {
      const price =
        h.unit === "tola"
          ? assets.settings.silverPricePerTola
          : assets.settings.silverPricePerGram
      return s + h.amount * price
    }, 0) +
    cashValuePkr +
    alMeezanValuePkr +
    currencyValuePkr +
    cryptoValuePkr +
    binanceTotalUsd * usdToPkr +
    totalLoanGivenPkr

  const netAssetsPkr = totalAssetsPkr - totalLoanTakenPkr

  if (isLoading) {
    return <LoadingScreen message="Loading assets..." />
  }

  return (
    <div className="min-h-screen bg-gradient-neon flex flex-col">
      <div className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Assets</h1>
              <p className="text-gray-400 mt-1">Track your net worth</p>
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
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full gap-1 text-white hover:bg-gray-700/50"
                  >
                    <Settings2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Prices</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md bg-gray-800/95 border-gray-700/50">
                  <DialogHeader>
                    <DialogTitle className="text-white">Gold, Silver &amp; Rates</DialogTitle>
                    <p className="text-gray-400 text-sm">
                      Set prices and USD to PKR rate
                    </p>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-300">Gold (₨/tola)</Label>
                        <Input
                          type="number"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={assets.settings.goldPricePerTola}
                          onChange={(e) =>
                            updateSettings({
                              goldPricePerTola: Number(e.target.value) || 0,
                              goldPricePerGram: (Number(e.target.value) || 0) / TOLA_TO_GRAM,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Gold (₨/gram)</Label>
                        <Input
                          type="number"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={assets.settings.goldPricePerGram}
                          onChange={(e) =>
                            updateSettings({
                              goldPricePerGram: Number(e.target.value) || 0,
                              goldPricePerTola: (Number(e.target.value) || 0) * TOLA_TO_GRAM,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-gray-300">Silver (₨/tola)</Label>
                        <Input
                          type="number"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={assets.settings.silverPricePerTola}
                          onChange={(e) =>
                            updateSettings({
                              silverPricePerTola: Number(e.target.value) || 0,
                              silverPricePerGram: (Number(e.target.value) || 0) / TOLA_TO_GRAM,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300">Silver (₨/gram)</Label>
                        <Input
                          type="number"
                          className="bg-gray-700/60 border-gray-600 text-white mt-1"
                          value={assets.settings.silverPricePerGram}
                          onChange={(e) =>
                            updateSettings({
                              silverPricePerGram: Number(e.target.value) || 0,
                              silverPricePerTola: (Number(e.target.value) || 0) * TOLA_TO_GRAM,
                            })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-gray-300">USD to PKR rate</Label>
                      <Input
                        type="number"
                        className="bg-gray-700/60 border-gray-600 text-white mt-1"
                        value={usdToPkr}
                        onChange={(e) => setUsdToPkr(Number(e.target.value) || 280)}
                      />
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Total Assets</CardDescription>
                <CardTitle className="text-2xl font-bold text-white">
                  {formatCurrency(toDisplay(totalAssetsPkr))}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Total Loan Taken</CardDescription>
                <CardTitle className="text-2xl font-bold text-red-400">
                  -{formatCurrency(toDisplay(totalLoanTakenPkr))}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader className="pb-2">
                <CardDescription className="text-gray-400">Net Assets</CardDescription>
                <CardTitle className="text-2xl font-bold text-green-400">
                  {formatCurrency(toDisplay(netAssetsPkr))}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {/* Gold */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Gold
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formatCurrency(toDisplay(goldHoldings.reduce((s, h) => {
                  const p = h.unit === "tola" ? assets.settings.goldPricePerTola : assets.settings.goldPricePerGram
                  return s + h.amount * p
                }, 0)))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {goldHoldings.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 bg-gray-700/60 border-gray-600 text-white h-8"
                        value={h.amount}
                        onChange={(e) =>
                          updateHolding(h.id, { amount: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-gray-400 text-sm">{h.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {formatCurrency(
                          toDisplay(
                            h.amount *
                              (h.unit === "tola"
                                ? assets.settings.goldPricePerTola
                                : assets.settings.goldPricePerGram)
                          )
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8"
                        onClick={() => removeHolding(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <AddGoldDialog
                  onAdd={(amount, unit) =>
                    addHolding({
                      id: "",
                      category: "gold",
                      amount,
                      unit,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Silver */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Silver
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formatCurrency(toDisplay(silverHoldings.reduce((s, h) => {
                  const p = h.unit === "tola" ? assets.settings.silverPricePerTola : assets.settings.silverPricePerGram
                  return s + h.amount * p
                }, 0)))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {silverHoldings.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-24 bg-gray-700/60 border-gray-600 text-white h-8"
                        value={h.amount}
                        onChange={(e) =>
                          updateHolding(h.id, { amount: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-gray-400 text-sm">{h.unit}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {formatCurrency(
                          toDisplay(
                            h.amount *
                              (h.unit === "tola"
                                ? assets.settings.silverPricePerTola
                                : assets.settings.silverPricePerGram)
                          )
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8"
                        onClick={() => removeHolding(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <AddSilverDialog
                  onAdd={(amount, unit) =>
                    addHolding({
                      id: "",
                      category: "silver",
                      amount,
                      unit,
                    })
                  }
                />
              </div>
            </CardContent>
          </Card>

          {/* Cash */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Banknote className="h-5 w-5" />
                Cash
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formatCurrency(toDisplay(cashValuePkr))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cashHoldings.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        className="w-28 bg-gray-700/60 border-gray-600 text-white h-8"
                        value={h.amount}
                        onChange={(e) =>
                          updateHolding(h.id, { amount: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-gray-400 text-sm">{h.currency}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">
                        {formatCurrency(
                          toDisplay(h.currency === "PKR" ? h.amount : h.amount * usdToPkr)
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8"
                        onClick={() => removeHolding(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <AddCashDialog onAdd={(amount, currency) => addHolding({ id: "", category: "cash", amount, currency })} />
              </div>
            </CardContent>
          </Card>

          {/* Al Meezan Investment */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                Al Meezan Investment
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formatCurrency(toDisplay(alMeezanValuePkr))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {alMeezanHoldings.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
                  >
                    <Input
                      type="number"
                      className="w-32 bg-gray-700/60 border-gray-600 text-white h-8"
                      value={h.amount}
                      onChange={(e) =>
                        updateHolding(h.id, { amount: Number(e.target.value) || 0 })
                      }
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium">{formatCurrency(toDisplay(h.amount))}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8"
                        onClick={() => removeHolding(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <AddAlMeezanDialog onAdd={(amount) => addHolding({ id: "", category: "al_meezan", amount })} />
              </div>
            </CardContent>
          </Card>

          {/* Currencies */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Currencies
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formatCurrency(toDisplay(currencyValuePkr))} • Rates from Frankfurter (USD base)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currencyHoldings.map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-700/50 last:border-0"
                  >
                    <Input
                      type="number"
                      className="w-24 bg-gray-700/60 border-gray-600 text-white h-8"
                      value={h.amount}
                      onChange={(e) =>
                        updateHolding(h.id, { amount: Number(e.target.value) || 0 })
                      }
                    />
                    <Select
                      value={h.currency}
                      onValueChange={(v) => updateHolding(h.id, { currency: v })}
                    >
                      <SelectTrigger className="w-24 h-8 bg-gray-700/60 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="PKR">PKR</SelectItem>
                        {FRANKFURTER_CURRENCIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={h.type}
                      onValueChange={(v: "cash" | "in_bank") => updateHolding(h.id, { type: v })}
                    >
                      <SelectTrigger className="w-28 h-8 bg-gray-700/60 border-gray-600 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="in_bank">In Bank</SelectItem>
                      </SelectContent>
                    </Select>
                    {h.currency !== "USD" && h.currency !== "PKR" && (
                      <Input
                        type="number"
                        placeholder="USD per 1"
                        title="Manual rate: USD per 1 unit (e.g. 1.08 for EUR)"
                        className="w-24 h-8 bg-gray-700/60 border-gray-600 text-white text-sm"
                        value={h.manualRate ?? ""}
                        onChange={(e) =>
                          updateHolding(h.id, {
                            manualRate: e.target.value ? Number(e.target.value) : undefined,
                          })
                        }
                      />
                    )}
                    <span className="text-white font-medium ml-auto">
                      {formatCurrency(
                        toDisplay(
                          h.currency === "USD"
                            ? h.amount * usdToPkr
                            : h.currency === "PKR"
                            ? h.amount
                            : (() => {
                                const r = h.manualRate ?? exchangeRates[h.currency]
                                return r && r > 0 ? (h.amount * usdToPkr) / r : 0
                              })()
                        )
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 h-8 w-8"
                      onClick={() => removeHolding(h.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <AddCurrencyDialog
                  onAdd={(currency, amount, type) =>
                    addHolding({
                      id: "",
                      category: "currency",
                      currency,
                      amount,
                      type,
                    })
                  }
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-400 border-gray-600"
                  onClick={() => {
                    const codes = [...new Set(currencyHoldings.map((h) => h.currency))].filter(
                      (c) => c !== "USD" && c !== "PKR"
                    )
                    if (codes.length === 0) return
                    fetch(`/api/exchange-rates?base=USD&currencies=${codes.join(",")}`)
                      .then((r) => r.json())
                      .then((d) => setExchangeRates(d.rates || {}))
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh rates
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Crypto */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Crypto
              </CardTitle>
              <CardDescription className="text-gray-400">
                {formatCurrency(toDisplay(cryptoValuePkr))} • Prices from CoinGecko
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {cryptoHoldings.map((h) => {
                  const priceUsd = cryptoPrices[h.token]
                  const valuePkr = priceUsd && priceUsd > 0 ? h.amount * priceUsd * usdToPkr : 0
                  return (
                    <div
                      key={h.id}
                      className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-700/50 last:border-0"
                    >
                      <Input
                        type="number"
                        className="w-24 bg-gray-700/60 border-gray-600 text-white h-8"
                        value={h.amount}
                        onChange={(e) =>
                          updateHolding(h.id, { amount: Number(e.target.value) || 0 })
                        }
                      />
                      <span className="text-gray-400 font-medium w-12">{h.token}</span>
                      {priceUsd && (
                        <span className="text-gray-500 text-xs">
                          ${priceUsd.toLocaleString(undefined, { maximumFractionDigits: 4 })}/ea
                        </span>
                      )}
                      <span className="text-white font-medium ml-auto">
                        {formatCurrency(toDisplay(valuePkr))}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 h-8 w-8"
                        onClick={() => removeHolding(h.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )
                })}
                <AddCryptoDialog
                  onAdd={(token, amount) =>
                    addHolding({ id: "", category: "crypto", token, amount })
                  }
                />
                {hasCrypto && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-gray-400 border-gray-600"
                    onClick={() =>
                      fetch("/api/crypto-prices")
                        .then((r) => r.json())
                        .then((d) => setCryptoPrices(d.prices || {}))
                    }
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh prices
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Binance Balances */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Landmark className="h-5 w-5" />
                    Binance (View Only)
                  </CardTitle>
                  <CardDescription className="text-gray-400">
                    {binanceConfigured
                      ? `${formatCurrency(toDisplay(binanceTotalUsd * usdToPkr))} • Read from Binance API`
                      : "Add BINANCE_API_KEY and BINANCE_API_SECRET in .env.local"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-gray-400 border-gray-600"
                  onClick={fetchBinanceBalances}
                  disabled={binanceLoading}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {binanceLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!binanceConfigured ? (
                <p className="text-gray-400 text-sm">
                  This uses a read-only Binance key and does not place any trades.
                </p>
              ) : binanceBalances.length === 0 ? (
                <p className="text-gray-400 text-sm">No non-zero balances found.</p>
              ) : (
                <div className="space-y-2">
                  {binanceBalances.map((b) => (
                    <div
                      key={b.asset}
                      className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium w-16">{b.asset}</span>
                        <span className="text-gray-400 text-sm">
                          {b.total.toLocaleString(undefined, { maximumFractionDigits: 8 })}
                        </span>
                      </div>
                      <span className="text-gray-300 text-sm">
                        {b.usdtValue != null
                          ? `~ $${b.usdtValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                          : "No USDT pair"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Total Loan Given (from Loans) */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Total Loan Given</CardTitle>
              <CardDescription className="text-gray-400">
                From Loans • {formatCurrency(toDisplay(totalLoanGivenPkr))}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 text-sm">
                This amount is included in Total Assets. Edit in the Loans page.
              </p>
            </CardContent>
          </Card>

          {/* Total Loan Taken (from Loans) */}
          <Card className="bg-gray-800/50 border-gray-700 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-white">Total Loan Taken</CardTitle>
              <CardDescription className="text-gray-400">
                From Loans • -{formatCurrency(toDisplay(totalLoanTakenPkr))} (subtracted from net)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400 text-sm">
                This amount is subtracted from Total Assets to get Net Assets. Edit in the Loans page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {isSaving && (
        <div className="fixed bottom-20 md:bottom-4 right-4 bg-gray-800 text-white px-3 py-2 rounded-lg shadow-lg text-sm">
          Saving...
        </div>
      )}
    </div>
  )
}

function AddGoldDialog({
  onAdd,
}: {
  onAdd: (amount: number, unit: "tola" | "gram") => void
}) {
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState<"tola" | "gram">("tola")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add Gold
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Gold</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-gray-300">Amount</Label>
            <Input
              type="number"
              className="bg-gray-700/60 border-gray-600 text-white mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-gray-300">Unit</Label>
            <Select value={unit} onValueChange={(v: "tola" | "gram") => setUnit(v)}>
              <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="tola">Tola</SelectItem>
                <SelectItem value="gram">Gram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              const n = Number(amount)
              if (n > 0) {
                onAdd(n, unit)
                setAmount("")
                setOpen(false)
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddSilverDialog({
  onAdd,
}: {
  onAdd: (amount: number, unit: "tola" | "gram") => void
}) {
  const [amount, setAmount] = useState("")
  const [unit, setUnit] = useState<"tola" | "gram">("tola")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add Silver
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Silver</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-gray-300">Amount</Label>
            <Input
              type="number"
              className="bg-gray-700/60 border-gray-600 text-white mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-gray-300">Unit</Label>
            <Select value={unit} onValueChange={(v: "tola" | "gram") => setUnit(v)}>
              <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="tola">Tola</SelectItem>
                <SelectItem value="gram">Gram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              const n = Number(amount)
              if (n > 0) {
                onAdd(n, unit)
                setAmount("")
                setOpen(false)
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddCashDialog({
  onAdd,
}: {
  onAdd: (amount: number, currency: "PKR" | "USD") => void
}) {
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<"PKR" | "USD">("PKR")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add Cash
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Cash</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-gray-300">Amount</Label>
            <Input
              type="number"
              className="bg-gray-700/60 border-gray-600 text-white mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-gray-300">Currency</Label>
            <Select value={currency} onValueChange={(v: "PKR" | "USD") => setCurrency(v)}>
              <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="PKR">PKR</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              const n = Number(amount)
              if (n > 0) {
                onAdd(n, currency)
                setAmount("")
                setOpen(false)
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddAlMeezanDialog({ onAdd }: { onAdd: (amount: number) => void }) {
  const [amount, setAmount] = useState("")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add Al Meezan
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Al Meezan Investment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-gray-300">Amount (PKR)</Label>
            <Input
              type="number"
              className="bg-gray-700/60 border-gray-600 text-white mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              const n = Number(amount)
              if (n > 0) {
                onAdd(n)
                setAmount("")
                setOpen(false)
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddCurrencyDialog({
  onAdd,
}: {
  onAdd: (currency: string, amount: number, type: "cash" | "in_bank") => void
}) {
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [type, setType] = useState<"cash" | "in_bank">("cash")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add Currency
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Currency Holding</DialogTitle>
          <CardDescription className="text-gray-400">
            Rates fetched from Frankfurter (USD base). PKR uses manual rate.
          </CardDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-gray-300">Amount</Label>
            <Input
              type="number"
              className="bg-gray-700/60 border-gray-600 text-white mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-gray-300">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="PKR">PKR</SelectItem>
                {FRANKFURTER_CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300">Type</Label>
            <Select value={type} onValueChange={(v: "cash" | "in_bank") => setType(v)}>
              <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="in_bank">In Bank</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-blue-500 hover:bg-blue-600"
            onClick={() => {
              const n = Number(amount)
              if (n > 0) {
                onAdd(currency, n, type)
                setAmount("")
                setOpen(false)
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AddCryptoDialog({
  onAdd,
}: {
  onAdd: (token: string, amount: number) => void
}) {
  const [amount, setAmount] = useState("")
  const [token, setToken] = useState("BTC")
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="border-gray-600 text-gray-400 w-full">
          <Plus className="h-4 w-4 mr-1" />
          Add Crypto
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-gray-800 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-white">Add Crypto</DialogTitle>
          <p className="text-gray-400 text-sm">
            Prices from CoinGecko. Top tokens: BTC, ETH, SOL, USDT, BNB, ARB, OP, USDC, POL
          </p>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div>
            <Label className="text-gray-300">Token</Label>
            <Select value={token} onValueChange={setToken}>
              <SelectTrigger className="bg-gray-700/60 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                {CRYPTO_TOKENS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300">Amount</Label>
            <Input
              type="number"
              className="bg-gray-700/60 border-gray-600 text-white mt-1"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-amber-500 hover:bg-amber-600"
            onClick={() => {
              const n = Number(amount)
              if (n > 0) {
                onAdd(token, n)
                setAmount("")
                setOpen(false)
              }
            }}
          >
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
