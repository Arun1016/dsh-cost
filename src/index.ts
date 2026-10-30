/**
 * Account balance and per-session cost: the `/api/dsh-balance` host route the
 * composer-dock pill polls. The route resolves the DeepSeek API key through the
 * credentials seam, reads the official account balance from the DeepSeek API,
 * prices the current session's token usage at the official peak/off-peak rates,
 * folds the live log per request so a session spanning the 2026-09-10 price
 * cut, the pro-to-flash routing, or a peak boundary never mixes rate tables,
 * and counts the session's successful web search / web fetch requests, which
 * the official price table bills per request from 2026-11-01 00:00 Beijing.
 *
 * Price, period, and statutory-holiday facts live here, in the owning package:
 * an official change is one edit plus its tests.
 * @module dsh-cost-pill
 */

import { request as httpsRequest } from 'node:https'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { Session } from '@deepseek-ai/dsh-session'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter'

/** Stable Cordis plugin name. */
export const name = 'cost-stats'

/** Services required before the balance route can register. */
export const inject = ['webServer']

/**
 * Statutory-holiday dates (Beijing local calendar, `YYYY-MM-DD`) that bill at
 * off-peak rates for the whole day. The official rule makes every statutory
 * holiday and every weekend off-peak regardless of the clock, including a
 * weekend that holiday adjustment turns into a workday. Dates come from the
 * State Council's annual notice (国办发明电〔2025〕7号 for 2026); a deployment
 * overrides them through Config when the next year is published.
 */
const DEFAULT_HOLIDAYS = [
  // 元旦 2026-01-01..01-03
  '2026-01-01', '2026-01-02', '2026-01-03',
  // 春节 2026-02-15..02-23
  '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20',
  '2026-02-21', '2026-02-22', '2026-02-23',
  // 清明 2026-04-04..04-06
  '2026-04-04', '2026-04-05', '2026-04-06',
  // 劳动节 2026-05-01..05-05
  '2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05',
  // 端午 2026-06-19..06-21
  '2026-06-19', '2026-06-20', '2026-06-21',
  // 中秋 2026-09-25..09-27
  '2026-09-25', '2026-09-26', '2026-09-27',
  // 国庆 2026-10-01..10-07
  '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07',
]

/** The shipped calendar as a lookup set, and the default for every classifier. */
const DEFAULT_HOLIDAY_SET: ReadonlySet<string> = new Set(DEFAULT_HOLIDAYS)

/** Plugin config: the statutory-holiday calendar that classifies billing periods. */
export interface Config {
  /** Beijing-local `YYYY-MM-DD` dates billed off-peak for the whole day. */
  holidays: string[]
}

/** Config schema; the shipped default is the current statutory-holiday notice. */
export const Config: z<Config> = z.object({
  holidays: z.array(String).default(DEFAULT_HOLIDAYS),
})

/**
 * One model's per-million-token prices in CNY, keyed by billing bucket.
 * Every stored figure is a peak rate: off-peak is always exactly half the
 * peak (official rule), so the tables carry peak only and `pricesFor` halves.
 */
export interface ModelPrices {
  /** Uncached input, CNY per million tokens at peak. */
  input: number
  /** Cache-hit input, CNY per million tokens at peak. */
  cacheRead: number
  /** Output, CNY per million tokens at peak. */
  output: number
}

/** Flash peak rates before the 2026-09-10 (Beijing) price cut. */
const FLASH_PRICES_BEFORE_CUT: ModelPrices = { input: 3.0, cacheRead: 0.1, output: 9.0 }

/** Flash peak rates from the 2026-09-10 (Beijing) price cut on. */
const FLASH_PRICES_AFTER_CUT: ModelPrices = { input: 2.0, cacheRead: 0.04, output: 8.0 }

/** `deepseek-v4-pro` peak rates, valid while that model still serves itself. */
const PRO_PRICES: ModelPrices = { input: 9.0, cacheRead: 0.3, output: 27.0 }

/**
 * When the official flash price cut took effect: 2026-09-10 12:00 Beijing.
 * Requests before it bill at `FLASH_PRICES_BEFORE_CUT` and requests after it
 * at `FLASH_PRICES_AFTER_CUT`, so one session can legitimately span both.
 */
const FLASH_CUT_MS = Date.parse('2026-09-10T12:00:00+08:00')

/**
 * When `deepseek-v4-pro` requests started routing to V4.1 Flash and billing at
 * the flash rates: 2026-09-14 12:00 Beijing, per the official announcement.
 */
const PRO_ROUTED_TO_FLASH_MS = Date.parse('2026-09-14T12:00:00+08:00')

/** The model id the official docs now use for the whole flash family. */
const FLASH_MODEL = 'deepseek-flash'

/** The model id whose rates price a session that reports no usable model. */
const FALLBACK_MODEL = FLASH_MODEL

/**
 * The official per-request price of a successful Search or Fetch call: the
 * price page lists both APIs at ¥5 per 1,000 successful requests, so each
 * request bills ¥0.005. The price does not depend on the billing period, and
 * failures, empty searches and timeouts are not charged.
 */
const WEB_CALL_PRICE_YUAN = 5 / 1000

/**
 * When Search and Fetch requests started billing: 2026-11-01 00:00 Beijing,
 * per the official announcement. Requests made before this moment were free,
 * so a session that spans the boundary bills only its later requests.
 */
