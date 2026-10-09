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
import { request as httpsRequest } from 'node:https';
import z from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
/** Stable Cordis plugin name. */
export const name = 'cost-stats';
/** Services required before the balance route can register. */
export const inject = ['webServer'];
/**
 * Statutory-holiday dates (Beijing local calendar, `YYYY-MM-DD`) that bill at
 * off-peak rates for the whole day. The official rule makes every statutory
 * holiday and every weekend off-peak regardless of the clock, including a
 * weekend that holiday adjustment turns into a workday. Dates come from the
 * State Council's annual notice; a deployment overrides them through Config
 * when the next year is published.
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
];
/** The shipped calendar as a lookup set, and the default for every classifier. */
const DEFAULT_HOLIDAY_SET = new Set(DEFAULT_HOLIDAYS);
/** Config schema; the shipped default is the current statutory-holiday notice. */
export const Config = z.object({
    holidays: z.array(String).default(DEFAULT_HOLIDAYS),
});
/** Flash peak rates before the 2026-09-10 (Beijing) price cut. */
const FLASH_PRICES_BEFORE_CUT = { input: 3.0, cacheRead: 0.1, output: 9.0 };
/** Flash peak rates from the 2026-09-10 (Beijing) price cut on. */
const FLASH_PRICES_AFTER_CUT = { input: 2.0, cacheRead: 0.04, output: 8.0 };
/** `deepseek-v4-pro` peak rates, valid while that model still serves itself. */
const PRO_PRICES = { input: 9.0, cacheRead: 0.3, output: 27.0 };
/**
 * When the official flash price cut took effect: 2026-09-10 12:00 Beijing.
 * Requests before it bill at `FLASH_PRICES_BEFORE_CUT` and requests after it
 * at `FLASH_PRICES_AFTER_CUT`, so one session can legitimately span both.
 */
const FLASH_CUT_MS = Date.parse('2026-09-10T12:00:00+08:00');
/**
 * When `deepseek-v4-pro` requests started routing to V4.1 Flash and billing at
 * the flash rates: 2026-09-14 12:00 Beijing, per the official announcement.
 */
const PRO_ROUTED_TO_FLASH_MS = Date.parse('2026-09-14T12:00:00+08:00');
/** The model id the official docs now use for the whole flash family. */
const FLASH_MODEL = 'deepseek-flash';
/** The model id whose rates price a session that reports no usable model. */
const FALLBACK_MODEL = FLASH_MODEL;
/** Official DeepSeek account-balance endpoint. */
const BALANCE_URL = 'https://api.deepseek.com/user/balance';
/** Credential reference for the DeepSeek API key, matching llm-deepseek's default. */
const API_KEY_ENV = 'DEEPSEEK_API_KEY';
/**
 * The local calendar date key (`YYYY-MM-DD`) a moment falls on, matching the
 * statutory-holiday list's format.
 * @param now - the moment to key, in the server's local timezone.
 * @returns the date key.
 */
