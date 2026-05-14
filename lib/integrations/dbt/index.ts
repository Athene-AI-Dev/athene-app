import { fetchDbtContent } from './models-fetcher'
import { dbtSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'

export async function dbtFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  return fetchDbtContent(connectionId, orgId)
}

registerProvider('dbt', dbtFetcher)
registerSearcher('dbt', dbtSearch)
