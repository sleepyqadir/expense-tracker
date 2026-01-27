import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { findOrCreateFile, readFile, updateFile, findFilesByPattern, AuthenticationError } from "@/lib/drive"
import { getMonthKey, getExpensesFileName, parseMonthKey } from "@/lib/file-utils"

// Load all expenses from all monthly files
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const accessToken = session.accessToken as string

    // Find all monthly expense files
    const files = await findFilesByPattern(accessToken, "expense-tracker-expenses-")
    
    // Filter to only monthly files (not backups)
    const monthlyFiles = files.filter(
      (file) => file.name.match(/^expense-tracker-expenses-\d{4}-\d{2}\.json$/) && !file.name.includes("backup")
    )

    // Load and merge all expenses from all monthly files
    const allExpenses: any[] = []
    const fileMap: Record<string, string> = {} // monthKey -> fileId

    for (const file of monthlyFiles) {
      try {
        const monthKey = parseMonthKey(file.name)
        if (monthKey) {
          fileMap[monthKey] = file.id
          const content = await readFile(accessToken, file.id)
          const expenses = JSON.parse(content)
          if (Array.isArray(expenses)) {
            allExpenses.push(...expenses)
          }
        }
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error)
      }
    }

    // Get current month file ID (create if doesn't exist)
    const currentMonthKey = getMonthKey()
    const currentFileName = getExpensesFileName(currentMonthKey)
    
    if (!fileMap[currentMonthKey]) {
      const fileId = await findOrCreateFile(
        accessToken,
        currentFileName,
        JSON.stringify([], null, 2)
      )
      fileMap[currentMonthKey] = fileId
    }

    return NextResponse.json({
      fileMap,
      currentMonthKey,
      currentFileId: fileMap[currentMonthKey],
      data: allExpenses,
    })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Session expired. Please log in again.", requiresAuth: true },
        { status: 401 }
      )
    }
    console.error("Error loading expenses:", error)
    return NextResponse.json(
      { error: "Failed to load expenses" },
      { status: 500 }
    )
  }
}

// Save expenses to the appropriate monthly file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { expenses, fileMap } = await request.json()

    if (!expenses || !Array.isArray(expenses)) {
      return NextResponse.json({ error: "Invalid expenses data" }, { status: 400 })
    }

    const accessToken = session.accessToken as string

    // Group expenses by month
    const expensesByMonth: Record<string, any[]> = {}
    
    expenses.forEach((expense: any) => {
      const monthKey = getMonthKey(new Date(expense.date))
      if (!expensesByMonth[monthKey]) {
        expensesByMonth[monthKey] = []
      }
      expensesByMonth[monthKey].push(expense)
    })

    // Save each month's expenses to its respective file
    const currentMonthKey = getMonthKey()
    const savedFiles: Record<string, string> = {}

    for (const [monthKey, monthExpenses] of Object.entries(expensesByMonth)) {
      const fileName = getExpensesFileName(monthKey)
      let fileId = fileMap?.[monthKey]

      if (!fileId) {
        // Create new monthly file
        fileId = await findOrCreateFile(
          accessToken,
          fileName,
          JSON.stringify([], null, 2)
        )
      }

      // Save expenses to the monthly file
      await updateFile(
        accessToken,
        fileId,
        JSON.stringify(monthExpenses, null, 2)
      )

      savedFiles[monthKey] = fileId

      // Backup feature paused - will be re-enabled later
      // if (monthKey === currentMonthKey) {
      //   const weekNumber = getWeekNumber()
      //   const backupFileName = getBackupFileName(monthKey, weekNumber)
      //   
      //   try {
      //     await createBackupFile(
      //       accessToken,
      //       backupFileName,
      //       JSON.stringify(monthExpenses, null, 2)
      //     )
      //   } catch (error) {
      //     console.error("Error creating backup:", error)
      //     // Don't fail the main save if backup fails
      //   }
      // }
    }

    return NextResponse.json({ 
      success: true,
      savedFiles 
    })
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json(
        { error: "Session expired. Please log in again.", requiresAuth: true },
        { status: 401 }
      )
    }
    console.error("Error saving expenses:", error)
    return NextResponse.json(
      { error: "Failed to save expenses" },
      { status: 500 }
    )
  }
}
