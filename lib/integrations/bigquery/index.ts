import { fetchBigQueryDatasets } from './datasets-fetcher'
import { bigquerySearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'

export async function bigqueryFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  return fetchBigQueryDatasets(connectionId, orgId)
}

registerProvider('bigquery', bigqueryFetcher)
registerSearcher('bigquery', bigquerySearch)
