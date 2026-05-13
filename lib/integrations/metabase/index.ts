import { fetchMetabaseContent } from './cards-fetcher'
import { metabaseSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'

export async function metabaseFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  return fetchMetabaseContent(connectionId, orgId)
}

registerProvider('metabase', metabaseFetcher)
registerSearcher('metabase', metabaseSearch)
