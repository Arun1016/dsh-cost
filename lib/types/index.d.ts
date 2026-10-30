/**
 * Account balance and per-session cost: the `/api/dsh-balance` host route the
 * composer-dock pill polls. The route resolves the DeepSeek API key through the
 * credentials seam, reads the official account balance from the DeepSeek API,
 * prices the current session's token usage at the official peak/off-peak rates,
 * and folds the live log per request so a session spanning the 2026-09-10 price
 * cut, the pro-to-flash routing, or a peak boundary never mixes rate tables,
 * and counts the session's successful web search / web fetch requests, which
 * the official price table bills per request from 2026-11-01 00:00 Beijing.
 *
 * Price, period, and statutory-holiday facts live here, in the owning package:
 * an official change is one edit plus its tests.
 * @module dsh-cost-pill
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { Session } from '@deepseek-ai/dsh-session';
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter';
/** Stable Cordis plugin name. */
export declare const name = "cost-stats";
/** Services required before the balance route can register. */
export declare const inject: string[];
/** Plugin config: the statutory-holiday calendar that classifies billing periods. */
export interface Config {
    /** Beijing-local `YYYY-MM-DD` dates billed off-peak for the whole day. */
    holidays: string[];
}
/** Config schema; the shipped default is the current statutory-holiday notice. */
export declare const Config: z<Config>;
/**
 * One model's per-million-token prices in CNY, keyed by billing bucket.
 * Every stored figure is a peak rate: off-peak is always exactly half the
 * peak (official rule), so the tables carry peak only and `pricesFor` halves.
 */
