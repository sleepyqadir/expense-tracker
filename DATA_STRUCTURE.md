# Data Structure Documentation

## File Organization

### Monthly Expense Files

Expenses are automatically organized into monthly files for better organization and performance:

- **Format**: `expense-tracker-expenses-YYYY-MM.json`
- **Examples**:
  - `expense-tracker-expenses-2025-01.json` (January 2025)
  - `expense-tracker-expenses-2025-02.json` (February 2025)
  - `expense-tracker-expenses-2025-03.json` (March 2025)

### Weekly Backup Files

Automatic weekly backups are created to prevent data loss:

- **Format**: `expense-tracker-expenses-backup-YYYY-MM-weekW-DD.json`
- **Examples**:
  - `expense-tracker-expenses-backup-2025-01-week3-15.json` (Week 3 backup from Jan 15)
  - `expense-tracker-expenses-backup-2025-02-week7-28.json` (Week 7 backup from Feb 28)

### Category File

Categories are stored in a single file (updated less frequently):

- **Format**: `expense-tracker-categories.json`

## JSON Structure

### Why JSON?

JSON (JavaScript Object Notation) is an excellent choice for this application because:

1. **Human-readable**: You can open and read the files directly
2. **Easy to parse**: Native support in JavaScript/TypeScript
3. **Lightweight**: Smaller file size compared to XML
4. **Portable**: Can be easily imported/exported
5. **Structured**: Maintains data relationships clearly
6. **Version control friendly**: Easy to track changes

### Expense File Structure

Each monthly expense file contains an array of expense objects:

```json
[
  {
    "id": "1709654400000",
    "amount": 45.99,
    "currency": "USD",
    "description": "Grocery Shopping",
    "category": "Food",
    "date": "2025-03-05",
    "person": "John"
  },
  {
    "id": "1709568000000",
    "amount": 12.5,
    "currency": "USD",
    "description": "Bus Ticket",
    "category": "Transport",
    "date": "2025-03-04",
    "person": "Sarah"
  }
]
```

### Category File Structure

The categories file contains an array of category objects:

```json
[
  {
    "name": "Food",
    "color": "bg-orange-500"
  },
  {
    "name": "Transport",
    "color": "bg-gray-600"
  },
  {
    "name": "Medical",
    "color": "bg-red-500"
  }
]
```

### Field Descriptions

#### Expense Object
- `id`: Unique identifier (timestamp-based)
- `amount`: Expense amount (number)
- `currency`: Either "USD" or "PKR"
- `description`: Description of the expense
- `category`: Category name (must match a category in categories file)
- `date`: Date in ISO format (YYYY-MM-DD)
- `person`: Person name or "No-one" for general expenses

#### Category Object
- `name`: Category name (unique)
- `color`: Tailwind CSS color class for UI display

## Backup Strategy

### Automatic Backups

1. **Weekly Backups**: Created automatically when saving expenses for the current month
2. **Manual Backups**: Can be triggered via API endpoint `/api/drive/backup`
3. **Backup Retention**: All backups are kept in Google Drive (you can manually delete old ones)

### Restoring from Backup

To restore from a backup:

1. Open the backup file in Google Drive
2. Copy its contents
3. Replace the corresponding monthly file's contents
4. The app will automatically load the restored data on next refresh

## Data Loading

When the app loads:

1. **All Monthly Files**: The app automatically finds and loads all monthly expense files
2. **Merged View**: All expenses from all months are merged and displayed
3. **Current Month**: New expenses are saved to the current month's file
4. **Automatic Organization**: Expenses are automatically sorted into the correct monthly file based on their date

## File Management

### Automatic File Creation

- Monthly files are created automatically when the first expense for that month is added
- No manual file creation needed

### File Naming Convention

- **Monthly files**: `expense-tracker-expenses-YYYY-MM.json`
- **Backup files**: `expense-tracker-expenses-backup-YYYY-MM-weekW-DD.json`
- **Category file**: `expense-tracker-categories.json`

All files are stored in your Google Drive root directory.

## Benefits of This Structure

1. **Performance**: Loading only necessary months improves performance
2. **Organization**: Easy to find expenses by month
3. **Scalability**: Large datasets are split across multiple files
4. **Backup Safety**: Weekly backups ensure data recovery
5. **Human-Friendly**: JSON format is easy to read and edit manually if needed

## Migration Notes

If you have an existing single expense file, the system will:
- Automatically detect and load it
- Organize expenses into monthly files when you save
- Preserve all existing data
