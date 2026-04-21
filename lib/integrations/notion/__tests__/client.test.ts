import { describe, it, expect, vi, beforeEach } from 'vitest'
import { notionFetch } from '../client'
import * as nango from '@/lib/nango/client'

vi.mock('@/lib/nango/client', () => ({
  getToken: vi.fn(),
}))

describe('notion client', () => {
  const mockFetch = vi.fn()
  global.fetch = mockFetch

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(nango.getToken).mockResolvedValue('test-token')
  })

  it('should include correct headers', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [] })
    })

    await notionFetch('conn-123', '/pages')

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('api.notion.com/v1/pages'),
      expect.objectContaining({
        headers: {
          Authorization: 'Bearer test-token',
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      })
    )
  })

  it('should retry on 429', async () => {
    // 1st call: 429
    mockFetch.mockResolvedValueOnce({
      status: 429,
      headers: new Map([['Retry-After', '0']]) // Retry immediately for test speed
    })
    // 2nd call: success
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true })
    })

    // Mock setTimeout to avoid waiting
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => fn())

    const result = await notionFetch('conn-123', '/pages')
    
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.success).toBe(true)
  })

  it('should throw error on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Not found' })
    })

    await expect(notionFetch('conn-123', '/invalid')).rejects.toThrow('Notion API Error: 404')
  })
})