const WEB_CALL_BILLING_START_MS = Date.parse('2026-11-01T00:00:00+08:00')

/** The model-facing tool whose per-query Search API requests bill individually. */
const WEB_SEARCH_TOOL = 'web_search'

/** The model-facing tool whose single Fetch API request bills individually. */
const WEB_FETCH_TOOL = 'web_fetch'

/** Official DeepSeek account-balance endpoint. */
const BALANCE_URL = 'https://api.deepseek.com/user/balance'

/** Credential reference for the DeepSeek API key, matching llm-deepseek's default. */
const API_KEY_ENV = 'DEEPSEEK_API_KEY'

/** A session's settled token-usage projection value, when one exists. */
type TokenUsageValue = TokenUsageProjection | undefined

/** One resolved balance response's account row, as DeepSeek's API reports it. */
export interface BalanceInfo {
  /** Account currency, for example `CNY`. */
  currency: string
  /** Whole account balance, as the API's decimal string. */
  total_balance: string
}

/** One session's cost split across the three billing buckets, in CNY. */
export interface SessionCostBuckets {
  /** Prompt-side cache-hit input. */
  cacheRead: number
  /** Prompt-side uncached input; cache writes bill at this same rate. */
  uncachedInput: number
  /** Completion output. */
  output: number
}

/** One model's share of a session's accumulated cost. */
export interface SessionModelCost {
  /** Provider model id. */
  model: string
  /** Billed amount in CNY for this model. */
  total: number
  /** Usage-carrying steps attributed to this model. */
  requests: number
}

/** One web API's billable call count and amount for a session. */
export interface SessionWebApiCost {
  /** Successful requests; a multi-query `web_search` counts one per query. */
  calls: number
  /** Billed amount in CNY (0 for requests inside the free period). */
  amount: number
}

/** Search and Fetch call costs folded from a session's tool log, in CNY. */
export interface SessionWebCost {
  /** Successful Search API requests, one per query that returned results. */
  search: SessionWebApiCost
  /** Successful Fetch API requests that returned page content. */
  fetch: SessionWebApiCost
}

/** What the session's descendant subagent sessions contributed to its cost. */
export interface SessionSubagentCost {
  /** Descendant subagent sessions folded into the totals. */
  sessions: number
  /** Token and web cost those sessions added, in CNY. */
  total: number
  /** Usage-carrying steps across those sessions. */
  requests: number
  /** Their Search and Fetch call share. */
  web: SessionWebCost
}

/** The wire value the client expects for this session's accumulated cost. */
export interface SessionCost {
  /** Total billed amount in CNY (yuan). */
  total: number
  /** Requests carrying usage that contributed to `total`. */
  requests: number
  /** The last model that reported usage, when any. */
  lastModel?: string
  /** `total` split by billing bucket. */
  buckets: SessionCostBuckets
  /** `total` split by model, most expensive first. */
  models: SessionModelCost[]
  /** `total`'s Search and Fetch call share, priced per successful request. */
  web: SessionWebCost
  /** Present when subagent descendants contributed: their share of `total`. */
  subagents?: SessionSubagentCost
}

/** Price facts plus the current billing period, sent to the stats strip. */
export interface BalancePrices {
  input: number
  cacheRead: number
  output: number
  /** `peak` during weekday peak windows, `off-peak` otherwise (weekends are always off-peak). */
  period: 'peak' | 'off-peak'
}

/**
 * The local calendar date key (`YYYY-MM-DD`) a moment falls on, matching the
 * statutory-holiday list's format.
 * @param now - the moment to key, in the server's local timezone.
 * @returns the date key.
 */
