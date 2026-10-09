/**
 * Account balance and per-session cost: the `/api/dsh-balance` host route the
 * composer-dock pill polls. The route resolves the DeepSeek API key through the
 * credentials seam, reads the official account balance from the DeepSeek API,
 * prices the current session's token usage at the official peak/off-peak rates,
 * and folds the live log per request so a session spanning the 2026-09-10 price
 * cut, the pro-to-flash routing, or a peak boundary never mixes rate tables.
 *
 * Price, period, and statutory-holiday facts live here, in the owning package:
 * an official change is one edit plus its tests.
 * @module dsh-cost
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
 * Fold a live session's log into per-model accumulated cost. Each
 * `assistant/message` event pairs its model id (from the message source) with
 * the usage the adapter reported on that step, and bills it at the rates of
 * that event's own moment — a session spanning the 2026-09-10 price cut, a
 * peak-window boundary, or the pro-to-flash routing never mixes rate tables.
 * Events without usage, and messages without a model source, are skipped.
 * @param session - the live session whose log is folded.
 * @param holidays - statutory-holiday date keys billed off-peak all day.
 * @returns the summed cost with its bucket and per-model splits, the number of
 *   usage-carrying steps, and the last model seen — or undefined when no step
 *   reported usage.
 */
export declare function foldSessionCost(session: Session, holidays?: ReadonlySet<string>): SessionCost | undefined;
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
    /** Accumulated session cost; absent when the session has no token usage. */
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