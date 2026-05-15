import { fetchUnreadEmails, fetchEmailBody, type OutlookEmail } from './outlook-fetcher'
import { fetchEvents } from './calendar-fetcher'
import { listOneDriveDocs, fetchOneDriveDocContent } from './onedrive-fetcher'
import { listSharePointDocs, fetchDocContent as fetchSharePointDocContent } from './sharepoint-fetcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'
import { microsoftSearch } from './searcher'
import { graphFetch } from './graph-client'
import { logger } from '@/lib/logger'

// ─── Email chunking constants ────────────────────────────────────────────────
const EMAIL_CHUNK_SIZE = 2000
const EMAIL_CHUNK_OVERLAP = 200

/** Strip HTML tags so raw body content is plain text for embeddings. */
function stripOutlookHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function microsoftFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []

  // 1. Outlook Emails — full body indexing with overlap-chunking
  try {
    const emails = await fetchUnreadEmails(connectionId, orgId, 100)

    // ATH-B0: Process in small parallel batches to avoid rate limits
    const BATCH = 5
    for (let i = 0; i < emails.length; i += BATCH) {
      const batch = emails.slice(i, i + BATCH)
      const results = await Promise.all(
        batch.map(async (email: OutlookEmail) => {
          const emailChunks: FetchedChunk[] = []
          try {
            const rawBody = await fetchEmailBody(connectionId, orgId, email.id)
            // Graph API returns body as HTML for most emails
            const body = stripOutlookHtml(rawBody)
            const from = email.from?.emailAddress?.name ?? email.from?.emailAddress?.address ?? 'Unknown'
            const prefix = [
              `From: ${from}`,
              `Subject: ${email.subject ?? '(no subject)'}`,
              `Date: ${email.receivedDateTime ?? ''}`,
            ].join('\n') + '\n\n'

            const fullText = prefix + body
            let offset = 0
            let idx = 0
            while (offset < fullText.length) {
              const slice = fullText.slice(offset, offset + EMAIL_CHUNK_SIZE)
              emailChunks.push({
                chunk_id: `ms_email_${email.id}:${idx}`,
                title: `Email: ${email.subject ?? '(no subject)'}`,
                content: slice,
                source_url: email.webLink,
                metadata: {
                  provider: 'microsoft',
                  resource_type: 'email',
                  id: email.id,
                  author: from,
                  last_modified: email.receivedDateTime ?? undefined,
                },
              })
              offset += EMAIL_CHUNK_SIZE - EMAIL_CHUNK_OVERLAP
              idx++
            }
          } catch {
            // Fallback to bodyPreview if full body fetch fails
            emailChunks.push({
              chunk_id: `ms_email_${email.id}:0`,
              title: `Email: ${email.subject ?? '(no subject)'}`,
              content: `From: ${email.from?.emailAddress?.name ?? 'Unknown'}\n\n${email.bodyPreview ?? ''}`,
              source_url: email.webLink,
              metadata: { provider: 'microsoft', resource_type: 'email', id: email.id },
            })
          }
          return emailChunks
        })
      )
      for (const r of results) chunks.push(...r)
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[microsoft] Error fetching Outlook emails');
  }

  // 2. Calendar Events — enriched with attendees and organizer
  try {
    const now = new Date()
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const eventsData = await fetchEvents(connectionId, orgId, now, nextWeek)
    if (eventsData.value) {
      for (const event of eventsData.value) {
        const organizer = event.organizer?.emailAddress?.name ?? event.organizer?.emailAddress?.address
        const attendeeNames: string[] = (event.attendees ?? [])
          .map((a: any) => a.emailAddress?.name ?? a.emailAddress?.address)
          .filter(Boolean)

        const lines: string[] = [
          `Event: ${event.subject}`,
          `Start: ${event.start?.dateTime}`,
          `End: ${event.end?.dateTime}`,
        ]
        if (organizer) lines.push(`Organizer: ${organizer}`)
        if (attendeeNames.length > 0) lines.push(`Attendees: ${attendeeNames.join(', ')}`)
        if (event.location?.displayName) lines.push(`Location: ${event.location.displayName}`)
        if (event.bodyPreview) lines.push(`\n${event.bodyPreview}`)

        chunks.push({
          chunk_id: `ms_event_${event.id}`,
          title: `Event: ${event.subject}`,
          content: lines.join('\n'),
          source_url: event.webLink,
          metadata: {
            provider: 'microsoft',
            resource_type: 'event',
            id: event.id,
          },
        })
      }
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[microsoft] Error fetching Calendar events');
  }

  // 3. OneDrive Documents
  try {
    const driveDocs = await listOneDriveDocs(connectionId, orgId)
    for (const doc of driveDocs) {
      const content = await fetchOneDriveDocContent(connectionId, orgId, doc.id)
      chunks.push({
        chunk_id: `ms_drive_${doc.id}`,
        title: `OneDrive: ${doc.name}`,
        content,
        source_url: doc.webLink,
        metadata: { 
          provider: 'microsoft',
          resource_type: 'onedrive_doc',
          id: doc.id 
        }
      })
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[microsoft] Error fetching OneDrive docs');
  }

  // 4. SharePoint Documents
  try {
    const sitesData = await graphFetch(connectionId, orgId, '/sites?search=*')
    if (sitesData.value) {
      for (const site of sitesData.value) {
        // Not all sites have drives, so this might fail for some, but we catch inside or around
        try {
          const siteDocs = await listSharePointDocs(connectionId, orgId, site.id)
          for (const doc of siteDocs) {
            const driveId = doc.parentReference?.driveId
            if (!driveId) continue
            const content = await fetchSharePointDocContent(connectionId, orgId, driveId, doc.id)
            chunks.push({
              chunk_id: `ms_sharepoint_${doc.id}`,
              title: `SharePoint: ${doc.name}`,
              content,
              source_url: doc.webLink,
              metadata: { 
                provider: 'microsoft',
                resource_type: 'sharepoint_doc',
                id: doc.id 
              }
            })
          }
        } catch (siteError) {
          logger.error({ siteId: site.id, err: siteError instanceof Error ? siteError.message : String(siteError) }, '[microsoft] Error fetching docs for SharePoint site');
        }
      }
    }
  } catch (error) {
    logger.error({ err: error instanceof Error ? error.message : String(error) }, '[microsoft] Error fetching SharePoint docs');
  }

  return chunks
}

// Register
registerProvider('microsoft', microsoftFetcher)
registerSearcher('microsoft', microsoftSearch)
registerProvider('microsoft-graph', microsoftFetcher)
registerSearcher('microsoft-graph', microsoftSearch)
