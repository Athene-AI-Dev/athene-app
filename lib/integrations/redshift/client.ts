import { getProviderMetadata } from '../base'
import { awsSign } from './sigv4'

export interface RedshiftCredentials {
  region: string
  clusterId: string
  dbUser: string
  database: string
  accessKeyId: string
  secretAccessKey: string
  allowlist: string[]
}

export async function getRedshiftCredentials(
  connectionId: string,
  orgId: string,
): Promise<RedshiftCredentials> {
  const meta = await getProviderMetadata(connectionId, 'redshift', orgId)
  const region       = meta.region          as string | undefined
  const clusterId    = meta.cluster_id      as string | undefined
  const dbUser       = meta.db_user         as string | undefined
  const database     = meta.database        as string | undefined
  const accessKeyId  = meta.access_key_id   as string | undefined
  const secretAccessKey = meta.secret_access_key as string | undefined

  if (!region || !clusterId || !dbUser || !database || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Redshift connection requires: region, cluster_id, db_user, database, access_key_id, secret_access_key in metadata'
    )
  }

  return {
    region,
    clusterId,
    dbUser,
    database,
    accessKeyId,
    secretAccessKey,
    allowlist: (meta.allowlist as string[] | undefined) ?? [],
  }
}

export async function redshiftDataExecute(
  creds: RedshiftCredentials,
  sql: string,
): Promise<string> {
  const url = `https://redshift-data.${creds.region}.amazonaws.com/`
  const body = JSON.stringify({
    ClusterIdentifier: creds.clusterId,
    DbUser: creds.dbUser,
    Database: creds.database,
    Sql: sql,
  })
  const headers = awsSign('POST', url, body, creds.region, 'redshift-data', creds.accessKeyId, creds.secretAccessKey, 'RedshiftData.ExecuteStatement')

  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`Redshift ExecuteStatement failed: ${res.status} ${await res.text()}`)
  const json = await res.json() as { Id: string }
  return json.Id
}

export async function redshiftDataPoll(
  creds: RedshiftCredentials,
  statementId: string,
  maxWaitMs = 30_000,
): Promise<void> {
  const url = `https://redshift-data.${creds.region}.amazonaws.com/`
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const body = JSON.stringify({ Id: statementId })
    const headers = awsSign('POST', url, body, creds.region, 'redshift-data', creds.accessKeyId, creds.secretAccessKey, 'RedshiftData.DescribeStatement')
    const res = await fetch(url, { method: 'POST', headers, body })
    if (!res.ok) throw new Error(`Redshift DescribeStatement failed: ${res.status}`)
    const json = await res.json() as { Status: string; Error?: string }
    if (json.Status === 'FINISHED') return
    if (json.Status === 'FAILED') throw new Error(`Redshift query failed: ${json.Error ?? 'unknown'}`)
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error('Redshift query timed out')
}

export async function redshiftDataGetResults(
  creds: RedshiftCredentials,
  statementId: string,
): Promise<Record<string, string>[]> {
  const url = `https://redshift-data.${creds.region}.amazonaws.com/`
  const body = JSON.stringify({ Id: statementId })
  const headers = awsSign('POST', url, body, creds.region, 'redshift-data', creds.accessKeyId, creds.secretAccessKey, 'RedshiftData.GetStatementResult')
  const res = await fetch(url, { method: 'POST', headers, body })
  if (!res.ok) throw new Error(`Redshift GetStatementResult failed: ${res.status}`)

  const json = await res.json() as {
    ColumnMetadata: { name: string }[]
    Records: { stringValue?: string; longValue?: number; doubleValue?: number; isNull?: boolean }[][]
  }

  const cols = json.ColumnMetadata.map((c) => c.name)
  return json.Records.map((row) => {
    const obj: Record<string, string> = {}
    cols.forEach((col, i) => {
      const cell = row[i]
      obj[col] = cell?.isNull ? 'NULL' : String(cell?.stringValue ?? cell?.longValue ?? cell?.doubleValue ?? '')
    })
    return obj
  })
}

export async function redshiftQuery(
  creds: RedshiftCredentials,
  sql: string,
): Promise<Record<string, string>[]> {
  const statementId = await redshiftDataExecute(creds, sql)
  await redshiftDataPoll(creds, statementId)
  return redshiftDataGetResults(creds, statementId)
}

export interface RedshiftTable {
  schema: string
  name: string
  fullName: string // "schema.table"
}

export async function listRedshiftTables(connectionId: string, orgId: string): Promise<RedshiftTable[]> {
  const creds = await getRedshiftCredentials(connectionId, orgId)
  const rows = await redshiftQuery(
    creds,
    `SELECT table_schema, table_name
     FROM information_schema.tables
     WHERE table_type = 'BASE TABLE'
       AND table_schema NOT IN ('pg_catalog','information_schema','pg_internal','catalog_history')
     ORDER BY table_schema, table_name
     LIMIT 500`,
  )
  return rows.map((r) => ({
    schema: String(r.table_schema),
    name: String(r.table_name),
    fullName: `${r.table_schema}.${r.table_name}`,
  }))
}
