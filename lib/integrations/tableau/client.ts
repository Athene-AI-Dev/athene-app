import { baseFetch, getProviderMetadata } from '../base'

interface TableauSession {
  token: string
  siteId: string
  serverUrl: string
}

/** Signs in to Tableau using a Personal Access Token from connection metadata */
export async function tableauSignIn(connectionId: string, orgId: string): Promise<TableauSession> {
  const meta = await getProviderMetadata(connectionId, 'tableau', orgId)
  const serverUrl = (meta.server_url as string | undefined)?.replace(/\/$/, '')
  const tokenName = meta.token_name as string | undefined
  const tokenValue = meta.token_value as string | undefined
  const siteName = (meta.site_name as string | undefined) ?? ''

  if (!serverUrl || !tokenName || !tokenValue) {
    throw new Error('Tableau requires server_url, token_name, and token_value in connection metadata')
  }

  const res = await baseFetch<any>(`${serverUrl}/api/3.21/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: {
      credentials: {
        personalAccessTokenName: tokenName,
        personalAccessTokenSecret: tokenValue,
        site: { contentUrl: siteName },
      },
    },
  })

  const token = res?.credentials?.token as string | undefined
  const siteId = res?.credentials?.site?.id as string | undefined
  if (!token || !siteId) throw new Error('Tableau sign-in failed: no token in response')

  return { token, siteId, serverUrl }
}

export async function tableauFetch<T = unknown>(
  session: TableauSession,
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  return baseFetch<T>(`${session.serverUrl}/api/3.21${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'X-Tableau-Auth': session.token,
      'Accept': 'application/json',
    },
    ...(options.body != null ? { body: options.body } : {}),
  })
}