function localDateKey(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

/**
 * Whether a Beijing-local moment falls in an official peak window: weekdays
 * 09:00–12:00 and 14:00–18:00. Weekends and every statutory holiday are
 * off-peak for the whole day (official rule). The server's clock is assumed to
 * be Beijing time; the rule is defined in Beijing local time by the official
 * announcement.
 * @param now - the moment to classify, in the server's local timezone.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns true during a peak window.
 */
export function isPeakPeriod(now: Date, holidays: ReadonlySet<string> = DEFAULT_HOLIDAY_SET): boolean {
  const day = now.getDay()
  if (day === 0 || day === 6) return false
  if (holidays.has(localDateKey(now))) return false
  const minutes = now.getHours() * 60 + now.getMinutes()
  return (minutes >= 9 * 60 && minutes < 12 * 60)
    || (minutes >= 14 * 60 && minutes < 18 * 60)
}

/**
 * The billing prices for one period: peak figures when `isPeakPeriod`,
 * exactly half of them otherwise (official rule).
 * @param modelPrices - the model's peak rates.
 * @param period - the current billing period.
 * @returns the per-million-token prices to bill with.
 */
export function pricesFor(
  modelPrices: ModelPrices,
  period: 'peak' | 'off-peak',
): { input: number; cacheRead: number; output: number } {
  const factor = period === 'peak' ? 1 : 0.5
  return {
    input: modelPrices.input * factor,
    cacheRead: modelPrices.cacheRead * factor,
    output: modelPrices.output * factor,
  }
}

/**
 * Accumulated session cost in CNY, from the durable token-usage projection
 * (the same buckets the client's own estimator uses) at the given prices.
 * Cache writes bill at the uncached-input rate, matching the client reader.
 * @param usage - the session's token-usage projection, or undefined.
 * @param prices - the per-million-token rates in effect.
 * @returns the billed total in yuan, 0 when usage is absent.
 */
export function sessionCostYuan(usage: TokenUsageValue, prices: { input: number; cacheRead: number; output: number }): number {
  if (usage === undefined) return 0
  return (
    usage.uncachedInputTokens * prices.input
    + usage.cacheReadTokens * prices.cacheRead
    + usage.cacheWriteTokens * prices.input
    + usage.outputTokens * prices.output
  ) / 1_000_000
}

/**
 * The peak prices one model id billed at a given moment. The flash family —
 * the current `deepseek-flash`, its retired `deepseek-v4-flash` and
 * `deepseek-v4-flash-vision-exp` aliases, and every unknown id (the shipped
 * default model) — follows the 2026-09-10 price cut; `deepseek-v4-pro` keeps
 * its own rates only until it routes to V4.1 Flash.
 * @param model - the provider model id from an assistant message source.
 * @param timeMs - when the billed request happened (Unix milliseconds).
 * @returns the model's peak prices at that moment.
 */
export function peakPricesAt(model: string, timeMs: number): ModelPrices {
  const flash = timeMs < FLASH_CUT_MS ? FLASH_PRICES_BEFORE_CUT : FLASH_PRICES_AFTER_CUT
  if (model === 'deepseek-v4-pro') {
    return timeMs < PRO_ROUTED_TO_FLASH_MS ? PRO_PRICES : flash
  }
  return flash
}

/**
 * The prices one model id actually billed at a given moment, including that
 * moment's own peak/off-peak window: one session can span a price cut, a peak
 * window boundary, or both, and each request bills at its own rates.
 * @param model - the provider model id from an assistant message source.
 * @param timeMs - when the billed request happened (Unix milliseconds).
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the three bucket rates plus the period they belong to.
 */
export function pricesAt(
  model: string,
  timeMs: number,
  holidays: ReadonlySet<string> = DEFAULT_HOLIDAY_SET,
): { input: number; cacheRead: number; output: number; period: 'peak' | 'off-peak' } {
  const period: 'peak' | 'off-peak' = isPeakPeriod(new Date(timeMs), holidays) ? 'peak' : 'off-peak'
  return { ...pricesFor(peakPricesAt(model, timeMs), period), period }
}

/** The retired flash aliases the official API still accepts. */
const RETIRED_FLASH_ALIASES = new Set(['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp'])

/**
 * The name a model id is grouped and displayed under. The official API serves
 * the retired `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` aliases
 * from the same V4.1-Flash model at the same rates, so a session that spans the
 * rename reports one flash row instead of two identical-priced ones;
 * `deepseek-v4-pro` keeps its own name while it still bills separately.
 * @param model - the provider model id recorded on an assistant message.
 * @returns the canonical model name for grouping and display.
 */
export function canonicalModel(model: string): string {
  return RETIRED_FLASH_ALIASES.has(model) ? FLASH_MODEL : model
}

/**
 * The amount one successful Search or Fetch request billed when it ran: ¥0.005
 * from 2026-11-01 00:00 Beijing, and nothing before then — the official notice
 * leaves earlier Harness tool calls in a free period.
 * @param timeMs - when the request's result landed (Unix milliseconds).
 * @returns the request's price in CNY.
 */
export function webCallPriceYuan(timeMs: number): number {
  return timeMs >= WEB_CALL_BILLING_START_MS ? WEB_CALL_PRICE_YUAN : 0
}

/** One `web_search`/`web_fetch` call recorded in a session log. */
interface WebToolCall {
  /** Tool name: `web_search` or `web_fetch`. */
  name: string
  /** Distinct queries a `web_search` call issued; empty for `web_fetch`. */
  queries: string[]
}

/** The session-log event fields the web fold reads. */
interface WebLogEvent {
  type: string
  time: number
  data: unknown
}

/**
 * The distinct queries a `web_search` call issued, parsed from its JSON
 * arguments. The tool collapses exact duplicates before dispatching, so the
 * first-occurrence set here matches the number of Search API requests.
 * @param raw - the `tool/call` event's `arguments` string.
 * @returns the distinct queries; empty when the arguments are malformed.
 */
export function webSearchQueries(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw) as { queries?: unknown }
    if (!Array.isArray(parsed.queries)) return []
    return [...new Set(parsed.queries.filter((query): query is string => typeof query === 'string'))]
  } catch {
    return []
  }
}

/**
 * The joined text blocks of a tool result message. Only the empty-search marker
 * matters here; a result the log no longer carries any text for is treated as
 * a normal success (the request did return).
 * @param message - the `tool/result` event's message.
 * @returns the result text, empty when the message carries none.
 */
function toolResultText(message: { content?: unknown }): string {
  if (!Array.isArray(message.content)) return ''
  const parts: string[] = []
  for (const block of message.content) {
    if (typeof block !== 'object' || block === null) continue
    const { type, text } = block as { type?: unknown; text?: unknown }
    if (type === 'text' && typeof text === 'string') parts.push(text)
  }
  return parts.join('\n')
}

