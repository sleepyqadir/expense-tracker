import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import crypto from "crypto"
import { authOptions } from "@/auth"

type BinanceBalance = {
  asset: string
  free: string
  locked: string
  total: number
  usdtValue: number | null
}

function signQuery(query: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(query).digest("hex")
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized", requiresAuth: true }, { status: 401 })
    }

    const apiKey = process.env.BINANCE_API_KEY
    const apiSecret = process.env.BINANCE_API_SECRET

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ configured: false, balances: [], totalUsd: 0 })
    }

    const timestamp = Date.now()
    const recvWindow = 10000
    const query = `timestamp=${timestamp}&recvWindow=${recvWindow}`
    const signature = signQuery(query, apiSecret)

    const accountRes = await fetch(
      `https://api.binance.com/api/v3/account?${query}&signature=${signature}`,
      {
        headers: { "X-MBX-APIKEY": apiKey },
        cache: "no-store",
      }
    )

    if (!accountRes.ok) {
      const errorData = await accountRes.json().catch(() => ({}))
      return NextResponse.json(
        {
          configured: true,
          error: "Failed to fetch Binance balances",
          details: errorData?.msg || "Unknown Binance error",
        },
        { status: accountRes.status }
      )
    }

    const accountData = await accountRes.json()
    const rawBalances = Array.isArray(accountData?.balances) ? accountData.balances : []

    const nonZeroBalances = rawBalances
      .map((b: { asset: string; free: string; locked: string }) => {
        const free = Number(b.free || 0)
        const locked = Number(b.locked || 0)
        return {
          asset: b.asset,
          free: b.free,
          locked: b.locked,
          total: free + locked,
        }
      })
      .filter((b: { total: number }) => b.total > 0)

    const pricesRes = await fetch("https://api.binance.com/api/v3/ticker/price", {
      cache: "no-store",
    })
    const pricesData = pricesRes.ok ? await pricesRes.json() : []
    const priceMap: Record<string, number> = {}
    if (Array.isArray(pricesData)) {
      for (const item of pricesData) {
        if (item?.symbol && item?.price) {
          priceMap[item.symbol] = Number(item.price)
        }
      }
    }

    const balances: BinanceBalance[] = nonZeroBalances.map(
      (b: { asset: string; free: string; locked: string; total: number }) => {
        if (b.asset === "USDT" || b.asset === "USDC" || b.asset === "BUSD") {
          return { ...b, usdtValue: b.total }
        }
        const symbol = `${b.asset}USDT`
        const price = priceMap[symbol]
        return { ...b, usdtValue: Number.isFinite(price) ? b.total * price : null }
      }
    )

    const totalUsd = balances.reduce((sum, b) => sum + (b.usdtValue || 0), 0)

    return NextResponse.json({
      configured: true,
      balances,
      totalUsd,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Binance balance error:", error)
    return NextResponse.json({ error: "Failed to fetch Binance balances" }, { status: 500 })
  }
}
