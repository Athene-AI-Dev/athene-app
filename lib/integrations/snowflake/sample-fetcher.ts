import { snowflakeFetch } from './client'
import { parseSnowflakeRows, fetchTableStats } from './schema-fetcher'
import { getConnection } from '@/lib/nango/client'
import { supabaseAdmin } from '@/lib/supabase/server'
import {
  type FetchedChunk,
} from '../base'
import {
  resolveSyncConfig,
  buildStatsChunk,
  buildSampleChunk,
  buildAggregationChunk,
  classifyColumn,
  type AggregationResult,
} from '../bi-chunking'

const IDENT_RE = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/
const PAGE_SIZE = 500  // rows per pagination fetch

/** Shape stored in connections.sync_cursor for Snowflake */
interface SnowflakeCursor {
  synced_at: string
  table_max_ids: Record<string, string | number>  // tableFullName → last max primary-key value
}

export async function fetchSnowflakeSamples(connectionId: string, orgId: string): Promise<FetchedChunk[]> {
  const connection = await getConnection(connectionId, 'snowflake', orgId)
  const allowlist = connection.metadata?.allowlist as string[] | undefined
  const rawSyncConfig = connection.metadata?.sync_config as Record<string, unknown> | undefined
  const syncConfig = resolveSyncConfig(rawSyncConfig)

  // Load delta cursor (null = first full sync)
  let cursor: SnowflakeCursor | null = null
  try {
    const { data } = await supabaseAdmin
      .from('connections')
      .select('sync_cursor')
      .eq('id', connectionId)
      .single()
    if (data?.sync_cursor) {
      cursor = typeof data.sync_cursor === 'string'
        ? JSON.parse(data.sync_cursor)
        : (data.sync_cursor as SnowflakeCursor)
    }
  } catch { /* non-fatal — treat as first sync */ }

  const tables = allowlist?.filter((t) => IDENT_RE.test(t)) ?? []
  if (tables.length === 0) return []

  const chunks: FetchedChunk[] = []
  const newTableMaxIds: Record<string, string | number> = { ...cursor?.table_max_ids }

  for (const tableFullName of tables) {
    try {
      chunks.push(...await processTable(
        connectionId,
        orgId,
        tableFullName,
        syncConfig,
        cursor,
        newTableMaxIds,
      ))
    } catch (err) {
      console.error(`[snowflake] Failed to process ${tableFullName}:`, err)
    }
  }

  // Write updated cursor after all tables processed
  const newCursor: SnowflakeCursor = {
    synced_at: new Date().toISOString(),
    table_max_ids: newTableMaxIds,
  }
  try {
    await supabaseAdmin
      .from('connections')
      .update({
        sync_cursor: JSON.stringify(newCursor),
        last_synced_at: newCursor.synced_at,
      })
      .eq('id', connectionId)
  } catch (err) {
    console.warn('[snowflake] Failed to write sync_cursor:', err)
  }

  return chunks
}

async function processTable(
  connectionId: string,
  orgId: string,
  tableFullName: string,
  syncConfig: ReturnType<typeof resolveSyncConfig>,
  cursor: SnowflakeCursor | null,
  newTableMaxIds: Record<string, string | number>,
): Promise<FetchedChunk[]> {
  const chunks: FetchedChunk[] = []
  const sourceUrl = `snowflake://${tableFullName}`

  // 1. Describe table to get column schema
  const describeRes = await snowflakeFetch(connectionId, orgId, `DESCRIBE TABLE ${tableFullName}`)
  const schemaRows = parseSnowflakeRows(describeRes)
  const schema = schemaRows.map((r: any) => ({ name: r.name as string, type: r.type as string }))

  if (schema.length === 0) return []

  // 2. Stats chunk (always generated — cheap, always useful)
  if (syncConfig.enable_stats) {
    const stats = await fetchTableStats(connectionId, orgId, tableFullName, schema, syncConfig)
    chunks.push(buildStatsChunk(tableFullName, stats, 'snowflake', sourceUrl))
  }

  // 3. Detect if there is a numeric PK/ID column for cursor-based pagination
  const pkCol = detectPkColumn(schema)
  const lastMaxId = cursor?.table_max_ids?.[tableFullName]
  const isIncremental = syncConfig.incremental && cursor !== null && lastMaxId != null && pkCol !== null

  // 4. Sample rows (paginated)
  if (syncConfig.sample_rows > 0) {
    const rows = await fetchRowsPaginated(
      connectionId,
      orgId,
      tableFullName,
      pkCol,
      isIncremental ? lastMaxId : null,
      syncConfig.max_rows_per_table,
      newTableMaxIds,
    )

    if (rows.length > 0) {
      const sample = rows.slice(0, syncConfig.sample_rows)
      chunks.push(buildSampleChunk(tableFullName, schema, sample, 'snowflake', sourceUrl))
    }
  }

  // 5. Aggregation chunk
  if (syncConfig.enable_aggregations) {
    const aggResults = await fetchAggregations(connectionId, orgId, tableFullName, schema)
    if (aggResults.length > 0) {
      chunks.push(buildAggregationChunk(tableFullName, aggResults, 'snowflake', sourceUrl))
    }
  }

  return chunks
}

