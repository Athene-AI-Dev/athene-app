import { snowflakeFetch } from './client'
import { parseSnowflakeRows } from './schema-fetcher'
import { getConnection } from '@/lib/nango/client'
import { FetchedChunk } from '../types'

export async function snowflakeSearch(connectionId: string, query: string): Promise<FetchedChunk[]> {
  const connection = await getConnection(connectionId, 'snowflake')
  const allowlist = connection.metadata?.allowlist as string[] | undefined

  if (!allowlist || allowlist.length === 0) {
    return []
  }

  const chunks: FetchedChunk[] = []

  for (const tableFullName of allowlist) {
    try {
      // Find columns that are strings to search with LIKE
      const describeRes = await snowflakeFetch(connectionId, `DESCRIBE TABLE ${tableFullName}`)
      const columns = parseSnowflakeRows(describeRes)
      const stringCols = columns
        .filter((col: any) => col.type.toLowerCase().includes('string') || col.type.toLowerCase().includes('text') || col.type.toLowerCase().includes('varchar'))
        .map((col: any) => col.name)

      if (stringCols.length === 0) continue

      const escapedQuery = query.replace(/'/g, "''")
      const whereClause = stringCols.map(col => `${col} LIKE '%${escapedQuery}%'`).join(' OR ')
      const response = await snowflakeFetch(connectionId, `SELECT * FROM ${tableFullName} WHERE ${whereClause} LIMIT 10`)
      const rows = parseSnowflakeRows(response)
      
      for (const row of rows) {
        const content = Object.entries(row)
          .map(([col, val]) => `${col}: ${val}`)
          .join(', ')

        const parts = tableFullName.split('.')
        const tableName = parts[parts.length - 1]

        chunks.push({
          title: `Result from ${tableName}`,
          content: content,
          source_url: `snowflake://${tableFullName}`,
          metadata: { table: tableFullName }
        })
      }
    } catch (error) {
      console.error(`Error searching table ${tableFullName}:`, error)
    }
  }

  return chunks
}
