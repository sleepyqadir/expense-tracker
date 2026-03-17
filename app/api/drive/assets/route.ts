import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { findOrCreateFile, readFile, updateFile, AuthenticationError } from "@/lib/drive"

const ASSETS_FILE_NAME = "expense-tracker-assets.json"

const DEFAULT_ASSETS = {
  settings: {
    goldPricePerTola: 220000,
    goldPricePerGram: 18868,
    silverPricePerTola: 2500,
    silverPricePerGram: 214,
    goldUnit: "tola" as const,
    silverUnit: "tola" as const,
  },
  holdings: [],
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const fileId = await findOrCreateFile(
      session.accessToken as string,
      ASSETS_FILE_NAME,
      JSON.stringify(DEFAULT_ASSETS, null, 2)
    )

    const content = await readFile(session.accessToken as string, fileId)
    let data = DEFAULT_ASSETS
    try {
      data = JSON.parse(content)
      if (!data.settings) data.settings = DEFAULT_ASSETS.settings
      if (!data.holdings) data.holdings = []
    } catch {
      // use defaults if parse fails
    }

    return NextResponse.json({
      fileId,
      data,
    })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Session expired. Please log in again.", requiresAuth: true },
        { status: 401 }
      )
    }
    console.error("Error loading assets:", error)
    return NextResponse.json(
      { error: "Failed to load assets" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { fileId, data } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 })
    }

    await updateFile(
      session.accessToken as string,
      fileId,
      JSON.stringify(data, null, 2)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Session expired. Please log in again.", requiresAuth: true },
        { status: 401 }
      )
    }
    console.error("Error saving assets:", error)
    return NextResponse.json(
      { error: "Failed to save assets" },
      { status: 500 }
    )
  }
}
