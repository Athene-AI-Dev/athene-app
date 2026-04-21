import { fetchUnreadEmails } from './outlook-fetcher'
import { fetchEvents } from './calendar-fetcher'
import { listOneDriveDocs, fetchOneDriveDocContent } from './onedrive-fetcher'
import { listSharePointDocs, fetchDocContent as fetchSharePointDocContent } from './sharepoint-fetcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../types'
import { microsoftSearch } from './searcher'

export async function microsoftFetcher(connectionId: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []

  // 1. Outlook Emails
  try {
    const emails = await fetchUnreadEmails(connectionId)
    for (const email of emails) {
      chunks.push({
        title: `Email: ${email.subject}`,
        content: `From: ${email.from?.emailAddress?.name}\n\n${email.bodyPreview}`,
        source_url: email.webLink,
        metadata: { id: email.id, type: 'email' }
      })
    }
  } catch (error) {
    console.error('Error fetching Outlook emails:', error)
  }

  // 2. Calendar Events
  try {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const eventsData = await fetchEvents(connectionId, now, nextWeek)
    if (eventsData.value) {
      for (const event of eventsData.value) {
        chunks.push({
          title: `Event: ${event.subject}`,
          content: `Start: ${event.start.dateTime}\nEnd: ${event.end.dateTime}\n\n${event.bodyPreview || ''}`,
          source_url: event.webLink,
          metadata: { id: event.id, type: 'event' }
        })
      }
    }
  } catch (error) {
    console.error('Error fetching Calendar events:', error)
  }

  // 3. OneDrive Documents
  try {
    const driveDocs = await listOneDriveDocs(connectionId)
    for (const doc of driveDocs) {
      const content = await fetchOneDriveDocContent(connectionId, doc.id)
      chunks.push({
        title: `OneDrive: ${doc.name}`,
        content,
        source_url: doc.webLink,
        metadata: { id: doc.id, type: 'onedrive_doc' }
      })
    }
  } catch (error) {
    console.error('Error fetching OneDrive docs:', error)
  }

  // 4. SharePoint Documents
  // Note: SharePoint requires Site ID. For a generic fetcher without site discovery, we might skip or use a default.
  // Assuming discovery might happen elsewhere, or we skip for the global 'microsoft' fetcher which is primary to 'me' resources.

  return chunks
}

// Register
registerProvider('microsoft', microsoftFetcher)
registerSearcher('microsoft', microsoftSearch)
