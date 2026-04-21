import { notionFetcher } from './notion'
import { snowflakeFetcher } from './snowflake'
import { getProvider } from './registry'
import { indexDocument } from './indexing'
import { FetchedChunk } from './types'

export async function runIntegrationFetch(provider: string, connectionId: string, orgId: string) {
  const fetcher = getProvider(provider)
  if (!fetcher) {
    throw new Error(`No fetcher registered for provider: ${provider}`)
  }

  const chunks = await fetcher(connectionId)
  
  for (const chunk of chunks) {
    await indexDocument(chunk, orgId)
  }

  return { count: chunks.length }
}

export * from './registry'
export * from './indexing'
export * from './notion/client'
export * from './snowflake/client'