export interface ModelPrices {
    /** Uncached input, CNY per million tokens at peak. */
    input: number;
    /** Cache-hit input, CNY per million tokens at peak. */
    cacheRead: number;
    /** Output, CNY per million tokens at peak. */
    output: number;
}
/** A session's settled token-usage projection value, when one exists. */
type TokenUsageValue = TokenUsageProjection | undefined;
/** One resolved balance response's account row, as DeepSeek's API reports it. */
export interface BalanceInfo {
    /** Account currency, for example `CNY`. */
    currency: string;
    /** Whole account balance, as the API's decimal string. */
    total_balance: string;
}
/** One session's cost split across the three billing buckets, in CNY. */
export interface SessionCostBuckets {
    /** Prompt-side cache-hit input. */
    cacheRead: number;
    /** Prompt-side uncached input; cache writes bill at this same rate. */
    uncachedInput: number;
    /** Completion output. */
    output: number;
}
/** One model's share of a session's accumulated cost. */
export interface SessionModelCost {
    /** Provider model id. */
    model: string;
    /** Billed amount in CNY for this model. */
    total: number;
    /** Usage-carrying steps attributed to this model. */
    requests: number;
}
/** One web API's billable call count and amount for a session. */
export interface SessionWebApiCost {
    /** Successful requests; a multi-query `web_search` counts one per query. */
    calls: number;
    /** Billed amount in CNY (0 for requests inside the free period). */
    amount: number;
}
/** Search and Fetch call costs folded from a session's tool log, in CNY. */
export interface SessionWebCost {
    /** Successful Search API requests, one per query that returned results. */
    search: SessionWebApiCost;
    /** Successful Fetch API requests that returned page content. */
    fetch: SessionWebApiCost;
}
/** How many descendant subagent sessions contributed to the totals. */
export interface SessionSubagentCost {
    /** Descendant subagent sessions whose own cost is folded into `total`. */
    sessions: number;
}
/** The wire value the client expects for this session's accumulated cost. */
export interface SessionCost {
    /** Total billed amount in CNY (yuan). */
    total: number;
    /** Requests carrying usage that contributed to `total`. */
    requests: number;
    /** The last model that reported usage, when any. */
    lastModel?: string;
    /** `total` split by billing bucket. */
    buckets: SessionCostBuckets;
    /** `total` split by model, most expensive first. */
    models: SessionModelCost[];
    /** `total`'s Search and Fetch call share, priced per successful request. */
    web: SessionWebCost;
    /** Present when subagent descendants contributed: their share of `total`. */
    subagents?: SessionSubagentCost;
}
/** Price facts plus the current billing period, sent to the stats strip. */
export interface BalancePrices {
    input: number;
    cacheRead: number;
    output: number;
    /** `peak` during weekday peak windows, `off-peak` otherwise (weekends are always off-peak). */
    period: 'peak' | 'off-peak';
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
export declare function isPeakPeriod(now: Date, holidays?: ReadonlySet<string>): boolean;
/**
 * The billing prices for one period: peak figures when `isPeakPeriod`,
 * exactly half of them otherwise (official rule).
 * @param modelPrices - the model's peak rates.
 * @param period - the current billing period.
 * @returns the per-million-token prices to bill with.
 */
export declare function pricesFor(modelPrices: ModelPrices, period: 'peak' | 'off-peak'): {
    input: number;
    cacheRead: number;
    output: number;
};
/**
 * Accumulated session cost in CNY, from the durable token-usage projection
 * (the same buckets the client's own estimator uses) at the given prices.
 * Cache writes bill at the uncached-input rate, matching the client reader.
 * @param usage - the session's token-usage projection, or undefined.
 * @param prices - the per-million-token rates in effect.
 * @returns the billed total in yuan, 0 when usage is absent.
 */
export declare function sessionCostYuan(usage: TokenUsageValue, prices: {
    input: number;
    cacheRead: number;
    output: number;
}): number;
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
export declare function peakPricesAt(model: string, timeMs: number): ModelPrices;
/**
 * The prices one model id actually billed at a given moment, including that
 * moment's own peak/off-peak window: one session can span a price cut, a peak
 * window boundary, or both, and each request bills at its own rates.
 * @param model - the provider model id from an assistant message source.
 * @param timeMs - when the billed request happened (Unix milliseconds).
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the three bucket rates plus the period they belong to.
 */
export declare function pricesAt(model: string, timeMs: number, holidays?: ReadonlySet<string>): {
    input: number;
    cacheRead: number;
    output: number;
    period: 'peak' | 'off-peak';
};
/**
 * The name a model id is grouped and displayed under. The official API serves
 * the retired `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` aliases
 * from the same V4.1-Flash model at the same rates, so a session that spans the
 * rename reports one flash row instead of two identical-priced ones;
 * `deepseek-v4-pro` keeps its own name while it still bills separately.
 * @param model - the provider model id recorded on an assistant message.
 * @returns the canonical model name for grouping and display.
 */
export declare function canonicalModel(model: string): string;
/**
 * The amount one successful Search or Fetch request billed when it ran: ¥0.005
 * from 2026-11-01 00:00 Beijing, and nothing before then — the official notice
 * leaves earlier Harness tool calls in a free period.
 * @param timeMs - when the request's result landed (Unix milliseconds).
 * @returns the request's price in CNY.
 */
export declare function webCallPriceYuan(timeMs: number): number;
/**
 * The distinct queries a `web_search` call issued, parsed from its JSON
 * arguments. The tool collapses exact duplicates before dispatching, so the
 * first-occurrence set here matches the number of Search API requests.
 * @param raw - the `tool/call` event's `arguments` string.
 * @returns the distinct queries; empty when the arguments are malformed.
 */
export declare function webSearchQueries(raw: unknown): string[];
/**
 * Fold a live session's own successful Search and Fetch requests, excluding any
 * fork-inherited prefix that its parent already paid for.
 * @param session - the live session whose log is folded.
 * @returns billable call counts and amounts per API; both zero without web calls.
 */
export declare function foldSessionWebCost(session: Session): SessionWebCost;
/**
 * Fold a live session's own log into per-model accumulated cost. A session
 * forked from another one inherits that parent's prefix and is charged only for
 * its own later events.
 * @param session - the live session whose log is folded.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the summed cost, or undefined when the session has no own usage and
 *   no own web calls.
 */
export declare function foldSessionCost(session: Session, holidays?: ReadonlySet<string>): SessionCost | undefined;
/** One persisted session's raw log slice, as `sessionQuery.readSession` returns it. */
export interface SessionLogSlice {
    /** Complete raw event log, including any fork-inherited prefix. */
    events: readonly unknown[];
    /** Number of leading events inherited from the fork parent; excluded from cost. */
    inheritedEventCount: number;
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
export declare function foldSessionLogCost(log: SessionLogSlice, holidays?: ReadonlySet<string>): SessionCost | undefined;
/**
 * Merge one session's own cost with the costs of the subagent sessions it
 * spawned, at any depth. Subagent spend is folded into the existing total,
 * bucket, web and model fields so the dialog stays one reading; only the
 * descendant count is kept so the client can annotate the totals.
 * @param own - the root session's own cost, or undefined when it has none.
 * @param subagents - each descendant subagent session's own cost.
 * @param subagentSessions - how many descendant sessions were found; defaults
 *   to the number of priced children and may be larger when a log was unreadable.
 * @returns the combined cost, or undefined when nothing contributed.
 */
export declare function combineSessionCosts(own: SessionCost | undefined, subagents: readonly SessionCost[], subagentSessions?: number): SessionCost | undefined;
/** Parse a DeepSeek balance response into the client's account row. */
export declare function parseBalanceInfo(raw: unknown): BalanceInfo | undefined;
/**
 * Fetch the official account balance with the given key.
 * @param apiKey - the resolved DeepSeek API key.
 * @returns the parsed balance row, or undefined when the API denied or answered unexpectedly.
 */
export declare function fetchBalance(apiKey: string): Promise<BalanceInfo | undefined>;
/** The complete JSON body served by `/api/dsh-balance`. */
export interface BalanceResponse {
    /** Non-empty on any failure; the client then hides the balance/cost segment whole. */
    error?: string;
    /** Official account rows; absent when no key is configured, so the client shows prices without balance. */
    balance_infos?: BalanceInfo[];
    /** The billing prices in effect right now. */
    prices: BalancePrices;
    /** Accumulated session cost; absent when the session and its subagents have neither token usage nor web calls. */
    sessionCost?: SessionCost;
}
/**
 * Mount the `/api/dsh-balance` exact route. Registered as an effect so the
 * route lives and dies with this plugin's fiber.
 * @param ctx - context carrying the webServer service (declared inject).
 * @param config - plugin config; omitted only by tests that mount `{ apply }`.
 */
export declare function apply(ctx: Context, config?: Config): void;
export {};
//# sourceMappingURL=index.d.ts.map