/**
 * Fold the successful Search and Fetch requests in one session log. One
 * `web_search` tool call issues one Search API request per distinct query; a
 * search that returned no results produced no billable request, and a failed
 * tool call bills nothing. One `web_fetch` call issues one Fetch API request
 * and bills when the page came back. Each request is priced at its own result
 * moment, so a session spanning the 2026-11-01 billing start bills only its
 * later calls.
 *
 * The log is append-only and may carry several results for one call when the
 * tool-result pruner replaces content later; the first result carries the
 * request's real outcome and moment, so every call is counted at most once and
 * a replacement never adds a fee.
 * @param events - the events to fold, already excluding any inherited prefix.
 * @returns billable call counts and amounts per API; both zero without web calls.
 */
function foldWebCostEvents(events: readonly WebLogEvent[]): SessionWebCost {
  const search: SessionWebApiCost = { calls: 0, amount: 0 }
  const fetch: SessionWebApiCost = { calls: 0, amount: 0 }
  const calls = new Map<string, WebToolCall>()
  const results = new Map<string, { message: { toolCallId: string; isError?: unknown; content?: unknown }; time: number }>()
  for (const event of events) {
    if (event.type === 'tool/call') {
      const data = event.data as { name?: unknown; callId?: unknown; arguments?: unknown }
      if (typeof data.name !== 'string' || typeof data.callId !== 'string') continue
      if (data.name !== WEB_SEARCH_TOOL && data.name !== WEB_FETCH_TOOL) continue
      calls.set(data.callId, {
        name: data.name,
        queries: data.name === WEB_SEARCH_TOOL ? webSearchQueries(data.arguments) : [],
      })
      continue
    }
    if (event.type !== 'tool/result') continue
    const message = (event.data as {
      message?: { toolCallId?: unknown; isError?: unknown; content?: unknown }
    }).message
    if (message === undefined || typeof message.toolCallId !== 'string') continue
    // A later replacement is content pruning, not a second request: keep the
    // first result's outcome and moment and ignore every replacement.
    if (results.has(message.toolCallId)) continue
    results.set(message.toolCallId, {
      message: message as { toolCallId: string; isError?: unknown; content?: unknown },
      time: event.time,
    })
  }
  for (const [callId, call] of calls) {
    const result = results.get(callId)
    if (result === undefined) continue
    // A failed tool call billed nothing: the provider dispatch failed, or the
    // call was cancelled before the request settled.
    if (result.message.isError === true) continue
    const price = webCallPriceYuan(result.time)
    if (call.name === WEB_FETCH_TOOL) {
      fetch.calls += 1
      fetch.amount += price
      continue
    }
    // The Search API bills only requests whose `results` array is non-empty;
    // the tool renders that case as the literal "No results found." marker.
    if (toolResultText(result.message).includes('No results found.')) continue
    const requests = call.queries.length
    if (requests === 0) continue
    search.calls += requests
    search.amount += requests * price
  }
  return { search, fetch }
}

/**
 * Fold a live session's own successful Search and Fetch requests, excluding any
 * fork-inherited prefix that its parent already paid for.
 * @param session - the live session whose log is folded.
 * @returns billable call counts and amounts per API; both zero without web calls.
 */
export function foldSessionWebCost(session: Session): SessionWebCost {
  return foldWebCostEvents(ownLogEvents(session))
}

/** Per-model accumulated usage and cost, keyed by model id. */
interface ModelAccumulator {
  uncachedInputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  outputTokens: number
  requests: number
  /** Billed amount in CNY, summed over each request's own rates. */
  total: number
  /** `total` split by bucket, summed over each request's own rates. */
  buckets: SessionCostBuckets
}

/**
 * Add one assistant message's usage report into a per-model accumulator at
 * the rates of the moment that request ran.
 * @param usage - the usage the adapter reported for that step.
 * @param acc - the model's accumulator.
 * @param prices - the rates in effect for that request.
 */
function accumulateUsage(
  usage: TokenUsage,
  acc: ModelAccumulator,
  prices: { input: number; cacheRead: number; output: number },
): void {
  const cacheRead = usage.cacheReadTokens ?? 0
  const cacheWrite = usage.cacheWriteTokens ?? 0
  acc.uncachedInputTokens += usage.inputTokens
  acc.cacheReadTokens += cacheRead
  acc.cacheWriteTokens += cacheWrite
  acc.outputTokens += usage.outputTokens
  acc.requests += 1
  acc.total += sessionCostYuan({
    uncachedInputTokens: usage.inputTokens,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: usage.outputTokens,
  }, prices)
  // Cache writes bill at the uncached-input rate, matching sessionCostYuan.
  acc.buckets.cacheRead += cacheRead * prices.cacheRead / 1_000_000
  acc.buckets.uncachedInput += (usage.inputTokens + cacheWrite) * prices.input / 1_000_000
  acc.buckets.output += usage.outputTokens * prices.output / 1_000_000
}

/**
 * Fold one session's own log events into per-model accumulated cost. Each
 * `assistant/message` event pairs its model id (from the message source) with
 * the usage the adapter reported on that step, and bills it at the rates of
 * that event's own moment — a session spanning the 2026-09-10 price cut, a
 * peak-window boundary, or the pro-to-flash routing never mixes rate tables.
 * Events without usage, and messages without a model source, are skipped. The
 * session's successful Search and Fetch requests are folded in as well, priced
 * per request at their own result moment.
 * @param events - the events to fold, already excluding any inherited prefix.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the summed cost with its bucket, per-model and web-call splits, the
 *   number of usage-carrying steps, and the last model seen — or undefined when
 *   the log has neither token usage nor web calls.
 */
