/**
 * Cost-statistics host-half tests: peak-window and statutory-holiday
 * classification, period pricing, session-cost folding, response parsing, and
 * the exact-route registration against a real webserver.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import WebServer from '@deepseek-ai/dsh-host-webserver'
import { SessionStore } from '@deepseek-ai/dsh-session'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import type { Session } from '@deepseek-ai/dsh-session'
import {
  apply,
  canonicalModel,
  foldSessionCost,
  isPeakPeriod,
  parseBalanceInfo,
  peakPricesAt,
  pricesAt,
  pricesFor,
  sessionCostYuan,
  type ModelPrices,
} from '../src/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
})

describe('isPeakPeriod', () => {
  it('classifies weekday peak windows as peak', () => {
    // Monday 2026-08-24 09:00 and 11:59 are peak; 10:00 is peak.
    expect(isPeakPeriod(new Date(2026, 7, 24, 9, 0))).toBe(true)
    expect(isPeakPeriod(new Date(2026, 7, 24, 10, 0))).toBe(true)
    expect(isPeakPeriod(new Date(2026, 7, 24, 11, 59))).toBe(true)
    // Monday 14:00–17:59 afternoon window.
    expect(isPeakPeriod(new Date(2026, 7, 24, 14, 0))).toBe(true)
    expect(isPeakPeriod(new Date(2026, 7, 24, 17, 59))).toBe(true)
  })

  it('classifies non-peak weekday hours as off-peak', () => {
    expect(isPeakPeriod(new Date(2026, 7, 24, 8, 59))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 7, 24, 12, 0))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 7, 24, 13, 59))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 7, 24, 18, 0))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 7, 24, 23, 0))).toBe(false)
  })

  it('treats weekends as always off-peak (2026-08-23 rule)', () => {
    expect(isPeakPeriod(new Date(2026, 7, 29, 10, 0))).toBe(false) // Saturday
    expect(isPeakPeriod(new Date(2026, 7, 30, 15, 0))).toBe(false) // Sunday
  })

  it('treats statutory holidays as off-peak for the whole day', () => {
    // 2026 statutory holidays that fall on a weekday and would otherwise peak:
    // 中秋 09-25 (Friday), 国庆 10-01 (Thursday) and 10-06 (Tuesday).
    expect(isPeakPeriod(new Date(2026, 8, 25, 10, 0))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 8, 25, 15, 0))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 9, 1, 10, 0))).toBe(false)
    expect(isPeakPeriod(new Date(2026, 9, 6, 15, 0))).toBe(false)
    // The same clock on an ordinary weekday still peaks.
    expect(isPeakPeriod(new Date(2026, 8, 24, 10, 0))).toBe(true) // Thursday 09-24
  })

  it('honours an explicit holiday calendar', () => {
    const holidays = new Set(['2026-09-24'])
    expect(isPeakPeriod(new Date(2026, 8, 24, 10, 0), holidays)).toBe(false)
    // A neighbouring day is unaffected.
    expect(isPeakPeriod(new Date(2026, 8, 23, 10, 0), holidays)).toBe(true)
  })
})

describe('pricesFor', () => {
  const flash: ModelPrices = { input: 3.0, cacheRead: 0.1, output: 9.0 }

  it('returns peak prices at peak', () => {
    expect(pricesFor(flash, 'peak')).toEqual({ input: 3.0, cacheRead: 0.1, output: 9.0 })
  })

  it('returns exactly half the peak prices off-peak', () => {
    expect(pricesFor(flash, 'off-peak')).toEqual({ input: 1.5, cacheRead: 0.05, output: 4.5 })
  })
})

describe('peakPricesAt', () => {
  // 2026-09-10 12:00 Beijing cut flash prices; 2026-09-14 12:00 routes pro to flash.
  const beforeCut = Date.parse('2026-09-01T10:00:00+08:00')
  const afterCut = Date.parse('2026-09-18T10:00:00+08:00')

  it('bills flash at the old rates before the price cut', () => {
    expect(peakPricesAt('deepseek-v4-flash', beforeCut)).toEqual({ input: 3.0, cacheRead: 0.1, output: 9.0 })
    expect(peakPricesAt('deepseek-v4-flash-vision-exp', beforeCut)).toEqual({ input: 3.0, cacheRead: 0.1, output: 9.0 })
  })

  it('bills flash at the new rates from the price cut on', () => {
    expect(peakPricesAt('deepseek-v4-flash', afterCut)).toEqual({ input: 2.0, cacheRead: 0.04, output: 8.0 })
    expect(peakPricesAt('deepseek-flash', afterCut)).toEqual({ input: 2.0, cacheRead: 0.04, output: 8.0 })
  })

  it('keeps pro rates until pro routes to flash, then bills flash rates', () => {
    const beforeRouting = Date.parse('2026-09-11T10:00:00+08:00')
    const afterRouting = Date.parse('2026-09-15T10:00:00+08:00')
    expect(peakPricesAt('deepseek-v4-pro', beforeRouting)).toEqual({ input: 9.0, cacheRead: 0.3, output: 27.0 })
    expect(peakPricesAt('deepseek-v4-pro', afterRouting)).toEqual({ input: 2.0, cacheRead: 0.04, output: 8.0 })
  })

  it('falls back to flash rates for an unknown model', () => {
    expect(peakPricesAt('deepseek-v9-mystery', afterCut)).toEqual({ input: 2.0, cacheRead: 0.04, output: 8.0 })
  })
})

describe('pricesAt', () => {
  it('halves the rates off-peak and names the period', () => {
    // Monday 2026-09-21: 10:00 is inside a peak window, 12:30 is not.
    expect(pricesAt('deepseek-flash', Date.parse('2026-09-21T10:00:00+08:00')))
      .toEqual({ input: 2.0, cacheRead: 0.04, output: 8.0, period: 'peak' })
    expect(pricesAt('deepseek-flash', Date.parse('2026-09-21T12:30:00+08:00')))
      .toEqual({ input: 1.0, cacheRead: 0.02, output: 4.0, period: 'off-peak' })
  })

  it('bills a statutory holiday at off-peak rates during a peak window', () => {
    // 中秋 2026-09-25 is a Friday whose 10:00 would otherwise be peak.
    expect(pricesAt('deepseek-flash', Date.parse('2026-09-25T10:00:00+08:00')))
      .toEqual({ input: 1.0, cacheRead: 0.02, output: 4.0, period: 'off-peak' })
  })
})

describe('canonicalModel', () => {
  it('folds the retired flash aliases onto the current flash id', () => {
    expect(canonicalModel('deepseek-v4-flash')).toBe('deepseek-flash')
    expect(canonicalModel('deepseek-v4-flash-vision-exp')).toBe('deepseek-flash')
  })

  it('keeps every other id verbatim (pro still bills on its own)', () => {
    expect(canonicalModel('deepseek-flash')).toBe('deepseek-flash')
    expect(canonicalModel('deepseek-v4-pro')).toBe('deepseek-v4-pro')
    expect(canonicalModel('deepseek-v9-mystery')).toBe('deepseek-v9-mystery')
  })
})

describe('foldSessionCost', () => {
  interface EventInput {
    model: string
    usage: { inputTokens: number; outputTokens: number }
  }

  async function sessionWithEvents(events: EventInput[]): Promise<{ ctx: Context; session: Session }> {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId(`balance-${Math.random()}`))
    for (const { model, usage } of events) {
      session.append('assistant/message', {
        turn: 1,
        step: 1,
        message: {
          id: `m-${Math.random()}`,
          role: 'assistant',
          content: [{ type: 'text', text: 'hi' }],
          source: { kind: 'model', provider: 'deepseek-official', model },
        },
        usage,
      } as never, { surfaceOp: 'append' })
    }
    return { ctx, session }
  }

  it('returns undefined for a session with no usage events', async () => {
    const { ctx, session } = await sessionWithEvents([])
    expect(foldSessionCost(session)).toBeUndefined()
    await ctx.fiber.dispose()
  })

  it('merges a session that spans the flash rename into one model row', async () => {
    const { ctx, session } = await sessionWithEvents([
      { model: 'deepseek-v4-flash-vision-exp', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
      { model: 'deepseek-flash', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    ])
    const result = foldSessionCost(session)
    expect(result?.models.map(row => row.model)).toEqual(['deepseek-flash'])
    expect(result?.models[0]?.requests).toBe(2)
    expect(result?.requests).toBe(2)
    expect(result?.lastModel).toBe('deepseek-flash')
    await ctx.fiber.dispose()
  })

  it('splits one session across its models and billing buckets', async () => {
    const { ctx, session } = await sessionWithEvents([
      { model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
      { model: 'deepseek-v4-pro', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    ])
    const result = foldSessionCost(session)
    expect(result?.requests).toBe(2)
    expect(result?.lastModel).toBe('deepseek-v4-pro')
    expect(result?.models.map(row => row.model).sort()).toEqual(['deepseek-flash', 'deepseek-v4-pro'])
    // The split is additive: per-model rows and per-bucket rows both sum to total.
    const rowTotal = (result?.models ?? []).reduce((sum, row) => sum + row.total, 0)
    expect(rowTotal).toBeCloseTo(result?.total ?? 0, 9)
    const buckets = result?.buckets
    expect((buckets?.cacheRead ?? 0) + (buckets?.uncachedInput ?? 0) + (buckets?.output ?? 0))
      .toBeCloseTo(result?.total ?? 0, 9)
    await ctx.fiber.dispose()
  })

  it('bills every request at its own moment (rates never mix across the log)', async () => {
    const { ctx, session } = await sessionWithEvents([
      { model: 'deepseek-v4-flash', usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 } },
    ])
    const result = foldSessionCost(session)
    // The fixture appends at this run's moment, so the expected total reads the
    // event's own timestamp instead of a fixed rate table (peak windows and the
    // price cut would otherwise make the assertion run-time dependent).
    const stamp = session.snapshotEvents()[0]!.time
    const expected = sessionCostYuan({
      uncachedInputTokens: 1_000_000,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 1_000_000,
    }, pricesAt('deepseek-v4-flash', stamp))
    expect(result?.total).toBeCloseTo(expected, 6)
    await ctx.fiber.dispose()
  })

  it('skips steps without usage or a model source', async () => {
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create(SessionId('balance-no-usage'))
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message: {
        id: 'm-no-usage',
        role: 'assistant',
        content: [{ type: 'text', text: 'hi' }],
        source: { kind: 'model', provider: 'deepseek-official', model: 'deepseek-v4-flash' },
      },
    } as never, { surfaceOp: 'append' })
    expect(foldSessionCost(session)).toBeUndefined()
    await ctx.fiber.dispose()
  })
})

describe('sessionCostYuan', () => {
  const prices = { input: 3.0, cacheRead: 0.1, output: 9.0 }

  it('returns 0 without usage', () => {
    expect(sessionCostYuan(undefined, prices)).toBe(0)
  })

  it('bills the four disjoint buckets at their rates (cache writes at input rate)', () => {
    const usage = {
      uncachedInputTokens: 1_000_000,
      cacheReadTokens: 2_000_000,
      cacheWriteTokens: 500_000,
      outputTokens: 1_000_000,
    }
    // 1M*3 + 2M*0.1 + 0.5M*3 + 1M*9 = 3 + 0.2 + 1.5 + 9 = 13.7
    expect(sessionCostYuan(usage, prices)).toBeCloseTo(13.7, 6)
  })
})

describe('parseBalanceInfo', () => {
  it('extracts the first account row', () => {
    const raw = {
      is_available: true,
      balance_infos: [
        { currency: 'CNY', total_balance: '110.00', granted_balance: '10.00', topped_up_balance: '100.00' },
      ],
    }
    expect(parseBalanceInfo(raw)).toEqual({ currency: 'CNY', total_balance: '110.00' })
  })

  it('returns undefined on unexpected shapes', () => {
    expect(parseBalanceInfo(undefined)).toBeUndefined()
    expect(parseBalanceInfo({})).toBeUndefined()
    expect(parseBalanceInfo({ balance_infos: [] })).toBeUndefined()
    expect(parseBalanceInfo({ balance_infos: [{ currency: 'CNY' }] })).toBeUndefined()
  })
})

describe('web-balance route registration', () => {
  it('registers the exact /api/dsh-balance route on the webserver', async () => {
    // No key configured: the route serves prices/period without a balance row
    // and without any network call to the DeepSeek API.
    vi.stubEnv('DEEPSEEK_API_KEY', '')
    const ctx = new Context()
    contexts.push(ctx)
    await ctx.plugin(WebServer, { host: '127.0.0.1', port: 0 })
    await ctx.plugin({ apply })

    // The route answers without a key: prices and period are served, no error.
    const response = await fetch(`http://127.0.0.1:${ctx.webServer.port}/api/dsh-balance`)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { prices?: { period?: string }; error?: string }
    expect(body.error).toBeUndefined()
    expect(body.prices?.period).toBeDefined()

    // The exact route wins over the /api prefix fallback.
    const miss = await fetch(`http://127.0.0.1:${ctx.webServer.port}/api/other`)
    expect(miss.status).toBe(404)
    vi.unstubAllEnvs()
  })
})
