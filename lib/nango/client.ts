import { Nango } from '@nangohq/node'

const nango = new Nango({
  secretKey: process.env.NANGO_SECRET_KEY!
})

// Get fresh access token
export async function getToken(
  connectionId: string,
  providerConfigKey: string
): Promise<string> {
  const conn = await nango.getConnection(providerConfigKey, connectionId)
  return conn.credentials.access_token
}

// List connections (optional)
export async function listConnections(orgId: string) {
  return nango.listConnections()
}