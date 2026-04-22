import './notion'
import './snowflake'
import './microsoft'
import { getProvider } from './registry'
import { FetchedChunk } from './base'

export async function runIntegrationFetch(provider: string, connectionId: string, orgId: string) {
  const fetcher = getProvider(provider)
  if (!fetcher) {
    throw new Error(`No fetcher registered for provider: ${provider}`)
  }

  const chunks = await fetcher(connectionId, orgId)
  
  // TODO: Rose's indexing implementation will be merged here
  // for (const chunk of chunks) {
  //   await indexDocument(chunk, orgId)
  // }

  return { count: chunks.length }
}

export * from './registry'
export * from './notion/client'
export * from './snowflake/client'
