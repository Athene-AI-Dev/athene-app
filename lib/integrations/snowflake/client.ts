import { getToken, getConnection } from '@/lib/nango/client'

export async function snowflakeFetch(connectionId: string, sql: string, retryCount = 0): Promise<any> {
  const token = await getToken(connectionId, 'snowflake')
  const connection = await getConnection(connectionId, 'snowflake')
  
  const accountIdentifier = connection.metadata?.account_identifier
  if (!accountIdentifier) {
    throw new Error('Snowflake account identifier not found in connection metadata. Please ensure it is configured in Nango.')
  }

  const response = await fetch(`https://${accountIdentifier}.snowflakecomputing.com/api/v2/statements`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Snowflake-Authorization-Token-Type': 'OAUTH',
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      statement: sql,
      timeout: 60
    })
  })

  if (response.status === 429 && retryCount < 3) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10)
    console.warn(`[Snowflake API] Rate limited. Retrying after ${retryAfter}s...`)
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
    return snowflakeFetch(connectionId, sql, retryCount + 1)
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Snowflake API Error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
  }

  return response.json()
}
