import { googleFetch, googleFetchRaw } from './api-client'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  webViewLink?: string
  modifiedTime?: string
  owners?: Array<{ displayName: string; emailAddress: string }>
}

export interface DriveListResponse {
  files: DriveFile[]
  nextPageToken?: string
}

export interface DriveChange {
  fileId: string
  removed: boolean
  file?: DriveFile
}

export interface DriveChangesResponse {
  changes: DriveChange[]
  newPageToken: string
}

// ─── Google MIME type constants ───────────────────────────────────────────────

const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'
const GOOGLE_SLIDES_MIME = 'application/vnd.google-apps.presentation'
const GOOGLE_FOLDER_MIME = 'application/vnd.google-apps.folder'

// ─── Listing & Searching ─────────────────────────────────────────────────────

/**
 * Lists files in a user's Google Drive.
 *
 * @param connectionId - Nango connection ID.
 * @param orgId - Organization ID for ownership verification.
 * @param folderId - Optional folder to scope the listing to.
 * @param pageToken - Optional pagination token from a previous response.
 * @param pageSize - Number of results per page (default 50, max 1000).
 */
export async function listDriveFiles(
  connectionId: string,
  orgId: string,
  folderId?: string,
  pageToken?: string,
  pageSize: number = 50
): Promise<DriveListResponse> {
  const q = folderId
    ? `'${folderId}' in parents and trashed=false`
    : 'trashed=false'

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,owners),nextPageToken',
    pageSize: String(pageSize),
  })
  if (pageToken) params.set('pageToken', pageToken)

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  return googleFetch<DriveListResponse>(connectionId, orgId, url)
}

/**
 * Full-text search across a user's Google Drive.
 *
 * @param connectionId - Nango connection ID.
 * @param orgId - Organization ID for ownership verification.
 * @param query - The search string.
 * @param pageToken - Optional pagination token.
 */
export async function searchDrive(
  connectionId: string,
  orgId: string,
  query: string,
  pageToken?: string
): Promise<DriveListResponse> {
  const escapedQuery = query.replace(/'/g, "\\'")
  const q = `fullText contains '${escapedQuery}' and trashed=false`

  const params = new URLSearchParams({
    q,
    fields: 'files(id,name,mimeType,webViewLink,modifiedTime,owners),nextPageToken',
    pageSize: '20',
  })
  if (pageToken) params.set('pageToken', pageToken)

  const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`
  return googleFetch<DriveListResponse>(connectionId, orgId, url)
}

// ─── Content Extraction ──────────────────────────────────────────────────────

/**
 * Fetches the text content of a Google Drive file.
 * Routes to the correct endpoint based on MIME type:
 * - Google Docs → exported as text/plain
 * - Google Sheets → exported as CSV
 * - Google Slides → exported as text/plain
 * - Binary files (PDF, DOCX) → downloaded via alt=media (raw bytes returned)
 */
export async function fetchDriveFileContent(
  connectionId: string,
  orgId: string,
  fileId: string,
  mimeType: string
): Promise<string> {
  if (mimeType === GOOGLE_DOC_MIME) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
    return googleFetch<string>(connectionId, orgId, url)
  }

  if (mimeType === GOOGLE_SHEET_MIME) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/csv`
    return googleFetch<string>(connectionId, orgId, url)
  }

  if (mimeType === GOOGLE_SLIDES_MIME) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`
    return googleFetch<string>(connectionId, orgId, url)
  }

  if (mimeType === GOOGLE_FOLDER_MIME) {
    return '[Google Drive Folder — no content to extract]'
  }

  // Regular files (PDF, DOCX, TXT, etc.) → download raw bytes
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`
  const res = await googleFetchRaw(connectionId, orgId, url)
  const buffer = await res.arrayBuffer()

  if (mimeType.startsWith('text/')) {
    return new TextDecoder().decode(buffer)
  }

  const base64 = Buffer.from(buffer).toString('base64')
  return `[binary:${mimeType}] base64:${base64.substring(0, 200)}... (${buffer.byteLength} bytes)`
}

// ─── Delta Sync (Changes API) ────────────────────────────────────────────────

/**
 * Retrieves a start page token for Google Drive's Changes API.
 */
export async function getStartPageToken(
  connectionId: string,
  orgId: string
): Promise<string> {
  const url = 'https://www.googleapis.com/drive/v3/changes/startPageToken'
  const res = await googleFetch<{ startPageToken: string }>(connectionId, orgId, url)
  return res.startPageToken
}

/**
 * Fetches changes since the given page token.
 * Returns only modified/removed files and a new token for the next poll cycle.
 */
export async function fetchChanges(
  connectionId: string,
  orgId: string,
  pageToken: string
): Promise<DriveChangesResponse> {
  const params = new URLSearchParams({
    pageToken,
    fields: 'changes(fileId,removed,file(id,name,mimeType,modifiedTime)),newStartPageToken,nextPageToken',
  })

  const url = `https://www.googleapis.com/drive/v3/changes?${params.toString()}`
  const res = await googleFetch<{
    changes: DriveChange[]
    newStartPageToken?: string
    nextPageToken?: string
  }>(connectionId, orgId, url)

  return {
    changes: res.changes || [],
    newPageToken: res.newStartPageToken || res.nextPageToken || pageToken,
  }
}