function foldEventsCost(events: readonly WebLogEvent[], holidays: ReadonlySet<string>): SessionCost | undefined {
  const byModel = new Map<string, ModelAccumulator>()
  let lastModel: string | undefined
  for (const event of events) {
    if (event.type !== 'assistant/message') continue
    const data = event.data as {
      message?: { source?: { kind?: unknown; model?: unknown } }
      usage?: TokenUsage
    }
    const source = data.message?.source
    if (source === undefined || source.kind !== 'model' || typeof source.model !== 'string') continue
    if (data.usage === undefined) continue
    // Group by canonical name: the flash aliases bill identically and must not
    // split one model into two rows when a session spans the rename.
    const model = canonicalModel(source.model)
    let acc = byModel.get(model)
    if (acc === undefined) {
      acc = {
        uncachedInputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        requests: 0,
        total: 0,
        buckets: { cacheRead: 0, uncachedInput: 0, output: 0 },
      }
      byModel.set(model, acc)
    }
    accumulateUsage(data.usage, acc, pricesAt(model, event.time, holidays))
    lastModel = model
  }
  const web = foldWebCostEvents(events)
  if (byModel.size === 0 && web.search.calls === 0 && web.fetch.calls === 0) return undefined
  let total = web.search.amount + web.fetch.amount
  let requests = 0
  const buckets: SessionCostBuckets = { cacheRead: 0, uncachedInput: 0, output: 0 }
  const models: SessionModelCost[] = []
  for (const [model, acc] of byModel) {
    total += acc.total
    requests += acc.requests
    buckets.cacheRead += acc.buckets.cacheRead
    buckets.uncachedInput += acc.buckets.uncachedInput
    buckets.output += acc.buckets.output
    models.push({ model, total: acc.total, requests: acc.requests })
  }
  // Expensive model first: the popover lists the session's cost drivers up top.
  models.sort((a, b) => b.total - a.total)
  const cost: SessionCost = { total, requests, buckets, models, web }
  if (lastModel !== undefined) cost.lastModel = lastModel
  return cost
}

/**
 * The events a live session owns: its own work after any fork-inherited
 * prefix. The prefix was billed to the parent, so folding it again would bill
 * it twice.
 * @param session - the live session.
 * @returns its own events, in log order.
 */
function ownLogEvents(session: Session): readonly WebLogEvent[] {
  return session.ownEvents() as unknown as readonly WebLogEvent[]
}

/**
 * Fold a live session's own log into per-model accumulated cost. A session
 * forked from another one inherits that parent's prefix and is charged only for
 * its own later events.
 * @param session - the live session whose log is folded.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the summed cost, or undefined when the session has no own usage and
 *   no own web calls.
 */
export function foldSessionCost(session: Session, holidays: ReadonlySet<string> = DEFAULT_HOLIDAY_SET): SessionCost | undefined {
  return foldEventsCost(ownLogEvents(session), holidays)
}

/** One persisted session's raw log slice, as `sessionQuery.readSession` returns it. */
export interface SessionLogSlice {
  /** Complete raw event log, including any fork-inherited prefix. */
  events: readonly unknown[]
  /** Number of leading events inherited from the fork parent; excluded from cost. */
  inheritedEventCount: number
}

/**
 * Fold a persisted session's log (a closed subagent, for example) without
 * making it live. The fork-inherited prefix is excluded for the same reason a
 * live fork excludes it: that usage was already billed elsewhere.
 * @param log - the persisted log slice.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the summed cost, or undefined when the log has no own usage and no
 *   own web calls.
 */
export function foldSessionLogCost(log: SessionLogSlice, holidays: ReadonlySet<string> = DEFAULT_HOLIDAY_SET): SessionCost | undefined {
  const inherited = Math.max(0, Math.trunc(log.inheritedEventCount))
  return foldEventsCost(log.events.slice(inherited) as readonly WebLogEvent[], holidays)
}

/**
 * Merge one session's own cost with the costs of the subagent sessions it
 * spawned, at any depth. The merged cost keeps the per-model and per-bucket
 * splits additive and records what the subagents contributed.
 * @param own - the root session's own cost, or undefined when it has none.
 * @param subagents - each descendant subagent session's own cost.
 * @param subagentSessions - how many descendant sessions were found; defaults
 *   to the number of priced costs and may be larger when a log was unreadable.
 * @returns the combined cost, or undefined when nothing contributed.
 */
