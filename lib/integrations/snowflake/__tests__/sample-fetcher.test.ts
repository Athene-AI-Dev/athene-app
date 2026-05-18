import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchSnowflakeSamples } from '../sample-fetcher'
import * as client from '../client'
import * as nango from '@/lib/nango/client'

vi.mock('../client', () => ({
  snowflakeFetch: vi.fn(),
}))

vi.mock('@/lib/nango/client', () => ({
  getConnection: vi.fn(),
  getToken: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any) => resolve({ data: null, error: null }),
    }),
  },
}))

vi.mock('@/lib/integrations/bi-chunking', () => ({
  resolveSyncConfig: vi.fn().mockReturnValue({
    sample_rows: 50,
    enable_stats: false,
    enable_aggregations: false,
    incremental: false,
    max_rows_per_table: 10000,
  }),
  buildSampleChunk: vi.fn().mockImplementation((tableFullName: string, schema: any, rows: any[]) => ({
    chunk_id: `snowflake_sample_${tableFullName.replace(/[^A-Za-z0-9_]/g, '_')}`,
    title: `table: ${tableFullName.split('.').pop()}`,
    content: rows.map((r: any) => Object.entries(r).map(([k, v]) => `${k}: ${v}`).join(', ')).join('\n'),
    source_url: `snowflake://${tableFullName}`,
    metadata: { provider: 'snowflake', resource_type: 'table_sample', table: tableFullName },
  })),
  buildStatsChunk: vi.fn(),
  buildAggregationChunk: vi.fn(),
  classifyColumn: vi.fn(),
}))

describe('snowflake sample-fetcher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch samples from allowlisted tables', async () => {
    // Mock connection metadata
    vi.mocked(nango.getConnection).mockResolvedValue({
      metadata: {
        account_identifier: 'test-acc',
        allowlist: ['DB.SCH.TABLE1']
      }
    } as any)

    // Mock snowflake fetch: DESCRIBE returns schema, SELECT returns rows
    let callCount = 0
    vi.mocked(client.snowflakeFetch).mockImplementation(async (connectionId, orgId, sql) => {
      callCount++
      if (callCount === 1) {
        // DESCRIBE TABLE
        return {
          resultSetMetaData: {
            rowType: [{ name: 'NAME' }, { name: 'TYPE' }]
          },
          data: [
            ['ID', 'NUMBER'],
            ['NAME', 'VARCHAR']
          ]
        }
      }
      // SELECT (sample rows)
      return {
        resultSetMetaData: {
          rowType: [{ name: 'ID' }, { name: 'NAME' }]
        },
        data: [
          ['1', 'Alice'],
          ['2', 'Bob']
        ]
      }
    })

    const chunks = await fetchSnowflakeSamples('conn-123', 'org-123')

    expect(chunks).toHaveLength(1)
    expect(chunks[0].title).toBe('table: TABLE1')
    expect(chunks[0].content).toContain('id: 1, name: Alice')
    expect(chunks[0].content).toContain('id: 2, name: Bob')
  })
})
