import { NextResponse } from "next/server"

// CoinGecko API - free, no API key, top 10 tokens
const COINGECKO_IDS = [
  "bitcoin",
  "ethereum",
  "solana",
  "tether",
  "binancecoin",
  "arbitrum",
  "optimism",
  "usd-coin",
  "polygon-ecosystem-token",
].join(",")

const TOKEN_TO_ID: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDT: "tether",
  BNB: "binancecoin",
  ARB: "arbitrum",
  OP: "optimism",
  USDC: "usd-coin",
  POL: "polygon-ecosystem-token",
}

const ID_TO_TOKEN: Record<string, string> = Object.fromEntries(
  Object.entries(TOKEN_TO_ID).map(([k, v]) => [v, k])
)

export async function GET() {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${COINGECKO_IDS}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch crypto prices" },
        { status: res.status }
      )
    }

    const data = await res.json()

    const prices: Record<string, number> = {}
    for (const [id, value] of Object.entries(data as Record<string, { usd: number }>)) {
      const token = ID_TO_TOKEN[id]
      if (token && value?.usd != null) {
        prices[token] = value.usd
      }
    }

    return NextResponse.json({ prices })
  } catch (error) {
    console.error("Crypto prices error:", error)
    return NextResponse.json(
      { error: "Failed to fetch crypto prices" },
      { status: 500 }
    )
  }
}