function localDateKey(now) {
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
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
export function isPeakPeriod(now, holidays = DEFAULT_HOLIDAY_SET) {
    const day = now.getDay();
    if (day === 0 || day === 6)
        return false;
    if (holidays.has(localDateKey(now)))
        return false;
    const minutes = now.getHours() * 60 + now.getMinutes();
    return (minutes >= 9 * 60 && minutes < 12 * 60)
        || (minutes >= 14 * 60 && minutes < 18 * 60);
}
/**
 * The billing prices for one period: peak figures when `isPeakPeriod`,
 * exactly half of them otherwise (official rule).
 * @param modelPrices - the model's peak rates.
 * @param period - the current billing period.
 * @returns the per-million-token prices to bill with.
 */
export function pricesFor(modelPrices, period) {
    const factor = period === 'peak' ? 1 : 0.5;
    return {
        input: modelPrices.input * factor,
        cacheRead: modelPrices.cacheRead * factor,
        output: modelPrices.output * factor,
    };
}
/**
 * Accumulated session cost in CNY, from the durable token-usage projection
 * (the same buckets the client's own estimator uses) at the given prices.
 * Cache writes bill at the uncached-input rate, matching the client reader.
 * @param usage - the session's token-usage projection, or undefined.
 * @param prices - the per-million-token rates in effect.
 * @returns the billed total in yuan, 0 when usage is absent.
 */
export function sessionCostYuan(usage, prices) {
    if (usage === undefined)
        return 0;
    return (usage.uncachedInputTokens * prices.input
        + usage.cacheReadTokens * prices.cacheRead
        + usage.cacheWriteTokens * prices.input
        + usage.outputTokens * prices.output) / 1_000_000;
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
export function peakPricesAt(model, timeMs) {
    const flash = timeMs < FLASH_CUT_MS ? FLASH_PRICES_BEFORE_CUT : FLASH_PRICES_AFTER_CUT;
    if (model === 'deepseek-v4-pro') {
        return timeMs < PRO_ROUTED_TO_FLASH_MS ? PRO_PRICES : flash;
    }
    return flash;
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
export function pricesAt(model, timeMs, holidays = DEFAULT_HOLIDAY_SET) {
    const period = isPeakPeriod(new Date(timeMs), holidays) ? 'peak' : 'off-peak';
    return { ...pricesFor(peakPricesAt(model, timeMs), period), period };
}
/** The retired flash aliases the official API still accepts. */
const RETIRED_FLASH_ALIASES = new Set(['deepseek-v4-flash', 'deepseek-v4-flash-vision-exp']);
/**
 * The name a model id is grouped and displayed under. The official API serves
 * the retired `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` aliases
 * from the same V4.1-Flash model at the same rates, so a session that spans the
 * rename reports one flash row instead of two identical-priced ones;
 * `deepseek-v4-pro` keeps its own name while it still bills separately.
 * @param model - the provider model id recorded on an assistant message.
 * @returns the canonical model name for grouping and display.
 */
export function canonicalModel(model) {
    return RETIRED_FLASH_ALIASES.has(model) ? FLASH_MODEL : model;
}
/**
 * Add one assistant message's usage report into a per-model accumulator at
 * the rates of the moment that request ran.
 * @param usage - the usage the adapter reported for that step.
 * @param acc - the model's accumulator.
 * @param prices - the rates in effect for that request.
 */
function accumulateUsage(usage, acc, prices) {
    const cacheRead = usage.cacheReadTokens ?? 0;
    const cacheWrite = usage.cacheWriteTokens ?? 0;
    acc.uncachedInputTokens += usage.inputTokens;
    acc.cacheReadTokens += cacheRead;
    acc.cacheWriteTokens += cacheWrite;
    acc.outputTokens += usage.outputTokens;
    acc.requests += 1;
    acc.total += sessionCostYuan({
        uncachedInputTokens: usage.inputTokens,
        cacheReadTokens: cacheRead,
        cacheWriteTokens: cacheWrite,
        outputTokens: usage.outputTokens,
    }, prices);
    // Cache writes bill at the uncached-input rate, matching sessionCostYuan.
    acc.buckets.cacheRead += cacheRead * prices.cacheRead / 1_000_000;
    acc.buckets.uncachedInput += (usage.inputTokens + cacheWrite) * prices.input / 1_000_000;
    acc.buckets.output += usage.outputTokens * prices.output / 1_000_000;
}
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
export function foldSessionCost(session, holidays = DEFAULT_HOLIDAY_SET) {
    const byModel = new Map();
    let lastModel;
    for (const event of session.snapshotEvents()) {
        if (event.type !== 'assistant/message')
            continue;
        const source = event.data.message?.source;
        if (source === undefined || source.kind !== 'model')
            continue;
        if (event.data.usage === undefined)
            continue;
        // Group by canonical name: the flash aliases bill identically and must not
        // split one model into two rows when a session spans the rename.
        const model = canonicalModel(source.model);
        let acc = byModel.get(model);
        if (acc === undefined) {
            acc = {
                uncachedInputTokens: 0,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                outputTokens: 0,
                requests: 0,
                total: 0,
                buckets: { cacheRead: 0, uncachedInput: 0, output: 0 },
            };
            byModel.set(model, acc);
        }
        accumulateUsage(event.data.usage, acc, pricesAt(model, event.time, holidays));
        lastModel = model;
    }
    if (byModel.size === 0)
        return undefined;
    let total = 0;
    let requests = 0;
    const buckets = { cacheRead: 0, uncachedInput: 0, output: 0 };
    const models = [];
    for (const [model, acc] of byModel) {
        total += acc.total;
        requests += acc.requests;
        buckets.cacheRead += acc.buckets.cacheRead;
        buckets.uncachedInput += acc.buckets.uncachedInput;
        buckets.output += acc.buckets.output;
        models.push({ model, total: acc.total, requests: acc.requests });
    }
    // Expensive model first: the popover lists the session's cost drivers up top.
    models.sort((a, b) => b.total - a.total);
    const cost = { total, requests, buckets, models };
    if (lastModel !== undefined)
        cost.lastModel = lastModel;
    return cost;
}
/** Parse a DeepSeek balance response into the client's account row. */
export function parseBalanceInfo(raw) {
    if (typeof raw !== 'object' || raw === null)
        return undefined;
    const infos = raw.balance_infos;
    if (!Array.isArray(infos) || infos.length === 0)
        return undefined;
    const first = infos[0];
    if (typeof first !== 'object' || first === null)
        return undefined;
    const { currency, total_balance } = first;
    if (typeof currency !== 'string' || typeof total_balance !== 'string')
        return undefined;
    return { currency, total_balance };
}
/**
 * Fetch the official account balance with the given key.
 * @param apiKey - the resolved DeepSeek API key.
 * @returns the parsed balance row, or undefined when the API denied or answered unexpectedly.
 */
export function fetchBalance(apiKey) {
    return new Promise((resolve) => {
        const req = httpsRequest(BALANCE_URL, {
            method: 'GET',
            headers: {
                authorization: 'Bearer ' + apiKey,
                accept: 'application/json',
            },
            timeout: 15_000,
        }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                if (res.statusCode !== 200) {
                    resolve(undefined);
                    return;
                }
                try {
                    resolve(parseBalanceInfo(JSON.parse(body)));
                }
                catch {
                    resolve(undefined);
                }
            });
        });
        req.on('timeout', () => { req.destroy(); });
        req.on('error', () => { resolve(undefined); });
        req.end();
    });
}
/**
 * Resolve a session's live object by id through the store, returning
 * undefined when the session is not attached (cold sessions are priced by the
 * client from its own projection read — the route serves prices either way).
 * @param ctx - context carrying the optional sessions service.
 * @param sessionId - the query's session id, when given.
 * @returns the live session, or undefined.
 */