export function combineSessionCosts(
  own: SessionCost | undefined,
  subagents: readonly SessionCost[],
  subagentSessions: number = subagents.length,
): SessionCost | undefined {
  if (own === undefined && subagents.length === 0) return undefined
  const base: SessionCost = own === undefined
    ? {
        total: 0,
        requests: 0,
        buckets: { cacheRead: 0, uncachedInput: 0, output: 0 },
        models: [],
        web: { search: { calls: 0, amount: 0 }, fetch: { calls: 0, amount: 0 } },
      }
    : {
        ...own,
        buckets: { ...own.buckets },
        models: own.models.map(row => ({ ...row })),
        web: {
          search: { ...own.web.search },
          fetch: { ...own.web.fetch },
        },
      }
  const models = new Map<string, SessionModelCost>()
  for (const row of base.models) models.set(row.model, row)
  const childWeb: SessionWebCost = { search: { calls: 0, amount: 0 }, fetch: { calls: 0, amount: 0 } }
  let childTotal = 0
  let childRequests = 0
  for (const child of subagents) {
    childTotal += child.total
    childRequests += child.requests
    base.total += child.total
    base.requests += child.requests
    base.buckets.cacheRead += child.buckets.cacheRead
    base.buckets.uncachedInput += child.buckets.uncachedInput
    base.buckets.output += child.buckets.output
    base.web.search.calls += child.web.search.calls
    base.web.search.amount += child.web.search.amount
    base.web.fetch.calls += child.web.fetch.calls
    base.web.fetch.amount += child.web.fetch.amount
    childWeb.search.calls += child.web.search.calls
    childWeb.search.amount += child.web.search.amount
    childWeb.fetch.calls += child.web.fetch.calls
    childWeb.fetch.amount += child.web.fetch.amount
    for (const row of child.models) {
      const existing = models.get(row.model)
      if (existing === undefined) {
        models.set(row.model, { ...row })
      } else {
        existing.total += row.total
        existing.requests += row.requests
      }
    }
    if (base.lastModel === undefined && child.lastModel !== undefined) base.lastModel = child.lastModel
  }
  // Expensive model first, matching the single-session fold.
  base.models = [...models.values()].sort((a, b) => b.total - a.total)
  if (subagents.length > 0 || subagentSessions > 0) {
    base.subagents = {
      sessions: Math.max(subagentSessions, subagents.length),
      total: childTotal,
      requests: childRequests,
      web: childWeb,
    }
  }
  return base
}

/** Parse a DeepSeek balance response into the client's account row. */
export function parseBalanceInfo(raw: unknown): BalanceInfo | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const infos = (raw as { balance_infos?: unknown }).balance_infos
  if (!Array.isArray(infos) || infos.length === 0) return undefined
  const first = infos[0]
  if (typeof first !== 'object' || first === null) return undefined
  const { currency, total_balance } = first as { currency?: unknown; total_balance?: unknown }
  if (typeof currency !== 'string' || typeof total_balance !== 'string') return undefined
  return { currency, total_balance }
}

/**
 * Fetch the official account balance with the given key.
 * @param apiKey - the resolved DeepSeek API key.
 * @returns the parsed balance row, or undefined when the API denied or answered unexpectedly.
 */
export function fetchBalance(apiKey: string): Promise<BalanceInfo | undefined> {
  return new Promise((resolve) => {
    const req = httpsRequest(BALANCE_URL, {
      method: 'GET',
      headers: {
        authorization: 'Bearer ' + apiKey,
        accept: 'application/json',
      },
      timeout: 15_000,
    }, (res: IncomingMessage) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => { body += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(undefined)
          return
        }
        try {
          resolve(parseBalanceInfo(JSON.parse(body)))
        } catch {
          resolve(undefined)
        }
      })
    })
    req.on('timeout', () => { req.destroy() })
    req.on('error', () => { resolve(undefined) })
    req.end()
  })
}

/** The complete JSON body served by `/api/dsh-balance`. */
export interface BalanceResponse {
  /** Non-empty on any failure; the client then hides the balance/cost segment whole. */
  error?: string
  /** Official account rows; absent when no key is configured, so the client shows prices without balance. */
  balance_infos?: BalanceInfo[]
  /** The billing prices in effect right now. */
  prices: BalancePrices
  /** Accumulated session cost; absent when the session and its subagents have neither token usage nor web calls. */
  sessionCost?: SessionCost
}

/**
 * Resolve a session's live object by id through the store, returning
 * undefined when the session is not attached (cold sessions are priced by the
 * client from its own projection read — the route serves prices either way).
 * @param ctx - context carrying the optional sessions service.
 * @param sessionId - the query's session id, when given.
 * @returns the live session, or undefined.
 */
function liveSession(ctx: Context, sessionId: string | undefined): Session | undefined {
  if (sessionId === undefined) return undefined
  const sessions = ctx.get('sessions')
  if (sessions === undefined) return undefined
  return sessions.get(sessionId as never)
}

/**
 * A session's settled token usage from the projection registry; undefined
 * when the registry is absent or the session has no usage yet. Reads the live
 * watermark snapshot only — never a log load.
 * @param ctx - context carrying the optional projection registry.
 * @param session - the live session being priced.
 * @returns the token-usage projection value, or undefined.
 */
function tokenUsageOf(ctx: Context, session: Session | undefined): TokenUsageValue {
  if (session === undefined) return undefined
  const registry = ctx.get('sessionProjections')
  if (registry === undefined) return undefined
  try {
    const values = registry.snapshot(session).values
    return (values as { tokenUsage?: TokenUsageValue }).tokenUsage
  } catch {
    // A projection fold failing for one session must not take the whole
    // balance/cost segment down with it; the client prices from its own read.
    return undefined
  }
}

