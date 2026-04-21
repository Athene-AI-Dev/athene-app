import { fetchSnowflakeSamples } from './sample-fetcher'
import { snowflakeSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../types'

export async function snowflakeFetcher(connectionId: string): Promise<FetchedChunk[]> {
  return await fetchSnowflakeSamples(connectionId)
}

export const snowflakeSearcher = snowflakeSearch

// Register
registerProvider('snowflake', snowflakeFetcher)
registerSearcher('snowflake', snowflakeSearcher)
