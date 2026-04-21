import { salesforceFetch } from './client'

export interface FetchedChunk {
  chunk_id: string
  content: string
  source_url: string
  title: string
  metadata: Record<string, unknown>
}

const SOQL = `SELECT+Id,Name,Industry,Description+FROM+Account`

export async function fetchSalesforceAccounts(
  connectionId: string,
  instanceUrl: string,
  orgId: string
): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []
  let nextUrl: string | null = `/query?q=${SOQL}`

  while (nextUrl) {
    const data = await salesforceFetch(connectionId, nextUrl, orgId) as {
      records: { Id: string; Name: string; Industry: string | null; Description: string | null }[]
      nextRecordsUrl?: string
      done: boolean
    }

    for (const record of data.records) {
      chunks.push({
        chunk_id:   `sf-account-${record.Id}`,
        title:      record.Name,
        content: [
          `Account: ${record.Name}`,
          record.Industry    ? `Industry: ${record.Industry}`       : null,
          record.Description ? `Description: ${record.Description}` : null,
        ].filter(Boolean).join('\n'),
        source_url: `${instanceUrl}/lightning/r/Account/${record.Id}/view`,
        metadata: {
          provider:    'salesforce',
          object_type: 'Account',
          id:          record.Id,
          industry:    record.Industry ?? null,
        },
      })
    }

    nextUrl = data.done ? null : (data.nextRecordsUrl ?? null)
  }

  return chunks
}