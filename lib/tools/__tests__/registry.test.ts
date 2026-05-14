import { describe, it, expect } from 'vitest'
import {
  getToolsForRole,
  getToolNamesForRole,
  getToolMeta,
  getToolByName,
  getAllToolMeta,
} from '../registry'
import type { ToolName } from '../types'

// ─── Role-gating tests ──────────────────────────────────────────────────────

describe('Tool Registry — getToolsForRole', () => {
  it('member gets vectorSearch, draftEmail, draftCalendarEvent, planReport but NOT crossDeptVectorSearch', () => {
    const names = getToolNamesForRole('member')

    expect(names).toContain('vectorSearch')
    expect(names).toContain('draftEmail')
    expect(names).toContain('draftCalendarEvent')
    expect(names).toContain('planReport')
    expect(names).not.toContain('crossDeptVectorSearch')
  })

  it('super_user (BI analyst) gets ALL tools including crossDeptVectorSearch', () => {
    const names = getToolNamesForRole('super_user')

    expect(names).toContain('vectorSearch')
    expect(names).toContain('crossDeptVectorSearch')
    expect(names).toContain('draftEmail')
    expect(names).toContain('draftCalendarEvent')
    expect(names).toContain('planReport')
    expect(names).toHaveLength(5)
  })

  it('admin gets ALL tools', () => {
    const names = getToolNamesForRole('admin')

    expect(names).toContain('vectorSearch')
    expect(names).toContain('crossDeptVectorSearch')
    expect(names).toContain('draftEmail')
    expect(names).toContain('draftCalendarEvent')
    expect(names).toContain('planReport')
    expect(names).toHaveLength(5)
  })

  it('getToolsForRole returns DynamicStructuredTool instances with correct count', () => {
    const memberTools = getToolsForRole('member')
    const superTools = getToolsForRole('super_user')
    const adminTools = getToolsForRole('admin')

    expect(memberTools).toHaveLength(4)
    expect(superTools).toHaveLength(5)
    expect(adminTools).toHaveLength(5)

    // Verify they are real tool instances with a name property
    for (const tool of memberTools) {
      expect(tool).toHaveProperty('name')
      expect(tool).toHaveProperty('schema')
    }
  })

  it('null role (unauthenticated) gets zero tools', () => {
    const tools = getToolsForRole(null)
    const names = getToolNamesForRole(null)
    expect(tools).toHaveLength(0)
    expect(names).toHaveLength(0)
  })
})

// ─── Tool metadata tests ────────────────────────────────────────────────────

describe('Tool Registry — metadata', () => {
  it('getToolMeta returns correct metadata for vectorSearch', () => {
    const meta = getToolMeta('vectorSearch')

    expect(meta.name).toBe('vectorSearch')
    expect(meta.displayName).toBe('Vector Search')
    expect(meta.requiresApproval).toBe(false)
    expect(meta.allowedRoles).toEqual(['member', 'super_user', 'admin'])
  })

  it('getToolMeta returns correct metadata for crossDeptVectorSearch', () => {
    const meta = getToolMeta('crossDeptVectorSearch')

    expect(meta.allowedRoles).toEqual(['super_user', 'admin'])
    expect(meta.allowedRoles).not.toContain('member')
  })

  it('getAllToolMeta returns all 5 tools', () => {
    const all = getAllToolMeta()
    expect(all).toHaveLength(5)

    const names = all.map((m) => m.name)
    expect(names).toContain('vectorSearch')
    expect(names).toContain('crossDeptVectorSearch')
    expect(names).toContain('draftEmail')
    expect(names).toContain('draftCalendarEvent')
    expect(names).toContain('planReport')
  })
})

// ─── Tool lookup tests ──────────────────────────────────────────────────────

describe('Tool Registry — getToolByName', () => {
  it('returns the correct tool instance', () => {
    const tool = getToolByName('draftEmail')
    expect(tool.name).toBe('draftEmail')
  })

  it('throws for an unknown tool name', () => {
    expect(() => getToolByName('nonExistentTool' as ToolName)).toThrow(
      'Unknown tool',
    )
  })
})

// ─── Zod schema validation tests ────────────────────────────────────────────

describe('Tool Registry — Zod schemas', () => {
  it('vectorSearch tool can be invoked with valid input', async () => {
    const tool = getToolByName('vectorSearch')
    const result = await tool.invoke({ query: 'quarterly revenue', top_k: 3 })
    const parsed = JSON.parse(result)

    expect(parsed.tool).toBe('vectorSearch')
    expect(parsed.query).toBe('quarterly revenue')
    expect(parsed.top_k).toBe(3)
  })

  it('draftEmail tool produces a structured draft', async () => {
    const tool = getToolByName('draftEmail')
    const result = await tool.invoke({
      to: ['alice@example.com'],
      subject: 'Q1 Summary',
      body: 'Hi Alice, here is the summary...',
    })
    const parsed = JSON.parse(result)

    expect(parsed.tool).toBe('draftEmail')
    expect(parsed.draft.to).toEqual(['alice@example.com'])
    expect(parsed.draft.subject).toBe('Q1 Summary')
  })

  it('crossDeptVectorSearch tool requires department_ids', async () => {
    const tool = getToolByName('crossDeptVectorSearch')
    const result = await tool.invoke({
      query: 'cross-team synergy',
      department_ids: ['dept-sales', 'dept-eng'],
      top_k: 5,
    })
    const parsed = JSON.parse(result)

    expect(parsed.tool).toBe('crossDeptVectorSearch')
    expect(parsed.department_ids).toEqual(['dept-sales', 'dept-eng'])
  })

  it('draftCalendarEvent rejects invalid ISO-8601 start/end strings', async () => {
    const tool = getToolByName('draftCalendarEvent')
    // Zod parse-level rejection — invoke catches and returns error string
    await expect(
      tool.invoke({ summary: 'Test', start: 'next tuesday', end: 'after lunch' })
    ).rejects.toThrow()
  })

  it('draftCalendarEvent accepts valid ISO-8601 start/end strings', async () => {
    const tool = getToolByName('draftCalendarEvent')
    const result = await tool.invoke({
      summary: 'Standup',
      start: '2024-06-15T09:00:00Z',
      end: '2024-06-15T09:30:00Z',
    })
    const parsed = JSON.parse(result)
    expect(parsed.tool).toBe('draftCalendarEvent')
    expect(parsed.draft.summary).toBe('Standup')
    expect(parsed.draft.start).toBe('2024-06-15T09:00:00Z')
    expect(parsed.draft.end).toBe('2024-06-15T09:30:00Z')
  })
})
