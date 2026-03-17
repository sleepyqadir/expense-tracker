import { NextRequest, NextResponse } from "next/server"

// Frankfurter API - free, no API key, ECB reference rates
// Supports: USD, EUR, GBP, CHF, JPY, AUD, CAD, etc. (no PKR)
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const base = searchParams.get("base") || "USD"
    const currencies = searchParams.get("currencies") || "EUR,GBP,CHF"

    const url = `${FRANKFURTER_URL}?base=${base}&symbols=${currencies}`
    const res = await fetch(url, { next: { revalidate: 3600 } }) // cache 1 hour

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: err.message || "Failed to fetch rates" },
        { status: res.status }
      )
    }

    const data = await res.json()

    return NextResponse.json({
      base: data.base,
      rates: data.rates || {},
      date: data.date,
    })
  } catch (error) {
    console.error("Exchange rates error:", error)
    return NextResponse.json(
      { error: "Failed to fetch exchange rates" },
      { status: 500 }
    )
  }
}
