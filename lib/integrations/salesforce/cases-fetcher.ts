import { salesforceFetch } from './client'
import type { FetchedChunk } from './accounts-fetcher'

const SOQL = `SELECT+Id,Subject,Description,Status+FROM+Case`

export async function fetchSalesforceCases(
  connectionId: string,
  instanceUrl: string,
  orgId: string
): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []
  let nextUrl: string | null = `/query?q=${SOQL}`

  while (nextUrl) {
    const data = await salesforceFetch(connectionId, nextUrl, orgId) as {
      records: { Id: string; Subject: string; Description: string | null; Status: string }[]
      nextRecordsUrl?: string
      done: boolean
    }

    for (const record of data.records) {
      chunks.push({
        chunk_id:   `sf-case-${record.Id}`,
        title:      record.Subject,
        content: [
          `Case: ${record.Subject}`,
          `Status: ${record.Status}`,
          record.Description ? `Description: ${record.Description}` : null,
        ].filter(Boolean).join('\n'),
        source_url: `${instanceUrl}/lightning/r/Case/${record.Id}/view`,
        metadata: {
          provider:    'salesforce',
          object_type: 'Case',
          id:          record.Id,
          status:      record.Status,
        },
      })
    }

    nextUrl = data.done ? null : (data.nextRecordsUrl ?? null)
  }

  return chunks
}