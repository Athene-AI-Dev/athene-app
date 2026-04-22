import { describe, it, expect, vi, beforeEach } from 'vitest'
import { graphFetch, paginate, graphDownload } from '../graph-client'
import { getToken } from '@/lib/nango/client'

vi.mock('@/lib/nango/client', () => ({
  getToken: vi.fn(),
}))

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('graph-client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('graphFetch', () => {
    it('should call fetch with correct URL and headers', async () => {
      vi.mocked(getToken).mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: 'ok' }),
      } as any)

      const result = await graphFetch('conn-123', '/me')

      expect(getToken).toHaveBeenCalledWith('conn-123', 'microsoft')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me',
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token',
            'Content-Type': 'application/json',
          },
        })
      )
      expect(result).toEqual({ data: 'ok' })
    })

    it('should throw error if response is not ok', async () => {
      vi.mocked(getToken).mockResolvedValue('test-token')
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not Found'),
      } as any)

      await expect(graphFetch('conn-123', '/invalid')).rejects.toThrow('Graph API: 404 Not Found')
    })

    it('should retry on 429 status code', async () => {
      vi.mocked(getToken).mockResolvedValue('test-token')
      vi.useFakeTimers()
      
      // First call: 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0' }), // 0 for instant retry in test
        text: () => Promise.resolve('Throttled'),
      } as any)

      // Second call: 200
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      } as any)

      const fetchPromise = graphFetch('conn-123', '/me')
      
      // Fast-forward timers if needed
      await vi.runAllTimersAsync()
      
      const result = await fetchPromise

      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(result).toEqual({ success: true })
      vi.useRealTimers()
    })
  })

  describe('graphDownload', () => {
      it('should return arrayBuffer for successful download', async () => {
        vi.mocked(getToken).mockResolvedValue('test-token')
        const buffer = new ArrayBuffer(8)
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          arrayBuffer: () => Promise.resolve(buffer),
        } as any)

        const result = await graphDownload('conn-123', '/me/drive/items/123/content')
        expect(result).toBe(buffer)
      })
  })

  describe('paginate', () => {
    it('should iterate through multiple pages', async () => {
      vi.mocked(getToken).mockResolvedValue('test-token')
      
      // First page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          value: [{ id: 1 }, { id: 2 }],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/items?$skip=2'
        }),
      } as any)

      // Second page
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          value: [{ id: 3 }],
        }),
      } as any)

      const items = []
      for await (const item of paginate('conn-123', '/me/items')) {
        items.push(item)
      }

      expect(items).toHaveLength(3)
      expect(items[0].id).toBe(1)
      expect(items[2].id).toBe(3)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://graph.microsoft.com/v1.0/me/items?$skip=2',
        expect.anything()
      )
    })
  })
})
