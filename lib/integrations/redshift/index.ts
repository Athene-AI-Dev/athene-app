import { fetchRedshiftTables } from './tables-fetcher'
import { redshiftSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../base'

export async function redshiftFetcher(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  return fetchRedshiftTables(connectionId, orgId)
}

registerProvider('redshift', redshiftFetcher)
registerSearcher('redshift', redshiftSearch)