/** Paginated row fetch, optionally with a WHERE id > lastMaxId for delta sync */
async function fetchRowsPaginated(
  connectionId: string,
  orgId: string,
  tableFullName: string,
  pkCol: string | null,
  lastMaxId: string | number | null,
  maxRows: number,
  newTableMaxIds: Record<string, string | number>,
): Promise<Record<string, string>[]> {
  const allRows: Record<string, string>[] = []
  let offset = 0
  let localMaxId: string | number | null = null

  const whereClause = pkCol && lastMaxId != null
    ? `WHERE ${pkCol} > ${lastMaxId}`
    : ''
  const orderClause = pkCol ? `ORDER BY ${pkCol}` : ''

  while (allRows.length < maxRows) {
    const limit = Math.min(PAGE_SIZE, maxRows - allRows.length)
    const sql = `SELECT * FROM ${tableFullName} ${whereClause} ${orderClause} LIMIT ${limit} OFFSET ${offset}`

    try {
      const res = await snowflakeFetch(connectionId, orgId, sql)
      const rows: Record<string, string>[] = parseSnowflakeRows(res)
      if (rows.length === 0) break

      allRows.push(...rows)

      // Track max PK for delta cursor
      if (pkCol) {
        const lastRow = rows[rows.length - 1]
        const idVal = lastRow[pkCol]
        if (idVal != null) localMaxId = idVal
      }

      if (rows.length < limit) break  // exhausted
      offset += rows.length
    } catch (err) {
      console.warn(`[snowflake] Pagination error at offset ${offset} for ${tableFullName}:`, err)
      break
    }
  }

  if (pkCol && localMaxId != null) {
    newTableMaxIds[tableFullName] = localMaxId
  }

  return allRows
}

/** Compute aggregations: SUM of each numeric col × top categorical dimensions */
async function fetchAggregations(
  connectionId: string,
  orgId: string,
  tableFullName: string,
  schema: { name: string; type: string }[],
): Promise<AggregationResult[]> {
  const results: AggregationResult[] = []
  const numericCols = schema.filter((c) => classifyColumn(c.type) === 'numeric').slice(0, 3)
  const catCols = schema.filter((c) => classifyColumn(c.type) === 'categorical').slice(0, 2)

  if (numericCols.length === 0 || catCols.length === 0) return results

  for (const metric of numericCols) {
    for (const dim of catCols) {
      try {
        const sql = `
          SELECT ${dim.name} AS dim_val, SUM(${metric.name}) AS metric_sum
          FROM ${tableFullName}
          GROUP BY ${dim.name}
          ORDER BY metric_sum DESC
          LIMIT 10
        `
        const res = await snowflakeFetch(connectionId, orgId, sql)
        const rows = parseSnowflakeRows(res)
        if (rows.length === 0) continue

        results.push({
          dimension: dim.name,
          metric: metric.name,
          rows: rows.map((r: any) => ({
            dimValue: String(r.dim_val ?? ''),
            metricValue: String(r.metric_sum ?? ''),
          })),
        })
      } catch { /* non-fatal */ }
    }
  }

  return results
}

/** Detect a likely primary key column: first numeric column named *_id or 'id' */
function detectPkColumn(schema: { name: string; type: string }[]): string | null {
  const lowerCandidates = ['id', 'order_id', 'user_id', 'record_id', 'row_id', 'seq', 'sequence']
  for (const candidate of lowerCandidates) {
    const col = schema.find((c) => c.name.toLowerCase() === candidate)
    if (col && classifyColumn(col.type) === 'numeric') return col.name
  }
  // Fallback: first numeric column with "id" in name
  const idCol = schema.find(
    (c) => c.name.toLowerCase().includes('id') && classifyColumn(c.type) === 'numeric'
  )
  if (idCol) return idCol.name
  return null
}
