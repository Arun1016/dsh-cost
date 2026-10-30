import { request as httpsRequest } from "node:https";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
const name = "cost-stats";
const inject = ["webServer"];
const DEFAULT_HOLIDAYS = [
  // 元旦 2026-01-01..01-03
  "2026-01-01",
  "2026-01-02",
  "2026-01-03",
  // 春节 2026-02-15..02-23
  "2026-02-15",
  "2026-02-16",
  "2026-02-17",
  "2026-02-18",
  "2026-02-19",
  "2026-02-20",
  "2026-02-21",
  "2026-02-22",
  "2026-02-23",
  // 清明 2026-04-04..04-06
  "2026-04-04",
  "2026-04-05",
  "2026-04-06",
  // 劳动节 2026-05-01..05-05
  "2026-05-01",
  "2026-05-02",
  "2026-05-03",
  "2026-05-04",
  "2026-05-05",
  // 端午 2026-06-19..06-21
  "2026-06-19",
  "2026-06-20",
  "2026-06-21",
  // 中秋 2026-09-25..09-27
  "2026-09-25",
  "2026-09-26",
  "2026-09-27",
  // 国庆 2026-10-01..10-07
  "2026-10-01",
  "2026-10-02",
  "2026-10-03",
  "2026-10-04",
  "2026-10-05",
  "2026-10-06",
  "2026-10-07"
];
const DEFAULT_HOLIDAY_SET = new Set(DEFAULT_HOLIDAYS);
const Config = z.object({
  holidays: z.array(String).default(DEFAULT_HOLIDAYS)
});
const FLASH_PRICES_BEFORE_CUT = { input: 3, cacheRead: 0.1, output: 9 };
const FLASH_PRICES_AFTER_CUT = { input: 2, cacheRead: 0.04, output: 8 };
const PRO_PRICES = { input: 9, cacheRead: 0.3, output: 27 };
const FLASH_CUT_MS = Date.parse("2026-09-10T12:00:00+08:00");
const PRO_ROUTED_TO_FLASH_MS = Date.parse("2026-09-14T12:00:00+08:00");
const FLASH_MODEL = "deepseek-flash";
const FALLBACK_MODEL = FLASH_MODEL;
const WEB_CALL_PRICE_YUAN = 5 / 1e3;
const WEB_CALL_BILLING_START_MS = Date.parse("2026-11-01T00:00:00+08:00");
const WEB_SEARCH_TOOL = "web_search";
const WEB_FETCH_TOOL = "web_fetch";
const BALANCE_URL = "https://api.deepseek.com/user/balance";
const API_KEY_ENV = "DEEPSEEK_API_KEY";
function localDateKey(now) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}
function isPeakPeriod(now, holidays = DEFAULT_HOLIDAY_SET) {
  const day = now.getDay();
  if (day === 0 || day === 6) return false;
  if (holidays.has(localDateKey(now))) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= 9 * 60 && minutes < 12 * 60 || minutes >= 14 * 60 && minutes < 18 * 60;
}
function pricesFor(modelPrices, period) {
  const factor = period === "peak" ? 1 : 0.5;
  return {
    input: modelPrices.input * factor,
    cacheRead: modelPrices.cacheRead * factor,
    output: modelPrices.output * factor
  };
}
function sessionCostYuan(usage, prices) {
  if (usage === void 0) return 0;
  return (usage.uncachedInputTokens * prices.input + usage.cacheReadTokens * prices.cacheRead + usage.cacheWriteTokens * prices.input + usage.outputTokens * prices.output) / 1e6;
}
function peakPricesAt(model, timeMs) {
  const flash = timeMs < FLASH_CUT_MS ? FLASH_PRICES_BEFORE_CUT : FLASH_PRICES_AFTER_CUT;
  if (model === "deepseek-v4-pro") {
    return timeMs < PRO_ROUTED_TO_FLASH_MS ? PRO_PRICES : flash;
  }
  return flash;
}
function pricesAt(model, timeMs, holidays = DEFAULT_HOLIDAY_SET) {
  const period = isPeakPeriod(new Date(timeMs), holidays) ? "peak" : "off-peak";
  return { ...pricesFor(peakPricesAt(model, timeMs), period), period };
}
const RETIRED_FLASH_ALIASES = /* @__PURE__ */ new Set(["deepseek-v4-flash", "deepseek-v4-flash-vision-exp"]);
function canonicalModel(model) {
  return RETIRED_FLASH_ALIASES.has(model) ? FLASH_MODEL : model;
}
function webCallPriceYuan(timeMs) {
  return timeMs >= WEB_CALL_BILLING_START_MS ? WEB_CALL_PRICE_YUAN : 0;
}
function webSearchQueries(raw) {
  if (typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.queries)) return [];
    return [...new Set(parsed.queries.filter((query) => typeof query === "string"))];
  } catch {
    return [];
  }
}
function toolResultText(message) {
  if (!Array.isArray(message.content)) return "";
  const parts = [];
  for (const block of message.content) {
    if (typeof block !== "object" || block === null) continue;
    const { type, text } = block;
    if (type === "text" && typeof text === "string") parts.push(text);
  }
  return parts.join("\n");
}
function foldSessionWebCost(session) {
  const search = { calls: 0, amount: 0 };
  const fetch = { calls: 0, amount: 0 };
  const calls = /* @__PURE__ */ new Map();
  for (const event of session.snapshotEvents()) {
    if (event.type === "tool/call") {
      const data = event.data;
      if (typeof data.name !== "string" || typeof data.callId !== "string") continue;
      if (data.name !== WEB_SEARCH_TOOL && data.name !== WEB_FETCH_TOOL) continue;
      calls.set(data.callId, {
        name: data.name,
        queries: data.name === WEB_SEARCH_TOOL ? webSearchQueries(data.arguments) : []
      });
      continue;
    }
    if (event.type !== "tool/result") continue;
    const message = event.data.message;
    if (message === void 0 || typeof message.toolCallId !== "string") continue;
    const call = calls.get(message.toolCallId);
    if (call === void 0) continue;
    if (message.isError === true) continue;
    const price = webCallPriceYuan(event.time);
    if (call.name === WEB_FETCH_TOOL) {
      fetch.calls += 1;
      fetch.amount += price;
      continue;
    }
    if (toolResultText(message).includes("No results found.")) continue;
    const requests = call.queries.length;
    if (requests === 0) continue;
    search.calls += requests;
    search.amount += requests * price;
  }
  return { search, fetch };
}
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
        buckets: { cacheRead: 0, uncachedInput: 0, output: 0 }
      };
      byModel.set(model, acc);
    }
    accumulateUsage(event.data.usage, acc, pricesAt(model, event.time, holidays));
    lastModel = model;
  }
  const web = foldSessionWebCost(session);
  if (byModel.size === 0 && web.search.calls === 0 && web.fetch.calls === 0) return void 0;
  let total = web.search.amount + web.fetch.amount;
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
  models.sort((a, b) => b.total - a.total);
  const cost = { total, requests, buckets, models, web };
  if (lastModel !== void 0) cost.lastModel = lastModel;
  return cost;
}
function parseBalanceInfo(raw) {
  if (typeof raw !== "object" || raw === null) return void 0;
  const infos = raw.balance_infos;
  if (!Array.isArray(infos) || infos.length === 0) return void 0;
  const first = infos[0];
  if (typeof first !== "object" || first === null) return void 0;
  const { currency, total_balance } = first;
  if (typeof currency !== "string" || typeof total_balance !== "string") return void 0;
  return { currency, total_balance };
}
function fetchBalance(apiKey) {
  return new Promise((resolve) => {
    const req = httpsRequest(BALANCE_URL, {
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
function liveSession(ctx, sessionId) {
  if (sessionId === void 0) return void 0;
  const sessions = ctx.get("sessions");
  if (sessions === void 0) return void 0;
  return sessions.get(sessionId);
}
function tokenUsageOf(ctx, session) {
  if (session === void 0) return void 0;
  const registry = ctx.get("sessionProjections");
  if (registry === void 0) return void 0;
  try {
    const values = registry.snapshot(session).values;
    return values.tokenUsage;
  } catch {
    return void 0;
  }
}
const BALANCE_CACHE_MS = 3e4;
let balanceCache;
async function cachedBalance(apiKey) {
  const now = Date.now();
  if (balanceCache !== void 0 && balanceCache.key === apiKey && now - balanceCache.at < BALANCE_CACHE_MS) {
    return balanceCache.value;
  }
  const value = await fetchBalance(apiKey);
  balanceCache = { at: now, key: apiKey, value };
  return value;
}
async function resolveApiKey(ctx) {
  const ref = credentialRef(API_KEY_ENV);
  const credentials = ctx.get("credentials");
  if (credentials !== void 0) {
    const hit = await credentials.resolve(ref);
    if (hit !== void 0) return hit.value;
    return void 0;
  }
  return process.env[API_KEY_ENV]?.trim() || void 0;
}
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
        if (folded !== void 0) {
          response.sessionCost = folded;
        }
      } else {
        const usage = tokenUsageOf(webCtx, session);
        const cost = sessionCostYuan(usage, prices);
        if (cost > 0 && usage !== void 0) {
          response.sessionCost = {
            total: cost,
            requests: 1,
            buckets: {
              cacheRead: usage.cacheReadTokens * prices.cacheRead / 1e6,
              uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1e6,
              output: usage.outputTokens * prices.output / 1e6
            },
            models: [],
            web: {
              search: { calls: 0, amount: 0 },
              fetch: { calls: 0, amount: 0 }
            }
          };
        }
      }
      respond(response);
    }
  }), "web-balance: /api/dsh-balance route"));
}
export {
  Config,
  apply,
  canonicalModel,
  fetchBalance,
  foldSessionCost,
  foldSessionWebCost,
  inject,
  isPeakPeriod,
  name,
  parseBalanceInfo,
  peakPricesAt,
  pricesAt,
  pricesFor,
  sessionCostYuan,
  webCallPriceYuan,
  webSearchQueries
};
