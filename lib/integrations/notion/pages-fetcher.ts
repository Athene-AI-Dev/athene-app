import { notionFetch } from './client'
import { FetchedChunk } from '../types'

export async function fetchAllPages(connectionId: string): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []
  let hasMore = true
  let startCursor: string | undefined = undefined

  while (hasMore) {
    // 1. Search for all pages
    const searchResults = await notionFetch(connectionId, '/search', {
      filter: {
        property: 'object',
        value: 'page'
      },
      start_cursor: startCursor
    })

    for (const page of searchResults.results) {
      if (page.object !== 'page') continue

      const title = getPageTitle(page)
      const content = await fetchPageContent(connectionId, page.id)
      
      chunks.push({
        title,
        content,
        source_url: page.url
      })
    }

    hasMore = searchResults.has_more
    startCursor = searchResults.next_cursor
  }

  return chunks
}

async function fetchPageContent(connectionId: string, blockId: string): Promise<string> {
  let content = ''
  let hasMore = true
  let startCursor: string | undefined = undefined

  while (hasMore) {
    const url = `/blocks/${blockId}/children${startCursor ? `?start_cursor=${startCursor}` : ''}`
    const response = await notionFetch(connectionId, url)
    
    for (const block of response.results) {
      content += await blockToText(connectionId, block)
    }

    hasMore = response.has_more
    startCursor = response.next_cursor
  }

  return content
}

async function blockToText(connectionId: string, block: any): Promise<string> {
  let text = ''
  const type = block.type
  const blockData = block[type]

  if (!blockData || !blockData.rich_text) {
    // Handle blocks with children that don't have rich_text directly (like toggle, column_list)
    if (block.has_children) {
      return await fetchPageContent(connectionId, block.id)
    }
    return ''
  }

  const plainText = blockData.rich_text.map((t: any) => t.plain_text).join('')
  
  switch (type) {
    case 'paragraph':
      text = plainText + '\n\n'
      break
    case 'heading_1':
      text = '# ' + plainText + '\n\n'
      break
    case 'heading_2':
      text = '## ' + plainText + '\n\n'
      break
    case 'heading_3':
      text = '### ' + plainText + '\n\n'
      break
    case 'bulleted_list_item':
      text = '- ' + plainText + '\n'
      break
    case 'numbered_list_item':
      text = '1. ' + plainText + '\n'
      break
    case 'to_do':
      text = `[${blockData.checked ? 'x' : ' '}] ` + plainText + '\n'
      break
    case 'code':
      text = '```' + (blockData.language || '') + '\n' + plainText + '\n```\n\n'
      break
    case 'quote':
      text = '> ' + plainText + '\n\n'
      break
    default:
      text = plainText + '\n'
  }

  if (block.has_children) {
    text += await fetchPageContent(connectionId, block.id)
  }

  return text
}

function getPageTitle(page: any): string {
  // Notion pages store title in properties, usually under 'title' or 'Name'
  const titleProp = page.properties.title || page.properties.Name || Object.values(page.properties).find((p: any) => p.type === 'title')
  if (titleProp && titleProp.title && titleProp.title.length > 0) {
    return titleProp.title.map((t: any) => t.plain_text).join('')
  }
  return 'Untitled'
}
