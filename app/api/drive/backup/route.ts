import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { findFilesByPattern, readFile, createBackupFile } from "@/lib/drive"
import { getMonthKey, getBackupFileName, getWeekNumber } from "@/lib/file-utils"

/**
 * Creates weekly backups of all monthly expense files
 * This endpoint can be called manually or scheduled
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessToken = session.accessToken as string

    // Find all monthly expense files (not backups)
    const files = await findFilesByPattern(accessToken, "expense-tracker-expenses-")
    const monthlyFiles = files.filter(
      (file) => file.name.match(/^expense-tracker-expenses-\d{4}-\d{2}\.json$/) && !file.name.includes("backup")
    )

    const currentMonthKey = getMonthKey()
    const weekNumber = getWeekNumber()
    const backupsCreated: string[] = []

    // Create backups for all monthly files
    for (const file of monthlyFiles) {
      try {
        const content = await readFile(accessToken, file.id)
        const monthKey = file.name.match(/expense-tracker-expenses-(\d{4}-\d{2})\.json$/)?.[1]
        
        if (monthKey) {
          const backupFileName = getBackupFileName(monthKey, weekNumber)
          await createBackupFile(accessToken, backupFileName, content)
          backupsCreated.push(backupFileName)
        }
      } catch (error) {
        console.error(`Error creating backup for ${file.name}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      backupsCreated,
      message: `Created ${backupsCreated.length} backup file(s)`,
    })
  } catch (error) {
    console.error("Error creating backups:", error)
    return NextResponse.json(
      { error: "Failed to create backups" },
      { status: 500 }
    )
  }
}
