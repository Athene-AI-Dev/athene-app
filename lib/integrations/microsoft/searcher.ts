import { graphFetch } from './graph-client'
import { FetchedChunk } from '../types'

/**
 * Searches across Microsoft 365 (Outlook and Calendar).
 */
export async function microsoftSearch(connectionId: string, query: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []

  try {
    // 1. Search Emails
    const emailData = await graphFetch(connectionId, `/me/messages?$search="${query}"&$top=10&$select=subject,from,receivedDateTime,bodyPreview,webLink`)
    if (emailData.value) {
      for (const email of emailData.value) {
        chunks.push({
          title: `Email: ${email.subject}`,
          content: `From: ${email.from?.emailAddress?.name || 'Unknown'}\nDate: ${email.receivedDateTime}\n\n${email.bodyPreview}`,
          source_url: email.webLink,
          metadata: { type: 'email', id: email.id }
        })
      }
    }

    // 2. Search Calendar Events
    // Note: Graph $search is limited on events, so we use $filter with contains
    const eventData = await graphFetch(connectionId, `/me/events?$filter=contains(subject, '${query}')&$top=10&$select=subject,start,end,location,bodyPreview,webLink`)
    if (eventData.value) {
      for (const event of eventData.value) {
        chunks.push({
          title: `Event: ${event.subject}`,
          content: `Time: ${event.start?.dateTime} to ${event.end?.dateTime}\nLocation: ${event.location?.displayName || 'N/A'}\n\n${event.bodyPreview || ''}`,
          source_url: event.webLink,
          metadata: { type: 'event', id: event.id }
        })
      }
    }
  } catch (error) {
    console.error('Error in microsoftSearch:', error)
  }

  return chunks
}