function liveSession(ctx, sessionId) {
    if (sessionId === undefined)
        return undefined;
    const sessions = ctx.get('sessions');
    if (sessions === undefined)
        return undefined;
    return sessions.get(sessionId);
}
/**
 * A session's settled token usage from the projection registry; undefined
 * when the registry is absent or the session has no usage yet. Reads the live
 * watermark snapshot only — never a log load.
 * @param ctx - context carrying the optional projection registry.
 * @param session - the live session being priced.
 * @returns the token-usage projection value, or undefined.
 */
function tokenUsageOf(ctx, session) {
    if (session === undefined)
        return undefined;
    const registry = ctx.get('sessionProjections');
    if (registry === undefined)
        return undefined;
    try {
        const values = registry.snapshot(session).values;
        return values.tokenUsage;
    }
    catch {
        // A projection fold failing for one session must not take the whole
        // balance/cost segment down with it; the client prices from its own read.
        return undefined;
    }
}
/**
 * 余额查询的缓存窗口(毫秒)。会话每推进一步都会问一次费用:费用在 host 侧按事件
 * 折叠(毫秒级),但余额要去 DeepSeek API 取 —— 余额不需要那么实时,按这个窗口
 * 复用最近一次结果,把"每步一次外网请求"降为"每窗口一次"。
 */
