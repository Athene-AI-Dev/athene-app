# Contributing to Athene App

## Test Coverage Requirements

All PRs must maintain the following minimum coverage thresholds across `lib/`:

| Metric | Threshold |
|--------|-----------|
| Lines | 60% |
| Functions | 60% |
| Branches | 50% |
| Statements | 60% |

The `unit-tests` CI job enforces these thresholds. A PR that drops coverage below the threshold will fail CI and cannot be merged.

### Running tests locally

```bash
# Run all unit tests
pnpm exec vitest run

# Run with coverage report
pnpm exec vitest run --coverage

# Watch mode during development
pnpm exec vitest
```

### Writing tests

- Place tests co-located with source: `lib/langgraph/nodes/__tests__/action-executor.test.ts`
- Use `vi.mock()` at the module level to mock external dependencies (Supabase, Nango, LLMs)
- Mock at the HTTP client level for integration providers — not at the integration boundary
- New `lib/` modules must include a corresponding test file before merging

## Code Style

- TypeScript strict mode is enforced — no `any` without justification
- ESLint + Prettier configured (`pnpm exec eslint .` / `pnpm exec prettier --check .`)
- No inline `console.log` — use `lib/logger` (pino-based, structured)
