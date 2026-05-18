import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAllDatabases } from '../databases-fetcher'
import * as client from '../client'

vi.mock('../client', () => ({
  notionFetch: vi.fn(),
}))

describe('notion databases-fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch databases and pages within them', async () => {
    vi.mocked(client.notionFetch).mockImplementation(async (connectionId, orgId, path) => {
      if (path === '/search') {
        return {
          results: [{
            object: 'database',
            id: 'db1',
            url: 'https://notion.so/db1',
            title: [{ plain_text: 'Test DB' }]
          }],
          has_more: false
        }
      }
      if (path === '/databases/db1/query') {
        return {
          results: [{
            object: 'page',
            properties: {
              Name: { type: 'title', title: [{ plain_text: 'Item 1' }] },
              Status: { type: 'select', select: { name: 'Done' } }
            }
          }],
          has_more: false
        }
      }
      return { results: [] }
    })

    const chunks = await fetchAllDatabases('conn-123', 'org-123')
    
    expect(chunks).toHaveLength(2)
    const schemaChunk = chunks.find((c: any) => c.chunk_id === 'notion_db_schema_db1')
    const dataChunk = chunks.find((c: any) => c.chunk_id === 'notion_db_db1')
    expect(schemaChunk).toBeDefined()
    expect(dataChunk).toBeDefined()
    expect(dataChunk!.title).toBe('Database: Test DB')
    expect(dataChunk!.content).toContain('Name: Item 1')
    expect(dataChunk!.content).toContain('Status: Done')
  })
})
