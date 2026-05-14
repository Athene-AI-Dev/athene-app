import { fetchPowerBIContent } from './reports-fetcher'
import { powerbiSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'

export async function powerbiFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  return fetchPowerBIContent(connectionId, orgId)
}

registerProvider('powerbi', powerbiFetcher)
registerSearcher('powerbi', powerbiSearch)