const BALANCE_CACHE_MS = 30_000;
/** 最近一次余额查询的结果、键与时间。 */
let balanceCache;
/**
 * Balance with the cache window above applied. The cache is keyed by the resolved
 * API key, so switching credentials never reuses another account's balance.
 * @param apiKey - the resolved DeepSeek API key.
 * @returns the parsed balance row, or undefined when the API denied.
 */
async function cachedBalance(apiKey) {
    const now = Date.now();
    if (balanceCache !== undefined && balanceCache.key === apiKey && now - balanceCache.at < BALANCE_CACHE_MS) {
        return balanceCache.value;
    }
    const value = await fetchBalance(apiKey);
    balanceCache = { at: now, key: apiKey, value };
    return value;
}
/** Resolve the DeepSeek API key through the credentials seam, or the environment. */
async function resolveApiKey(ctx) {
    const ref = credentialRef(API_KEY_ENV);
    const credentials = ctx.get('credentials');
    if (credentials !== undefined) {
        const hit = await credentials.resolve(ref);
        if (hit !== undefined)
            return hit.value;
        return undefined;
    }
    return process.env[API_KEY_ENV]?.trim() || undefined;
}
/**
 * Mount the `/api/dsh-balance` exact route. Registered as an effect so the
 * route lives and dies with this plugin's fiber.
 * @param ctx - context carrying the webServer service (declared inject).
 * @param config - plugin config; omitted only by tests that mount `{ apply }`.
 */
export function apply(ctx, config = { holidays: DEFAULT_HOLIDAYS }) {
    const holidays = new Set(config.holidays);
    ctx.inject(['webServer'], webCtx => webCtx.effect(() => webCtx.webServer.register({
        kind: 'exact',
        path: '/api/dsh-balance',
        handler: async (req, res) => {
            const respond = (body, status = 200) => {
                const payload = JSON.stringify(body);
                res.writeHead(status, {
                    'content-type': 'application/json; charset=utf-8',
                    'cache-control': 'no-store',
                });
                res.end(payload);
            };
            let sessionId;
            try {
                sessionId = new URL(req.url ?? '/', 'http://localhost').searchParams.get('sessionId') ?? undefined;
            }
            catch {
                sessionId = undefined;
            }
            const apiKey = await resolveApiKey(webCtx);
            const balance = apiKey === undefined ? undefined : await cachedBalance(apiKey);
            const session = liveSession(webCtx, sessionId);
            // The client's own estimator reads these: the rates in effect right now
            // for the model the deployment ships.
            const prices = pricesAt(FALLBACK_MODEL, Date.now(), holidays);
            const response = {
                prices,
                ...(balance !== undefined ? { balance_infos: [balance] } : {}),
            };
            // Exact per-request fold over the live log first; fall back to the
            // durable projection at today's rates when the session is not attached
            // (a cold session is priced by the client from its own read anyway).
            if (session !== undefined) {
                const folded = foldSessionCost(session, holidays);
                if (folded !== undefined) {
                    response.sessionCost = folded;
                }
            }
            else {
                const usage = tokenUsageOf(webCtx, session);
                const cost = sessionCostYuan(usage, prices);
                if (cost > 0 && usage !== undefined) {
                    // A cold session carries no per-model report, so the bucket split is
                    // priced at today's flash rates and the model list stays empty (the
                    // client renders the model section only when the host names one).
                    response.sessionCost = {
                        total: cost,
                        requests: 1,
                        buckets: {
                            cacheRead: usage.cacheReadTokens * prices.cacheRead / 1_000_000,
                            uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1_000_000,
                            output: usage.outputTokens * prices.output / 1_000_000,
                        },
                        models: [],
                    };
                }
            }
            respond(response);
        },
    }), 'web-balance: /api/dsh-balance route'));
}
//# sourceMappingURL=index.js.map