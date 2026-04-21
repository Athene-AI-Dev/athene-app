import { describe, it, expect, beforeAll } from 'vitest'
import { fetchSalesforceAccounts }      from '@/lib/integrations/salesforce/accounts-fetcher'
import { fetchSalesforceOpportunities } from '@/lib/integrations/salesforce/opportunities-fetcher'
import { fetchSalesforceCases }         from '@/lib/integrations/salesforce/cases-fetcher'
import { fetchHubSpotContacts }         from '@/lib/integrations/hubspot/contacts-fetcher'
import { fetchHubSpotCompanies }        from '@/lib/integrations/hubspot/companies-fetcher'
import { fetchHubSpotDeals }            from '@/lib/integrations/hubspot/deals-fetcher'
import { fetchHubSpotNotes }            from '@/lib/integrations/hubspot/notes-fetcher'
import { runSalesforceIndexPipeline }   from '@/lib/langgraph/tools/nango-salesforce'
import { runHubSpotIndexPipeline }      from '@/lib/langgraph/tools/nango-hubspot'

const SF_CONNECTION_ID = process.env.SF_CONNECTION_ID!
const SF_INSTANCE_URL  = process.env.SF_INSTANCE_URL!
const SF_ORG_ID        = process.env.SF_ORG_ID!
const HS_CONNECTION_ID = process.env.HS_CONNECTION_ID!
const HS_ORG_ID        = process.env.HS_ORG_ID!
const DB_CONNECTION_ID = process.env.DB_CONNECTION_ID!

beforeAll(() => {
  if (!SF_CONNECTION_ID || !SF_INSTANCE_URL || !SF_ORG_ID)
    throw new Error('Missing Salesforce env vars in .env.test.local')
  if (!HS_CONNECTION_ID || !HS_ORG_ID)
    throw new Error('Missing HubSpot env vars in .env.test.local')
})

function assertChunkShape(chunk: unknown): void {
  expect(chunk).toMatchObject({
    chunk_id:   expect.any(String),
    title:      expect.any(String),
    content:    expect.any(String),
    source_url: expect.any(String),
    metadata:   expect.objectContaining({
      provider:    expect.any(String),
      object_type: expect.any(String),
      id:          expect.any(String),
    }),
  })
  expect((chunk as { content: string }).content.length).toBeGreaterThan(0)
  expect((chunk as { chunk_id: string }).chunk_id).toMatch(/^(sf|hs)-/)
}

describe('Salesforce — real API', () => {
  it('fetches Accounts', async () => {
    const chunks = await fetchSalesforceAccounts(SF_CONNECTION_ID, SF_INSTANCE_URL, SF_ORG_ID)
    console.log(`Salesforce Accounts: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => {
      expect(c.chunk_id).toMatch(/^sf-account-/)
      expect(c.metadata.object_type).toBe('Account')
    })
  }, 30_000)

  it('fetches Opportunities', async () => {
    const chunks = await fetchSalesforceOpportunities(SF_CONNECTION_ID, SF_INSTANCE_URL, SF_ORG_ID)
    console.log(`Salesforce Opportunities: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => expect(c.chunk_id).toMatch(/^sf-opportunity-/))
  }, 30_000)

  it('fetches Cases', async () => {
    const chunks = await fetchSalesforceCases(SF_CONNECTION_ID, SF_INSTANCE_URL, SF_ORG_ID)
    console.log(`Salesforce Cases: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => expect(c.chunk_id).toMatch(/^sf-case-/))
  }, 30_000)
})

describe('HubSpot — real API', () => {
  it('fetches Contacts', async () => {
    const chunks = await fetchHubSpotContacts(HS_CONNECTION_ID, HS_ORG_ID)
    console.log(`HubSpot Contacts: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => expect(c.chunk_id).toMatch(/^hs-contact-/))
  }, 30_000)

  it('fetches Companies', async () => {
    const chunks = await fetchHubSpotCompanies(HS_CONNECTION_ID, HS_ORG_ID)
    console.log(`HubSpot Companies: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => expect(c.chunk_id).toMatch(/^hs-company-/))
  }, 30_000)

  it('fetches Deals', async () => {
    const chunks = await fetchHubSpotDeals(HS_CONNECTION_ID, HS_ORG_ID)
    console.log(`HubSpot Deals: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => expect(c.chunk_id).toMatch(/^hs-deal-/))
  }, 30_000)

  it('fetches Notes', async () => {
    const chunks = await fetchHubSpotNotes(HS_CONNECTION_ID, HS_ORG_ID)
    console.log(`HubSpot Notes: ${chunks.length}`)
    if (chunks.length > 0) console.log('Sample:', JSON.stringify(chunks[0], null, 2))
    expect(Array.isArray(chunks)).toBe(true)
    chunks.forEach(assertChunkShape)
    chunks.forEach(c => expect(c.chunk_id).toMatch(/^hs-note-/))
  }, 30_000)
})

describe('Indexing pipeline — real API + real Supabase', () => {
  it('indexes Salesforce — no content in DB', async () => {
    const result = await runSalesforceIndexPipeline({
      orgId:          SF_ORG_ID,
      connectionId:   SF_CONNECTION_ID,
      dbConnectionId: DB_CONNECTION_ID,
      instanceUrl:    SF_INSTANCE_URL,
      visibility:     'department',
    })
    console.log('Salesforce index result:', result)
    expect(result.failed).toBe(0)
    expect(result.indexed).toBeGreaterThanOrEqual(0)
  }, 120_000)

  it('indexes HubSpot — no content in DB', async () => {
    const result = await runHubSpotIndexPipeline({
      orgId:          HS_ORG_ID,
      connectionId:   HS_CONNECTION_ID,
      dbConnectionId: DB_CONNECTION_ID,
      visibility:     'department',
    })
    console.log('HubSpot index result:', result)
    expect(result.failed).toBe(0)
    expect(result.indexed).toBeGreaterThanOrEqual(0)
  }, 120_000)

  it('confirms no content stored in document_embeddings', async () => {
    const { supabaseAdmin } = await import('@/lib/supabase/server')
    const { data, error } = await supabaseAdmin
      .from('document_embeddings')
      .select('*')
      .limit(10)

    expect(error).toBeNull()
    for (const row of data ?? []) {
      expect(row).not.toHaveProperty('content')
      expect(row).not.toHaveProperty('body')
      expect(row).not.toHaveProperty('text')
      expect(row).not.toHaveProperty('raw')
    }
    console.log(`Verified ${data?.length ?? 0} rows — no content stored`)
  }, 30_000)
})