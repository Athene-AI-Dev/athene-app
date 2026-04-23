import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notionFetch } from '../client'
import { getProviderToken, baseFetch } from '../../base'

vi.mock('../../base', () => ({
  getProviderToken: vi.fn(),
  baseFetch: vi.fn(),
}))

describe('notion client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProviderToken).mockResolvedValue('test-token')
  })

  it('should call baseFetch with correct headers', async () => {
    vi.mocked(baseFetch).mockResolvedValue({ results: [] })

    await notionFetch('conn-123', 'org-123', '/pages')

    expect(getProviderToken).toHaveBeenCalledWith('conn-123', 'notion', 'org-123')
    expect(baseFetch).toHaveBeenCalledWith(
      'https://api.notion.com/v1/pages',
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('should use POST if body is provided', async () => {
    vi.mocked(baseFetch).mockResolvedValue({ id: 'page-123' })
    const body = { parent: { database_id: 'db-123' } }

    await notionFetch('conn-123', 'org-123', '/pages', body)

    expect(baseFetch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        method: 'POST',
        body
      })
    )
  })
})

