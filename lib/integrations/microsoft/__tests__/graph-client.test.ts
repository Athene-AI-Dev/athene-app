import { describe, it, expect, vi, beforeEach } from 'vitest'
import { graphFetch, paginate, graphDownload } from '../graph-client'
import { getProviderToken, baseFetch, baseFetchRaw } from '../../base'

vi.mock('../../base', () => ({
  getProviderToken: vi.fn(),
  baseFetch: vi.fn(),
  baseFetchRaw: vi.fn(),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('graph-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('graphFetch', () => {
    it('should call baseFetch with correct URL and headers', async () => {
      vi.mocked(getProviderToken).mockResolvedValue('test-token')
      vi.mocked(baseFetch).mockResolvedValue({ data: 'ok' })

      const result = await graphFetch('conn-123', 'org-123', '/me')

      expect(getProviderToken).toHaveBeenCalledWith('conn-123', 'microsoft', 'org-123')
      expect(baseFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
      expect(result).toEqual({ data: 'ok' })
    })

    it('should pass options through to baseFetch', async () => {
        vi.mocked(getProviderToken).mockResolvedValue('test-token')
        
        await graphFetch('conn-123', 'org-123', '/me', { method: 'POST', body: JSON.stringify({ foo: 'bar' }) })

        expect(baseFetch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                method: 'POST',
                body: { foo: 'bar' }
            })
        )
    })
  })

  describe('graphDownload', () => {
      it('should return arrayBuffer from baseFetchRaw', async () => {
        vi.mocked(getProviderToken).mockResolvedValue('test-token')
        const buffer = new ArrayBuffer(8)
        vi.mocked(baseFetchRaw).mockResolvedValue({
          arrayBuffer: () => Promise.resolve(buffer),
        } as any)

        const result = await graphDownload('conn-123', 'org-123', '/me/drive/items/123/content')
        expect(result).toBe(buffer)
        expect(baseFetchRaw).toHaveBeenCalledWith(
            'https://graph.microsoft.com/v1.0/me/drive/items/123/content',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-token',
                })
            })
        )
      })
  })

  describe('paginate', () => {
    it('should iterate through multiple pages', async () => {
      vi.mocked(getProviderToken).mockResolvedValue('test-token')
      
      // First page
      vi.mocked(baseFetch)
        .mockResolvedValueOnce({
          value: [{ id: 1 }, { id: 2 }],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/items?$skip=2'
        })
        .mockResolvedValueOnce({
          value: [{ id: 3 }],
        })

      const items = []
      for await (const item of paginate('conn-123', 'org-123', '/me/items')) {
        items.push(item)
      }

      expect(items).toHaveLength(3)
      expect(items[0].id).toBe(1)
      expect(items[2].id).toBe(3)
      expect(baseFetch).toHaveBeenCalledTimes(2)
      expect(baseFetch).toHaveBeenLastCalledWith(
        'https://graph.microsoft.com/v1.0/me/items?$skip=2',
        expect.anything()
      )
    })
  })
})
