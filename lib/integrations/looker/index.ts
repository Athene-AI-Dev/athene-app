import { fetchLookerContent } from './looks-fetcher'
import { lookerSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'

export async function lookerFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  return fetchLookerContent(connectionId, orgId)
}

registerProvider('looker', lookerFetcher)
registerSearcher('looker', lookerSearch)
