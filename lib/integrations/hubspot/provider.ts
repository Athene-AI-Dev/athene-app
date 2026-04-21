import { registerProvider } from '@/lib/langgraph/tools/live-doc-fetch'
import { hubspotFetch }     from './client'

const HUBSPOT_PROPERTIES: Record<string, string> = {
  contact: 'firstname,lastname,email,phone,company',
  company: 'name,domain,industry,description',
  deal:    'dealname,dealstage,pipeline,amount',
  note:    'hs_note_body,hs_timestamp,hubspot_owner_id',
}

const HUBSPOT_PATHS: Record<string, string> = {
  contact: 'contacts',
  company: 'companies',
  deal:    'deals',
  note:    'notes',
}

registerProvider('hubspot', async ({ orgId, connectionId, externalId }) => {
  // externalId format: "hs-contact-12345" | "hs-company-12345" etc.
  const parts      = externalId.split('-')
  const objectType = parts[1]
  const hsId       = parts.slice(2).join('-')

  if (!objectType || !hsId) {
    console.warn(`[hubspot-provider] malformed externalId: "${externalId}"`)
    return null
  }

  const properties = HUBSPOT_PROPERTIES[objectType]
  const apiPath    = HUBSPOT_PATHS[objectType]

  if (!properties || !apiPath) {
    console.warn(`[hubspot-provider] unknown objectType: "${objectType}"`)
    return null
  }

  const data = await hubspotFetch(
    connectionId,
    `/crm/v3/objects/${apiPath}/${hsId}?properties=${properties}`,
    orgId
  ) as { id: string; properties: Record<string, string | null> }

  const p     = data.properties
  const title =
    [p['firstname'], p['lastname']].filter(Boolean).join(' ') ||
    p['name']     ??
    p['dealname'] ??
    p['hs_note_body']?.slice(0, 60) ??
    hsId

  const content = Object.entries(p)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')

  return { content, title }
})