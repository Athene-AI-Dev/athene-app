import { vi, describe, it, expect, beforeEach } from 'vitest'

// ─── Mock the api-client module ──────────────────────────────────────────────

const mockGoogleFetch = vi.fn()
const mockGoogleFetchRaw = vi.fn()

vi.mock('@/lib/integrations/google/api-client', () => ({
  googleFetch: (...args: any[]) => mockGoogleFetch(...args),
  googleFetchRaw: (...args: any[]) => mockGoogleFetchRaw(...args),
}))

import {
  listDriveFiles,
  searchDrive,
  fetchDriveFileContent,
  getStartPageToken,
  fetchChanges,
} from '@/lib/integrations/google/drive-fetcher'

import {
  listUnreadEmails,
  fetchEmailBody,
  sendEmail,
} from '@/lib/integrations/google/gmail-fetcher'

import {
  fetchCalendarEvents,
  fetchTodayEvents,
  createCalendarEvent,
} from '@/lib/integrations/google/calendar-fetcher'

const CONN = 'test-connection'
const ORG = 'org-123'

// ─── Drive Tests ─────────────────────────────────────────────────────────────

describe('Google Drive Fetcher', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('listDriveFiles constructs the correct API URL with query params', async () => {
    mockGoogleFetch.mockResolvedValue({ files: [], nextPageToken: null })
    await listDriveFiles(CONN, ORG)

    expect(mockGoogleFetch).toHaveBeenCalledOnce()
    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('https://www.googleapis.com/drive/v3/files')
    expect(url).toContain('trashed%3Dfalse')
  })

  it('listDriveFiles scopes to a folder when folderId is provided', async () => {
    mockGoogleFetch.mockResolvedValue({ files: [{ id: 'f1' }] })
    await listDriveFiles(CONN, ORG, 'folder-abc')

    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('folder-abc')
    expect(url).toContain('in+parents')
  })

  it('searchDrive escapes single quotes in queries', async () => {
    mockGoogleFetch.mockResolvedValue({ files: [] })
    await searchDrive(CONN, ORG, "user's report")

    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain("user%5C%27s")
    expect(url).toContain('fullText+contains')
  })

  it('fetchDriveFileContent routes Google Docs to export endpoint', async () => {
    mockGoogleFetch.mockResolvedValue('Exported plain text content')
    const result = await fetchDriveFileContent(CONN, ORG, 'doc-123', 'application/vnd.google-apps.document')

    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('/export?mimeType=text/plain')
    expect(result).toBe('Exported plain text content')
  })

  it('fetchDriveFileContent routes Google Sheets to CSV export', async () => {
    mockGoogleFetch.mockResolvedValue('col1,col2\nval1,val2')
    await fetchDriveFileContent(CONN, ORG, 'sheet-123', 'application/vnd.google-apps.spreadsheet')

    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('/export?mimeType=text/csv')
  })

  it('fetchDriveFileContent uses alt=media for regular files', async () => {
    mockGoogleFetchRaw.mockResolvedValue({
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
    await fetchDriveFileContent(CONN, ORG, 'file-123', 'application/pdf')

    const [, , url] = mockGoogleFetchRaw.mock.calls[0]
    expect(url).toContain('alt=media')
  })

  it('getStartPageToken calls the correct endpoint', async () => {
    mockGoogleFetch.mockResolvedValue({ startPageToken: 'token-xyz' })
    const token = await getStartPageToken(CONN, ORG)

    expect(token).toBe('token-xyz')
    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('changes/startPageToken')
  })

  it('fetchChanges returns changes and a new page token', async () => {
    mockGoogleFetch.mockResolvedValue({
      changes: [{ fileId: 'f1', removed: false, file: { id: 'f1', name: 'doc.txt' } }],
      newStartPageToken: 'new-token-456',
    })

    const result = await fetchChanges(CONN, ORG, 'old-token')
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0].fileId).toBe('f1')
    expect(result.newPageToken).toBe('new-token-456')
  })
})

// ─── Gmail Tests ─────────────────────────────────────────────────────────────

