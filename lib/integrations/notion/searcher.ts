import { notionFetch } from './client'
import { FetchedChunk } from '../types'

export async function notionSearch(connectionId: string, query: string): Promise<FetchedChunk[]> {
  const searchResults = await notionFetch(connectionId, '/search', {
    query,
    filter: {
      property: 'object',
      value: 'page' // Search pages primarily
    },
    page_size: 10
  })

  const chunks: FetchedChunk[] = []
  
  for (const page of searchResults.results) {
    if (page.object !== 'page') continue
    
    // For search, we might not want to fetch the whole content recursively if it's too slow.
    // But the instructions say "uses /search endpoint".
    // I'll return a snippet or title for now, or fetch if needed.
    // The instructions for registerSearcher say: "uses /search endpoint"
    
    chunks.push({
      title: getPageTitle(page),
      content: `Page ID: ${page.id}. URL: ${page.url}`, // Simplified for search results
      source_url: page.url
    })
  }

  return chunks
}

function getPageTitle(page: any): string {
  const titleProp = page.properties.title || page.properties.Name || Object.values(page.properties).find((p: any) => p.type === 'title')
  if (titleProp && titleProp.title && titleProp.title.length > 0) {
    return titleProp.title.map((t: any) => t.plain_text).join('')
  }
  return 'Untitled'
}
