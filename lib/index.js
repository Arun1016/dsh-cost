import { request } from "node:https";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
//#region lib/types/index.js
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
/** Stable Cordis plugin name. */
const name = "cost-stats";
/** Services required before the balance route can register. */
const inject = ["webServer"];
/**
* Statutory-holiday dates (Beijing local calendar, `YYYY-MM-DD`) that bill at
* off-peak rates for the whole day. The official rule makes every statutory
* holiday and every weekend off-peak regardless of the clock, including a
* weekend that holiday adjustment turns into a workday. Dates come from the
* State Council's annual notice; a deployment overrides them through Config
* when the next year is published.
*/
const DEFAULT_HOLIDAYS = [
	"2026-01-01",
	"2026-01-02",
	"2026-01-03",
	"2026-02-15",
	"2026-02-16",
	"2026-02-17",
	"2026-02-18",
	"2026-02-19",
	"2026-02-20",
	"2026-02-21",
	"2026-02-22",
	"2026-02-23",
	"2026-04-04",
	"2026-04-05",
	"2026-04-06",
	"2026-05-01",
	"2026-05-02",
	"2026-05-03",
	"2026-05-04",
	"2026-05-05",
	"2026-06-19",
	"2026-06-20",
	"2026-06-21",
	"2026-09-25",
	"2026-09-26",
	"2026-09-27",
	"2026-10-01",
	"2026-10-02",
	"2026-10-03",
	"2026-10-04",
	"2026-10-05",
	"2026-10-06",
	"2026-10-07"
];
/** The shipped calendar as a lookup set, and the default for every classifier. */
const DEFAULT_HOLIDAY_SET = new Set(DEFAULT_HOLIDAYS);
/** Config schema; the shipped default is the current statutory-holiday notice. */
const Config = z.object({ holidays: z.array(String).default(DEFAULT_HOLIDAYS) });
/** Flash peak rates before the 2026-09-10 (Beijing) price cut. */
const FLASH_PRICES_BEFORE_CUT = {
	input: 3,
	cacheRead: .1,
	output: 9
};
/** Flash peak rates from the 2026-09-10 (Beijing) price cut on. */
const FLASH_PRICES_AFTER_CUT = {
	input: 2,
	cacheRead: .04,
	output: 8
};
/** `deepseek-v4-pro` peak rates, valid while that model still serves itself. */
const PRO_PRICES = {
	input: 9,
	cacheRead: .3,
	output: 27
};
/**
* When the official flash price cut took effect: 2026-09-10 12:00 Beijing.
* Requests before it bill at `FLASH_PRICES_BEFORE_CUT` and requests after it
* at `FLASH_PRICES_AFTER_CUT`, so one session can legitimately span both.
*/
const FLASH_CUT_MS = Date.parse("2026-09-10T12:00:00+08:00");
/**
* When `deepseek-v4-pro` requests started routing to V4.1 Flash and billing at
* the flash rates: 2026-09-14 12:00 Beijing, per the official announcement.
*/
const PRO_ROUTED_TO_FLASH_MS = Date.parse("2026-09-14T12:00:00+08:00");
/** The model id the official docs now use for the whole flash family. */
const FLASH_MODEL = "deepseek-flash";
/** The model id whose rates price a session that reports no usable model. */
const FALLBACK_MODEL = FLASH_MODEL;
/** Official DeepSeek account-balance endpoint. */
const BALANCE_URL = "https://api.deepseek.com/user/balance";
/** Credential reference for the DeepSeek API key, matching llm-deepseek's default. */
const API_KEY_ENV = "DEEPSEEK_API_KEY";
/**
* The local calendar date key (`YYYY-MM-DD`) a moment falls on, matching the
* statutory-holiday list's format.
* @param now - the moment to key, in the server's local timezone.
* @returns the date key.
*/
function localDateKey(now) {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
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
function isPeakPeriod(now, holidays = DEFAULT_HOLIDAY_SET) {
	const day = now.getDay();
	if (day === 0 || day === 6) return false;
	if (holidays.has(localDateKey(now))) return false;
	const minutes = now.getHours() * 60 + now.getMinutes();
	return minutes >= 540 && minutes < 720 || minutes >= 840 && minutes < 1080;
}
/**
* The billing prices for one period: peak figures when `isPeakPeriod`,
* exactly half of them otherwise (official rule).
* @param modelPrices - the model's peak rates.
* @param period - the current billing period.
* @returns the per-million-token prices to bill with.
*/
function pricesFor(modelPrices, period) {
	const factor = period === "peak" ? 1 : .5;
	return {
		input: modelPrices.input * factor,
		cacheRead: modelPrices.cacheRead * factor,
		output: modelPrices.output * factor
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
function sessionCostYuan(usage, prices) {
	if (usage === void 0) return 0;
	return (usage.uncachedInputTokens * prices.input + usage.cacheReadTokens * prices.cacheRead + usage.cacheWriteTokens * prices.input + usage.outputTokens * prices.output) / 1e6;
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
function peakPricesAt(model, timeMs) {
	const flash = timeMs < FLASH_CUT_MS ? FLASH_PRICES_BEFORE_CUT : FLASH_PRICES_AFTER_CUT;
	if (model === "deepseek-v4-pro") return timeMs < PRO_ROUTED_TO_FLASH_MS ? PRO_PRICES : flash;
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
function pricesAt(model, timeMs, holidays = DEFAULT_HOLIDAY_SET) {
	const period = isPeakPeriod(new Date(timeMs), holidays) ? "peak" : "off-peak";
	return {
		...pricesFor(peakPricesAt(model, timeMs), period),
		period
	};
}
/** The retired flash aliases the official API still accepts. */
const RETIRED_FLASH_ALIASES = new Set(["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]);
/**
* The name a model id is grouped and displayed under. The official API serves
* the retired `deepseek-v4-flash` and `deepseek-v4-flash-vision-exp` aliases
* from the same V4.1-Flash model at the same rates, so a session that spans the
* rename reports one flash row instead of two identical-priced ones;
* `deepseek-v4-pro` keeps its own name while it still bills separately.
* @param model - the provider model id recorded on an assistant message.
* @returns the canonical model name for grouping and display.
*/
function canonicalModel(model) {
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
		outputTokens: usage.outputTokens
	}, prices);
	acc.buckets.cacheRead += cacheRead * prices.cacheRead / 1e6;
	acc.buckets.uncachedInput += (usage.inputTokens + cacheWrite) * prices.input / 1e6;
	acc.buckets.output += usage.outputTokens * prices.output / 1e6;
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
function foldSessionCost(session, holidays = DEFAULT_HOLIDAY_SET) {
	const byModel = /* @__PURE__ */ new Map();
	let lastModel;
	for (const event of session.snapshotEvents()) {
		if (event.type !== "assistant/message") continue;
		const source = event.data.message?.source;
		if (source === void 0 || source.kind !== "model") continue;
		if (event.data.usage === void 0) continue;
		const model = canonicalModel(source.model);
		let acc = byModel.get(model);
		if (acc === void 0) {
			acc = {
				uncachedInputTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				outputTokens: 0,
				requests: 0,
				total: 0,
				buckets: {
					cacheRead: 0,
					uncachedInput: 0,
					output: 0
				}
			};
			byModel.set(model, acc);
		}
		accumulateUsage(event.data.usage, acc, pricesAt(model, event.time, holidays));
		lastModel = model;
	}
	if (byModel.size === 0) return void 0;
	let total = 0;
	let requests = 0;
	const buckets = {
		cacheRead: 0,
		uncachedInput: 0,
		output: 0
	};
	const models = [];
	for (const [model, acc] of byModel) {
		total += acc.total;
		requests += acc.requests;
		buckets.cacheRead += acc.buckets.cacheRead;
		buckets.uncachedInput += acc.buckets.uncachedInput;
		buckets.output += acc.buckets.output;
		models.push({
			model,
			total: acc.total,
			requests: acc.requests
		});
	}
	models.sort((a, b) => b.total - a.total);
	const cost = {
		total,
		requests,
		buckets,
		models
	};
	if (lastModel !== void 0) cost.lastModel = lastModel;
	return cost;
}
/** Parse a DeepSeek balance response into the client's account row. */
function parseBalanceInfo(raw) {
	if (typeof raw !== "object" || raw === null) return void 0;
	const infos = raw.balance_infos;
	if (!Array.isArray(infos) || infos.length === 0) return void 0;
	const first = infos[0];
	if (typeof first !== "object" || first === null) return void 0;
	const { currency, total_balance } = first;
	if (typeof currency !== "string" || typeof total_balance !== "string") return void 0;
	return {
		currency,
		total_balance
	};
}
/**
* Fetch the official account balance with the given key.
* @param apiKey - the resolved DeepSeek API key.
* @returns the parsed balance row, or undefined when the API denied or answered unexpectedly.
*/
function fetchBalance(apiKey) {
	return new Promise((resolve) => {
		const req = request(BALANCE_URL, {
			method: "GET",
			headers: {
				authorization: "Bearer " + apiKey,
				accept: "application/json"
			},
			timeout: 15e3
		}, (res) => {
			let body = "";
			res.setEncoding("utf8");
			res.on("data", (chunk) => {
				body += chunk;
			});
			res.on("end", () => {
				if (res.statusCode !== 200) {
					resolve(void 0);
					return;
				}
				try {
					resolve(parseBalanceInfo(JSON.parse(body)));
				} catch {
					resolve(void 0);
				}
			});
		});
		req.on("timeout", () => {
			req.destroy();
		});
		req.on("error", () => {
			resolve(void 0);
		});
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
	if (sessionId === void 0) return void 0;
	const sessions = ctx.get("sessions");
	if (sessions === void 0) return void 0;
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
	if (session === void 0) return void 0;
	const registry = ctx.get("sessionProjections");
	if (registry === void 0) return void 0;
	try {
		return registry.snapshot(session).values.tokenUsage;
	} catch {
		return;
	}
}
/**
* 余额查询的缓存窗口(毫秒)。会话每推进一步都会问一次费用:费用在 host 侧按事件
* 折叠(毫秒级),但余额要去 DeepSeek API 取 —— 余额不需要那么实时,按这个窗口
* 复用最近一次结果,把"每步一次外网请求"降为"每窗口一次"。
*/
const BALANCE_CACHE_MS = 3e4;
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
	if (balanceCache !== void 0 && balanceCache.key === apiKey && now - balanceCache.at < BALANCE_CACHE_MS) return balanceCache.value;
	const value = await fetchBalance(apiKey);
	balanceCache = {
		at: now,
		key: apiKey,
		value
	};
	return value;
}
/** Resolve the DeepSeek API key through the credentials seam, or the environment. */
async function resolveApiKey(ctx) {
	const ref = credentialRef(API_KEY_ENV);
	const credentials = ctx.get("credentials");
	if (credentials !== void 0) {
		const hit = await credentials.resolve(ref);
		if (hit !== void 0) return hit.value;
		return;
	}
	return process.env[API_KEY_ENV]?.trim() || void 0;
}
/**
* Mount the `/api/dsh-balance` exact route. Registered as an effect so the
* route lives and dies with this plugin's fiber.
* @param ctx - context carrying the webServer service (declared inject).
* @param config - plugin config; omitted only by tests that mount `{ apply }`.
*/
function apply(ctx, config = { holidays: DEFAULT_HOLIDAYS }) {
	const holidays = new Set(config.holidays);
	ctx.inject(["webServer"], (webCtx) => webCtx.effect(() => webCtx.webServer.register({
		kind: "exact",
		path: "/api/dsh-balance",
		handler: async (req, res) => {
			const respond = (body, status = 200) => {
				const payload = JSON.stringify(body);
				res.writeHead(status, {
					"content-type": "application/json; charset=utf-8",
					"cache-control": "no-store"
				});
				res.end(payload);
			};
			let sessionId;
			try {
				sessionId = new URL(req.url ?? "/", "http://localhost").searchParams.get("sessionId") ?? void 0;
			} catch {
				sessionId = void 0;
			}
			const apiKey = await resolveApiKey(webCtx);
			const balance = apiKey === void 0 ? void 0 : await cachedBalance(apiKey);
			const session = liveSession(webCtx, sessionId);
			const prices = pricesAt(FALLBACK_MODEL, Date.now(), holidays);
			const response = {
				prices,
				...balance !== void 0 ? { balance_infos: [balance] } : {}
			};
			if (session !== void 0) {
				const folded = foldSessionCost(session, holidays);
				if (folded !== void 0) response.sessionCost = folded;
			} else {
				const usage = tokenUsageOf(webCtx, session);
				const cost = sessionCostYuan(usage, prices);
				if (cost > 0 && usage !== void 0) response.sessionCost = {
					total: cost,
					requests: 1,
					buckets: {
						cacheRead: usage.cacheReadTokens * prices.cacheRead / 1e6,
						uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1e6,
						output: usage.outputTokens * prices.output / 1e6
					},
					models: []
				};
			}
			respond(response);
		}
	}), "web-balance: /api/dsh-balance route"));
}
//#endregion
export { Config, apply, canonicalModel, fetchBalance, foldSessionCost, inject, isPeakPeriod, name, parseBalanceInfo, peakPricesAt, pricesAt, pricesFor, sessionCostYuan };
