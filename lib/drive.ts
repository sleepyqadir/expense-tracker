import { google } from "googleapis"

export interface DriveFile {
  id: string
  name: string
}

// Custom error class for authentication errors
export class AuthenticationError extends Error {
  constructor(message: string = "Authentication failed. Please log in again.") {
    super(message)
    this.name = "AuthenticationError"
  }
}

// Helper function to check if an error is an authentication error
function isAuthenticationError(error: any): boolean {
  if (error?.code === 401) return true
  if (error?.status === 401) return true
  if (error?.response?.status === 401) return true
  if (error?.message?.toLowerCase().includes("invalid credentials")) return true
  if (error?.message?.toLowerCase().includes("unauthorized")) return true
  return false
}

// Helper function to handle errors and throw AuthenticationError if needed
function handleDriveError(error: any, operation: string): never {
  if (isAuthenticationError(error)) {
    console.error(`Authentication error in ${operation}:`, error)
    throw new AuthenticationError("Your session has expired. Please log in again.")
  }
  console.error(`Error in ${operation}:`, error)
  throw error
}

export async function findOrCreateFile(
  accessToken: string,
  fileName: string,
  initialContent: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: "v3", auth: oauth2Client })

  try {
    // Search for existing file
    const response = await drive.files.list({
      q: `name='${fileName}' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    })

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!
    }

    // Create new file if not found
    const fileMetadata = {
      name: fileName,
      mimeType: "application/json",
    }

    const media = {
      mimeType: "application/json",
      body: initialContent,
    }

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    })

    return file.data.id!
  } catch (error) {
    handleDriveError(error, "findOrCreateFile")
  }
}

export async function findFilesByPattern(
  accessToken: string,
  pattern: string
): Promise<DriveFile[]> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: "v3", auth: oauth2Client })

  try {
    const response = await drive.files.list({
      q: `name contains '${pattern}' and trashed=false`,
      fields: "files(id, name)",
      spaces: "drive",
    })

    return (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name!,
    }))
  } catch (error) {
    handleDriveError(error, "findFilesByPattern")
  }
}

export async function readFile(accessToken: string, fileId: string): Promise<string> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: "v3", auth: oauth2Client })

  try {
    const response = await drive.files.get(
      {
        fileId: fileId,
        alt: "media",
      },
      { responseType: "text" }
    )

    return response.data as string
  } catch (error) {
    handleDriveError(error, "readFile")
  }
}

export async function updateFile(
  accessToken: string,
  fileId: string,
  content: string
): Promise<void> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: "v3", auth: oauth2Client })

  try {
    await drive.files.update({
      fileId: fileId,
      media: {
        mimeType: "application/json",
        body: content,
      },
    })
  } catch (error) {
    handleDriveError(error, "updateFile")
  }
}

export async function createBackupFile(
  accessToken: string,
  fileName: string,
  content: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2()
  oauth2Client.setCredentials({ access_token: accessToken })

  const drive = google.drive({ version: "v3", auth: oauth2Client })

  try {
    const fileMetadata = {
      name: fileName,
      mimeType: "application/json",
    }

    const media = {
      mimeType: "application/json",
      body: content,
    }

    const file = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id",
    })

    return file.data.id!
  } catch (error) {
    handleDriveError(error, "createBackupFile")
  }
}