/**
 * 余额查询的缓存窗口(毫秒)。会话每推进一步都会问一次费用:费用在 host 侧按事件
 * 折叠(毫秒级),但余额要去 DeepSeek API 取 —— 余额不需要那么实时,按这个窗口
 * 复用最近一次结果,把"每步一次外网请求"降为"每窗口一次"。
 */
const BALANCE_CACHE_MS = 30_000

/** 最近一次余额查询的结果、键与时间。 */
let balanceCache: { at: number; key: string; value: BalanceInfo | undefined } | undefined

/**
 * Balance with the cache window above applied. The cache is keyed by the resolved
 * API key, so switching credentials never reuses another account's balance.
 * @param apiKey - the resolved DeepSeek API key.
 * @returns the parsed balance row, or undefined when the API denied.
 */
async function cachedBalance(apiKey: string): Promise<BalanceInfo | undefined> {
  const now = Date.now()
  if (balanceCache !== undefined && balanceCache.key === apiKey && now - balanceCache.at < BALANCE_CACHE_MS) {
    return balanceCache.value
  }
  const value = await fetchBalance(apiKey)
  balanceCache = { at: now, key: apiKey, value }
  return value
}

/** Resolve the DeepSeek API key through the credentials seam, or the environment. */
async function resolveApiKey(ctx: Context): Promise<string | undefined> {
  const ref = credentialRef(API_KEY_ENV)
  const credentials = ctx.get('credentials')
  if (credentials !== undefined) {
    const hit = await credentials.resolve(ref)
    if (hit !== undefined) return hit.value
    return undefined
  }
  return process.env[API_KEY_ENV]?.trim() || undefined
}

/** Structural view of the live SessionStore subset the pill reads. */
interface SessionStoreFace {
  get(id: unknown): Session | undefined
  list(): Session[]
}

/** Structural view of the session-query service subset the pill reads. */
interface SessionQueryFace {
  traceSession(id: unknown): Promise<{ descendants?: readonly SessionLineageNodeFace[] }>
  readSession(id: unknown): Promise<{ events: readonly unknown[]; inheritedEventCount: number }>
}

/** One node of the session-query lineage tree. */
interface SessionLineageNodeFace {
  session: { header: { id: unknown; origin?: unknown }; live?: unknown }
  descendants?: readonly SessionLineageNodeFace[]
}

/**
 * The live session store, when the store service is available.
 * @param ctx - host context.
 * @returns the store face, or undefined.
 */
function sessionStore(ctx: Context): SessionStoreFace | undefined {
  return ctx.get('sessions') as unknown as SessionStoreFace | undefined
}

/**
 * The unified session-query service, when it is installed. It can trace
 * lineage and read a persisted log, which is how closed subagent sessions keep
 * counting after they stop being live.
 * @param ctx - host context.
 * @returns the query face, or undefined.
 */
function sessionQuery(ctx: Context): SessionQueryFace | undefined {
  return ctx.get('sessionQuery') as unknown as SessionQueryFace | undefined
}

/** One descendant subagent session found for a root session. */
interface SubagentRecord {
  id: string
  /** Whether the session is still live (its log can be read from memory). */
  live: boolean
}

/**
 * Find every descendant subagent session of a root session, at any depth.
 * `sessionQuery` traces durable lineage, so closed subagents still count;
 * without it only live sessions are discoverable. A user fork shares the
 * lineage field without the `subagent` origin and is an independent
 * conversation, so it is never counted.
 * @param ctx - host context.
 * @param root - the session whose pill is being priced.
 * @returns descendant records in lineage order, possibly empty.
 */
async function subagentRecords(ctx: Context, root: Session): Promise<SubagentRecord[]> {
  const query = sessionQuery(ctx)
  if (query !== undefined) {
    try {
      const trace = await query.traceSession(root.id as never)
      const records: SubagentRecord[] = []
      const visit = (nodes: readonly SessionLineageNodeFace[] | undefined): void => {
        if (nodes === undefined) return
        for (const node of nodes) {
          const { id, origin } = node.session.header
          // A user fork shares the lineage without the subagent origin; it is a
          // separate conversation, so neither it nor its own children count.
          if (origin !== 'subagent') continue
          records.push({ id: String(id), live: node.session.live === true })
          visit(node.descendants)
        }
      }
      visit(trace.descendants)
      return records
    } catch {
      // An unavailable or incomplete query backend falls back to the live
      // store: currently resident children are still counted.
    }
  }
  return liveSubagentRecords(ctx, root)
}

/**
 * Live-store fallback: walk header lineage for resident subagent children.
 * @param ctx - host context.
 * @param root - the root session.
 * @returns resident descendant records.
 */
function liveSubagentRecords(ctx: Context, root: Session): SubagentRecord[] {
  const store = sessionStore(ctx)
  if (store === undefined) return []
  const childrenOf = new Map<string, Session[]>()
  for (const session of store.list()) {
    const header = session.header as { parentSession?: unknown; origin?: unknown }
    if (typeof header.parentSession !== 'string' || header.origin !== 'subagent') continue
    const siblings = childrenOf.get(header.parentSession) ?? []
    siblings.push(session)
    childrenOf.set(header.parentSession, siblings)
  }
  const records: SubagentRecord[] = []
  const pending = [String(root.id)]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const parentId = pending.shift() as string
    if (visited.has(parentId)) continue
    visited.add(parentId)
    for (const child of childrenOf.get(parentId) ?? []) {
      records.push({ id: String(child.id), live: true })
      pending.push(String(child.id))
    }
  }
  return records
}

