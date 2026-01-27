/**
 * Utility functions for file naming and date handling
 */

export function getMonthKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

export function getExpensesFileName(monthKey: string): string {
  return `expense-tracker-expenses-${monthKey}.json`
}

export function getBackupFileName(monthKey: string, weekNumber: number): string {
  const date = new Date()
  const day = String(date.getDate()).padStart(2, "0")
  return `expense-tracker-expenses-backup-${monthKey}-week${weekNumber}-${day}.json`
}

export function getWeekNumber(date: Date = new Date()): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1)
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000))
  return Math.ceil((days + startOfYear.getDay() + 1) / 7)
}

export function parseMonthKey(fileName: string): string | null {
  const match = fileName.match(/expense-tracker-expenses-(\d{4}-\d{2})\.json$/)
  return match ? match[1] : null
}

export function getAllMonthKeys(expenses: Array<{ date: string }>): string[] {
  const monthKeys = new Set<string>()
  expenses.forEach((expense) => {
    const date = new Date(expense.date)
    monthKeys.add(getMonthKey(date))
  })
  return Array.from(monthKeys).sort()
}
