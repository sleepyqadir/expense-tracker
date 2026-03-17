import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { findOrCreateFile, readFile, updateFile, AuthenticationError } from "@/lib/drive"

const ZAKAT_FILE_NAME = "expense-tracker-zakat.json"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const fileId = await findOrCreateFile(
      session.accessToken as string,
      ZAKAT_FILE_NAME,
      JSON.stringify({ toGive: [], given: [] }, null, 2)
    )

    const content = await readFile(session.accessToken as string, fileId)
    let data = { toGive: [], given: [] }
    try {
      const parsed = JSON.parse(content)
      data = {
        toGive: Array.isArray(parsed.toGive) ? parsed.toGive : [],
        given: Array.isArray(parsed.given) ? parsed.given : [],
      }
    } catch {
      // use defaults
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
    console.error("Error loading zakat:", error)
    return NextResponse.json(
      { error: "Failed to load zakat" },
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
    console.error("Error saving zakat:", error)
    return NextResponse.json(
      { error: "Failed to save zakat" },
      { status: 500 }
    )
  }
}
