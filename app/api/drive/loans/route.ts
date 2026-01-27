import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { findOrCreateFile, readFile, updateFile, AuthenticationError } from "@/lib/drive"

const LOANS_FILE_NAME = "expense-tracker-loans.json"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const fileId = await findOrCreateFile(
      session.accessToken as string,
      LOANS_FILE_NAME,
      JSON.stringify([], null, 2)
    )

    const content = await readFile(session.accessToken as string, fileId)

    return NextResponse.json({
      fileId,
      data: JSON.parse(content),
    })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Session expired. Please log in again.", requiresAuth: true },
        { status: 401 }
      )
    }
    console.error("Error loading loans:", error)
    return NextResponse.json(
      { error: "Failed to load loans" },
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

    const { fileId, loans } = await request.json()

    if (!fileId) {
      return NextResponse.json({ error: "File ID is required" }, { status: 400 })
    }

    await updateFile(
      session.accessToken as string,
      fileId,
      JSON.stringify(loans, null, 2)
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Session expired. Please log in again.", requiresAuth: true },
        { status: 401 }
      )
    }
    console.error("Error saving loans:", error)
    return NextResponse.json(
      { error: "Failed to save loans" },
      { status: 500 }
    )
  }
}
