import { describe, it, expect, vi, beforeEach } from 'vitest'
import { snowflakeFetch } from '../client'
import { getProviderToken, baseFetch } from '../../base'
import { getConnection } from '@/lib/nango/client'

vi.mock('../../base', () => ({
  getProviderToken: vi.fn(),
  baseFetch: vi.fn(),
}))

vi.mock('@/lib/nango/client', () => ({
  getConnection: vi.fn(),
}))

describe('snowflake client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getProviderToken).mockResolvedValue('test-token')
    vi.mocked(getConnection).mockResolvedValue({
      metadata: { account_identifier: 'abc1234' }
    } as any)
  })

  it('should call baseFetch with correct headers', async () => {
    vi.mocked(baseFetch).mockResolvedValue({ results: [] })

    await snowflakeFetch('conn-123', 'org-123', 'SELECT 1')

    expect(getProviderToken).toHaveBeenCalledWith('conn-123', 'snowflake', 'org-123')
    expect(baseFetch).toHaveBeenCalledWith(
      'https://abc1234.snowflakecomputing.com/api/v2/statements',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'X-Snowflake-Authorization-Token-Type': 'OAUTH',
        }),
        body: { statement: 'SELECT 1', timeout: 60 }
      })
    )
  })
})