/** Persisted subagent costs; a closed log no longer changes. */
const subagentCostCache = new Map<string, SessionCost>()

/** Upper bound on cached closed-subagent costs. */
const SUBAGENT_COST_CACHE_LIMIT = 256

/**
 * Remember one subagent session's cost, evicting the oldest entry at the cap.
 * @param id - the child session id.
 * @param cost - its folded cost.
 */
function rememberSubagentCost(id: string, cost: SessionCost): void {
  if (subagentCostCache.size >= SUBAGENT_COST_CACHE_LIMIT) {
    const oldest = subagentCostCache.keys().next().value
    if (oldest !== undefined) subagentCostCache.delete(oldest)
  }
  subagentCostCache.set(id, cost)
}

/**
 * Fold the cost of every descendant subagent session. Live sessions are read
 * from the store; closed ones through the session-query service, with a small
 * cache because a closed log never changes. One unreadable child log is
 * skipped rather than failing the whole pill.
 * @param ctx - host context.
 * @param root - the session whose pill is being priced.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the priced children and how many descendant sessions were found.
 */
async function subagentCosts(
  ctx: Context,
  root: Session,
  holidays: ReadonlySet<string>,
): Promise<{ costs: SessionCost[]; sessions: number }> {
  const records = await subagentRecords(ctx, root)
  const store = sessionStore(ctx)
  const query = sessionQuery(ctx)
  const costs: SessionCost[] = []
  for (const record of records) {
    if (record.live && store !== undefined) {
      const live = store.get(record.id as never)
      if (live !== undefined) {
        const cost = foldSessionCost(live, holidays)
        if (cost !== undefined) {
          rememberSubagentCost(record.id, cost)
          costs.push(cost)
        }
        continue
      }
    }
    const cached = subagentCostCache.get(record.id)
    if (cached !== undefined) {
      costs.push(cached)
      continue
    }
    if (query === undefined) continue
    try {
      const log = await query.readSession(record.id as never)
      const cost = foldSessionLogCost({ events: log.events, inheritedEventCount: log.inheritedEventCount }, holidays)
      if (cost !== undefined) {
        rememberSubagentCost(record.id, cost)
        costs.push(cost)
      }
    } catch {
      // A child log that cannot be read must not take the pill down.
    }
  }
  return { costs, sessions: records.length }
}

/**
 * Mount the `/api/dsh-balance` exact route. Registered as an effect so the
 * route lives and dies with this plugin's fiber.
 * @param ctx - context carrying the webServer service (declared inject).
 * @param config - plugin config; omitted only by tests that mount `{ apply }`.
 */
export function apply(ctx: Context, config: Config = { holidays: DEFAULT_HOLIDAYS }): void {
  const holidays: ReadonlySet<string> = new Set(config.holidays)
  ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register({
    kind: 'exact',
    path: '/api/dsh-balance',
    handler: async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
      const respond = (body: BalanceResponse, status = 200): void => {
        const payload = JSON.stringify(body)
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'cache-control': 'no-store',
        })
        res.end(payload)
      }
      let sessionId: string | undefined
      try {
        sessionId = new URL(req.url ?? '/', 'http://localhost').searchParams.get('sessionId') ?? undefined
      } catch {
        sessionId = undefined
      }

      const apiKey = await resolveApiKey(webCtx)
      const balance = apiKey === undefined ? undefined : await cachedBalance(apiKey)

      const session = liveSession(webCtx, sessionId)
      // The client's own estimator reads these: the rates in effect right now
      // for the model the deployment ships.
      const prices = pricesAt(FALLBACK_MODEL, Date.now(), holidays)
      const response: BalanceResponse = {
        prices,
        ...(balance !== undefined ? { balance_infos: [balance] } : {}),
      }
      // Exact per-request fold over the live log first; fall back to the
      // durable projection at today's rates when the session is not attached
      // (a cold session is priced by the client from its own read anyway).
      if (session !== undefined) {
        const own = foldSessionCost(session, holidays)
        // A delegated subagent spends the same account's tokens and web calls,
        // so the session's reading includes every descendant it spawned.
        const children = await subagentCosts(webCtx, session, holidays)
        const folded = combineSessionCosts(own, children.costs, children.sessions)
        if (folded !== undefined) {
          response.sessionCost = folded
        }
      } else {
        const usage = tokenUsageOf(webCtx, session)
        const cost = sessionCostYuan(usage, prices)
        if (cost > 0 && usage !== undefined) {
          // A cold session carries no per-model report, so the bucket split is
          // priced at today's flash rates and the model list stays empty (the
          // client renders the model section only when the host names one).
          // Its log is not loaded either, so its web calls stay uncounted.
          response.sessionCost = {
            total: cost,
            requests: 1,
            buckets: {
              cacheRead: usage.cacheReadTokens * prices.cacheRead / 1_000_000,
              uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1_000_000,
              output: usage.outputTokens * prices.output / 1_000_000,
            },
            models: [],
            web: {
              search: { calls: 0, amount: 0 },
              fetch: { calls: 0, amount: 0 },
            },
          }
        }
      }

      respond(response)
    },
  }), 'web-balance: /api/dsh-balance route'))
}
