import { fetchAllPages } from './pages-fetcher'
import { fetchAllDatabases } from './databases-fetcher'
import { notionSearch } from './searcher'
import { registerProvider, registerSearcher } from '../registry'
import { FetchedChunk } from '../types'

export async function notionFetcher(connectionId: string): Promise<FetchedChunk[]> {
  const pages = await fetchAllPages(connectionId)
  const databases = await fetchAllDatabases(connectionId)
  return [...pages, ...databases]
}

export const notionSearcher = notionSearch

// Register
registerProvider('notion', notionFetcher)
registerSearcher('notion', notionSearcher)