describe('Gmail Fetcher', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('listUnreadEmails returns empty array when no messages exist', async () => {
    mockGoogleFetch.mockResolvedValue({ messages: [] })
    const result = await listUnreadEmails(CONN, ORG)
    expect(result).toEqual([])
  })

  it('listUnreadEmails calls googleFetch', async () => {
    mockGoogleFetch.mockResolvedValueOnce({
      messages: [{ id: 'msg-1', threadId: 't-1' }],
    })
    mockGoogleFetch.mockResolvedValueOnce({
      id: 'msg-1', threadId: 't-1', labelIds: ['UNREAD', 'INBOX'],
      snippet: 'Hey there...',
      payload: { headers: [
        { name: 'From', value: 'alice@example.com' },
        { name: 'Subject', value: 'Test Email' },
        { name: 'Date', value: 'Mon, 20 Apr 2026' },
      ]},
      internalDate: '1745123456000',
    })

    const result = await listUnreadEmails(CONN, ORG, 5)
    expect(result).toHaveLength(1)
    expect(result[0].headers.from).toBe('alice@example.com')
    expect(result[0].headers.subject).toBe('Test Email')
  })

  it('fetchEmailBody decodes base64url plain text body', async () => {
    const base64Body = Buffer.from('Hello, world!').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

    mockGoogleFetch.mockResolvedValue({
      id: 'msg-1', threadId: 't-1', labelIds: [], snippet: '',
      payload: { mimeType: 'text/plain', body: { size: 13, data: base64Body } },
    })

    const body = await fetchEmailBody(CONN, ORG, 'msg-1')
    expect(body).toBe('Hello, world!')
  })

  it('fetchEmailBody handles multipart payloads by preferring text/plain', async () => {
    const plainBody = Buffer.from('Plain text version').toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_')

    mockGoogleFetch.mockResolvedValue({
      id: 'msg-2', threadId: 't-2', labelIds: [], snippet: '',
      payload: {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { size: 18, data: plainBody } },
          { mimeType: 'text/html', body: { size: 30, data: 'ignored' } },
        ],
      },
    })

    const body = await fetchEmailBody(CONN, ORG, 'msg-2')
    expect(body).toBe('Plain text version')
  })

  it('sendEmail posts a raw base64 message', async () => {
    mockGoogleFetch.mockResolvedValue({ id: 'sent-1', threadId: 't-sent' })
    const result = await sendEmail(CONN, ORG, 'base64-raw-message')

    expect(result.id).toBe('sent-1')
    const [, , url, opts] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('/messages/send')
    expect(opts.method).toBe('POST')
  })
})

// ─── Calendar Tests ──────────────────────────────────────────────────────────

describe('Google Calendar Fetcher', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('fetchCalendarEvents passes correct time window', async () => {
    mockGoogleFetch.mockResolvedValue({ items: [] })
    const start = new Date('2026-04-20T00:00:00Z')
    const end = new Date('2026-04-21T00:00:00Z')
    await fetchCalendarEvents(CONN, ORG, start, end)

    const [, , url] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('singleEvents=true')
    expect(url).toContain('orderBy=startTime')
    expect(url).toContain('2026-04-20')
  })

  it('fetchTodayEvents returns events from now to end of day', async () => {
    mockGoogleFetch.mockResolvedValue({
      items: [{ id: 'e1', summary: 'Standup', start: {}, end: {} }],
    })
    const events = await fetchTodayEvents(CONN, ORG)
    expect(events).toHaveLength(1)
    expect(events[0].summary).toBe('Standup')
  })

  it('createCalendarEvent sends a POST', async () => {
    mockGoogleFetch.mockResolvedValue({
      id: 'new-event', summary: 'Team Sync',
      start: { dateTime: '2026-04-20T15:00:00Z' },
      end: { dateTime: '2026-04-20T16:00:00Z' },
    })

    const result = await createCalendarEvent(CONN, ORG, {
      summary: 'Team Sync',
      start: { dateTime: '2026-04-20T15:00:00Z' },
      end: { dateTime: '2026-04-20T16:00:00Z' },
    })

    expect(result.summary).toBe('Team Sync')
    const [, , url, opts] = mockGoogleFetch.mock.calls[0]
    expect(url).toContain('calendars/primary/events')
    expect(opts.method).toBe('POST')
  })
})
