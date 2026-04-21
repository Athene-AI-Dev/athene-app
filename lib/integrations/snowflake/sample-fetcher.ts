import { snowflakeFetch } from './client'
import { parseSnowflakeRows } from './schema-fetcher'
import { getConnection } from '@/lib/nango/client'
import { FetchedChunk } from '../types'

export async function fetchSnowflakeSamples(connectionId: string): Promise<FetchedChunk[]> {
  const connection = await getConnection(connectionId, 'snowflake')
  const allowlist = connection.metadata?.allowlist as string[] | undefined

  if (!allowlist || allowlist.length === 0) {
    return []
  }

  const chunks: FetchedChunk[] = []

  for (const tableFullName of allowlist) {
    try {
      const response = await snowflakeFetch(connectionId, `SELECT * FROM ${tableFullName} LIMIT 100`)
      const rows = parseSnowflakeRows(response)
      
      if (rows.length === 0) continue

      const content = rows.map(row => {
        return Object.entries(row)
          .map(([col, val]) => `${col}: ${val}`)
          .join(', ')
      }).join('\n')

      const parts = tableFullName.split('.')
      const tableName = parts[parts.length - 1]

      chunks.push({
        title: `table: ${tableName}`,
        content,
        source_url: `snowflake://${tableFullName}`, // Identifier for source
        metadata: {
          table: tableFullName,
          database: parts.length === 3 ? parts[0] : undefined,
          schema: parts.length >= 2 ? parts[parts.length - 2] : undefined
        }
      })
    } catch (error) {
      console.error(`Error fetching samples for table ${tableFullName}:`, error)
    }
  }

  return chunks
}
