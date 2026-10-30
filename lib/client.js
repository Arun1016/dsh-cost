window.__ModuleLoader__.load({
	id: "dsh-cost-pill",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region css: BalancePill.module.css
		const css = "/* ../dsh-cost-stats/src/client/BalancePill.module.css */\n.BalancePill_anchor {\n  display: inline-flex;\n  min-width: 0;\n  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);\n  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));\n}\n.BalancePill_pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  box-sizing: border-box;\n  max-width: 100%;\n  padding: 1px 8px;\n  border: none;\n  border-radius: 24px;\n  background: transparent;\n  color: var(--dsw-alias-label-tertiary);\n  font: inherit;\n  font-variant-numeric: tabular-nums;\n  line-height: inherit;\n  white-space: nowrap;\n  cursor: pointer;\n}\n.BalancePill_pill svg {\n  width: 14px;\n  height: 14px;\n  flex: none;\n}\n.BalancePill_pill:hover,\n.BalancePill_pill[aria-expanded=true] {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n}\n.BalancePill_label {\n  min-width: 0;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n.BalancePill_period {\n  display: inline;\n}\n.BalancePill_periodDot {\n  display: inline-block;\n  width: 1em;\n  height: 1em;\n  margin-right: 0.12em;\n  border-radius: 50%;\n  vertical-align: -0.17em;\n  background: var(--dsw-alias-state-success-primary);\n}\n.BalancePill_peak {\n  background: var(--dsw-alias-state-error-primary);\n}\n.BalancePill_sep {\n  color: var(--dsw-alias-separator-primary);\n  margin: 0 2px;\n}\n.BalancePill_modelsTitle {\n  margin-bottom: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-weight: 500;\n}\n.BalancePill_subagentsTitle {\n  display: flex;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 8px;\n  color: var(--dsw-alias-label-secondary);\n  font-weight: 500;\n}\n.BalancePill_subagentsTotal {\n  color: var(--dsw-alias-label-secondary);\n  font-variant-numeric: tabular-nums;\n}\n.BalancePill_subagents {\n  display: grid;\n  grid-template-columns: minmax(0, 1.5fr) auto auto auto;\n  gap: 6px 10px;\n  color: var(--dsw-alias-label-tertiary);\n}\n.BalancePill_subagentHead {\n  font-size: 11px;\n  line-height: 14px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n}\n.BalancePill_subagentName {\n  min-width: 0;\n  color: var(--dsw-alias-label-secondary);\n  overflow-wrap: anywhere;\n}\n.BalancePill_subagentLabel {\n  display: block;\n}\n.BalancePill_subagentMeta {\n  display: block;\n  font-size: 11px;\n  line-height: 14px;\n  color: var(--dsw-alias-label-tertiary);\n  font-variant-numeric: tabular-nums;\n}\n.BalancePill_subagentNum {\n  color: var(--dsw-alias-label-secondary);\n  font-variant-numeric: tabular-nums;\n  text-align: right;\n  white-space: nowrap;\n}\n.BalancePill_panel {\n  position: fixed;\n  z-index: 1100;\n  box-sizing: border-box;\n  width: max-content;\n  min-width: min(300px, calc(100vw - 24px));\n  max-width: min(440px, calc(100vw - 24px));\n  padding: 16px;\n  border: 0;\n  border-radius: 12px;\n  background: var(--dsw-specific-menu);\n  backdrop-filter: var(--dsw-menu-backdrop-filter);\n  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);\n  box-shadow: var(--dsw-elevation-prominent);\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  cursor: default;\n}\n.BalancePill_title {\n  display: flex;\n  justify-content: space-between;\n  gap: 16px;\n  margin-bottom: 8px;\n  color: var(--dsw-alias-label-primary);\n  font-weight: 500;\n}\n.BalancePill_titleLabel {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  min-width: 0;\n}\n.BalancePill_titleLabel svg {\n  width: 14px;\n  height: 14px;\n  flex: none;\n}\n.BalancePill_titleRule {\n  margin-bottom: 10px;\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n.BalancePill_details {\n  display: grid;\n  grid-template-columns: minmax(76px, auto) minmax(0, 1fr);\n  gap: 6px 16px;\n  margin: 0;\n  color: var(--dsw-alias-label-tertiary);\n}\n.BalancePill_details dt,\n.BalancePill_details dd {\n  min-width: 0;\n  margin: 0;\n}\n.BalancePill_details dd {\n  color: var(--dsw-alias-label-secondary);\n  font-variant-numeric: tabular-nums;\n  text-align: right;\n}\n.BalancePill_details .BalancePill_route {\n  overflow-wrap: anywhere;\n}\n";
		const tagId = "dsh-cost-pill/BalancePill.module.css.a3204d56";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cost-pill";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../dsh-cost-stats/src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// ../dsh-cost-stats/src/client/BalancePill.tsx
var import_react = require("react");
var import_react_dom = require("react-dom");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// ../dsh-cost-stats/src/client/BalancePill.module.css
var BalancePill_default = {
  anchor: "BalancePill_anchor",
  pill: "BalancePill_pill",
  label: "BalancePill_label",
  period: "BalancePill_period",
  periodDot: "BalancePill_periodDot",
  peak: "BalancePill_peak",
  sep: "BalancePill_sep",
  modelsTitle: "BalancePill_modelsTitle",
  subagentsTitle: "BalancePill_subagentsTitle",
  subagentsTotal: "BalancePill_subagentsTotal",
  subagents: "BalancePill_subagents",
  subagentHead: "BalancePill_subagentHead",
  subagentName: "BalancePill_subagentName",
  subagentLabel: "BalancePill_subagentLabel",
  subagentMeta: "BalancePill_subagentMeta",
  subagentNum: "BalancePill_subagentNum",
  panel: "BalancePill_panel",
  title: "BalancePill_title",
  titleLabel: "BalancePill_titleLabel",
  titleRule: "BalancePill_titleRule",
  details: "BalancePill_details",
  route: "BalancePill_route"
};

// ../dsh-cost-stats/src/client/BalancePill.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var FALLBACK_PRICES = { input: 2, cacheRead: 0.04, output: 8 };
var PANEL_MARGIN = 12;
var PANEL_GAP = 8;
var MEASURE_STYLE = { visibility: "hidden", left: 0, top: 0 };
function sessionCost(usage, prices = FALLBACK_PRICES) {
  if (usage === void 0) return 0;
  return (usage.uncachedInputTokens * prices.input + usage.cacheReadTokens * prices.cacheRead + usage.cacheWriteTokens * prices.input + usage.outputTokens * prices.output) / 1e6;
}
function bucketCost(usage, prices) {
  if (usage === void 0) return { cacheRead: 0, uncachedInput: 0, output: 0 };
  return {
    cacheRead: usage.cacheReadTokens * prices.cacheRead / 1e6,
    uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1e6,
    output: usage.outputTokens * prices.output / 1e6
  };
}
function formatAmount(yuan) {
  if (yuan > 0 && yuan < 0.01) return yuan.toFixed(4);
  return yuan.toFixed(2);
}
function formatWebAmount(yuan) {
  return yuan.toFixed(3);
}
function formatSubagentAmount(yuan) {
  if (yuan > 0 && yuan < 0.1) return yuan.toFixed(4);
  return yuan.toFixed(2);
}
var BalancePill = (0, import_react.memo)(function BalancePill2({ useProjection, sessionId, t }) {
  const usage = useProjection("tokenUsage");
  const [open, setOpen] = (0, import_react.useState)(false);
  const rootRef = (0, import_react.useRef)(null);
  const panelRef = (0, import_react.useRef)(null);
  const pos = (0, import_dsh_client_ui_primitives.useAnchoredPosition)({
    open,
    anchorRef: rootRef,
    panelRef,
    side: "top",
    gap: PANEL_GAP,
    margin: PANEL_MARGIN
  });
  (0, import_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen, panelRef);
  (0, import_react.useEffect)(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  const steps = useProjection("sessionStats")?.steps ?? 0;
  const [balance, setBalance] = (0, import_react.useState)({});
  (0, import_react.useEffect)(() => {
    let alive = true;
    const query = sessionId === void 0 ? "" : `?sessionId=${encodeURIComponent(sessionId)}`;
    const load = async () => {
      try {
        const res = await fetch(`/api/dsh-balance${query}`);
        const data = await res.json();
        if (!alive) return;
        if (data.error !== void 0) {
          setBalance({ error: String(data.error) });
          return;
        }
        const info = data.balance_infos?.[0];
        const rawTotal = data.sessionCost?.total;
        const parsedPrices = data.prices === void 0 ? void 0 : {
          input: Number(data.prices.input),
          cacheRead: Number(data.prices.cacheRead),
          output: Number(data.prices.output)
        };
        const parsedPeriod = typeof data.prices?.period === "string" ? data.prices.period : void 0;
        const rawBuckets = data.sessionCost?.buckets;
        const parsedBuckets = rawBuckets === void 0 ? void 0 : {
          cacheRead: Number(rawBuckets.cacheRead),
          uncachedInput: Number(rawBuckets.uncachedInput),
          output: Number(rawBuckets.output)
        };
        const parsedModels = Array.isArray(data.sessionCost?.models) ? data.sessionCost.models.flatMap((row) => typeof row?.model === "string" && typeof row.total === "number" ? [{ model: row.model, total: row.total }] : []) : void 0;
        const rawWeb = data.sessionCost?.web;
        const webApi = (api) => ({
          calls: Number(api?.calls ?? 0),
          amount: Number(api?.amount ?? 0)
        });
        const parsedWeb = rawWeb === void 0 ? void 0 : { search: webApi(rawWeb.search), fetch: webApi(rawWeb.fetch) };
        const rawSubagents = data.sessionCost?.subagents;
        const rawSubagentItems = rawSubagents?.items;
        const subagentItems = Array.isArray(rawSubagentItems) ? rawSubagentItems.flatMap((row) => typeof row?.id === "string" ? [{
          id: row.id,
          ...typeof row.label === "string" && row.label.length > 0 ? { label: row.label } : {},
          requests: Number(row.requests ?? 0),
          token: Number(row.token ?? 0),
          web: { search: webApi(row.web?.search), fetch: webApi(row.web?.fetch) },
          total: Number(row.total ?? 0)
        }] : []) : [];
        const parsedSubagents = rawSubagents === void 0 ? void 0 : {
          sessions: Number(rawSubagents.sessions ?? 0),
          total: Number(rawSubagents.total ?? 0),
          items: subagentItems
        };
        setBalance({
          ...info === void 0 ? {} : { total: String(info.total_balance) },
          ...parsedPrices === void 0 ? {} : { prices: parsedPrices },
          ...parsedPeriod === void 0 ? {} : { period: parsedPeriod },
          ...typeof rawTotal === "number" && Number.isFinite(rawTotal) ? { sessionCost: rawTotal } : {},
          ...parsedBuckets === void 0 ? {} : { buckets: parsedBuckets },
          ...parsedModels === void 0 ? {} : { models: parsedModels },
          ...parsedWeb === void 0 ? {} : { web: parsedWeb },
          ...parsedSubagents === void 0 ? {} : { subagents: parsedSubagents }
        });
      } catch (error) {
        if (alive) setBalance({ error: String(error) });
      }
    };
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 6e4);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [sessionId, balance.error === void 0 ? steps : -1]);
  if (balance.error !== void 0 || balance.prices === void 0) return null;
  const peak = balance.period === "peak";
  const periodText = balance.period === void 0 ? null : peak ? t("balance.period.peak") : t("balance.period.offpeak");
  const balanceText = balance.total === void 0 ? null : t("balance.account", { amount: Number(balance.total).toFixed(2) });
  const exact = balance.sessionCost;
  const cost = exact ?? sessionCost(usage, balance.prices);
  const web = balance.web ?? { search: { calls: 0, amount: 0 }, fetch: { calls: 0, amount: 0 } };
  const webCalls = web.search.calls + web.fetch.calls;
  const costText = cost > 0 ? exact !== void 0 ? t("balance.sessionCost", { amount: formatAmount(cost) }) : t("balance.sessionCostEst", { amount: formatAmount(cost) }) : null;
  if (periodText === null && balanceText === null && costText === null && webCalls === 0) return null;
  const buckets = balance.buckets ?? bucketCost(usage, balance.prices);
  const models = balance.models ?? [];
  const subagents = balance.subagents;
  const hasSubagents = subagents !== void 0 && subagents.sessions > 0;
  const modelsTitle = hasSubagents ? t("balance.dialog.modelsWithSubagents") : t("balance.dialog.models");
  const amount = (yuan) => t("balance.amount", { amount: formatAmount(yuan) });
  const webAmount = (api) => api.calls > 0 && api.amount === 0 ? t("balance.dialog.webFree") : t("balance.amount", { amount: formatWebAmount(api.amount) });
  const subagentAmount = (yuan) => t("balance.amount", { amount: formatSubagentAmount(yuan) });
  const subagentMeta = (item) => {
    const parts = [t("balance.dialog.subagentRequests", { count: item.requests })];
    if (item.web.search.calls > 0) parts.push(t("balance.dialog.subagentSearch", { count: item.web.search.calls }));
    if (item.web.fetch.calls > 0) parts.push(t("balance.dialog.subagentFetch", { count: item.web.fetch.calls }));
    return parts.join(" \xB7 ");
  };
  const subagentWeb = (item) => {
    const calls = item.web.search.calls + item.web.fetch.calls;
    if (calls === 0) return "\u2014";
    const webTotal = item.web.search.amount + item.web.fetch.amount;
    return webTotal === 0 ? t("balance.dialog.webFree") : t("balance.amount", { amount: formatWebAmount(webTotal) });
  };
  const separator = /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.sep, "aria-hidden": true, children: "\xB7" });
  const labelText = [periodText, balanceText, costText].filter((part) => part !== null).join(" \xB7 ");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { ref: rootRef, className: BalancePill_default.anchor, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        className: BalancePill_default.pill,
        "aria-haspopup": "dialog",
        "aria-expanded": open,
        "aria-label": labelText,
        onClick: () => {
          setOpen(!open);
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconDataOutlineRegular, {}),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: BalancePill_default.label, children: [
            periodText !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: BalancePill_default.period, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: peak ? `${BalancePill_default.periodDot} ${BalancePill_default.peak}` : BalancePill_default.periodDot, "aria-hidden": true }),
              periodText
            ] }),
            periodText !== null && balanceText !== null && separator,
            balanceText,
            balanceText !== null && costText !== null && separator,
            costText
          ] })
        ]
      }
    ),
    (0, import_react_dom.createPortal)(
      open && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          ref: panelRef,
          className: BalancePill_default.panel,
          role: "dialog",
          "aria-label": t("balance.dialog.title"),
          style: pos ?? MEASURE_STYLE,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: BalancePill_default.title, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: BalancePill_default.titleLabel, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.IconDataOutlineRegular, {}),
              t("balance.dialog.title")
            ] }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: BalancePill_default.titleRule, "aria-hidden": true }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", { className: BalancePill_default.details, "data-session-balance": true, children: [
              periodText !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.period") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: periodText })
              ] }),
              balanceText !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.account") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: balanceText })
              ] }),
              (costText !== null || webCalls > 0) && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.sessionCost") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: costText ?? t("balance.sessionCost", { amount: formatAmount(cost) }) })
              ] }),
              costText !== null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.cacheRead") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: amount(buckets.cacheRead) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.uncachedInput") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: amount(buckets.uncachedInput) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.output") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: amount(buckets.output) })
              ] }),
              web.search.calls > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.webSearch", { count: web.search.calls }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: webAmount(web.search) })
              ] }),
              web.fetch.calls > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: t("balance.dialog.webFetch", { count: web.fetch.calls }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: webAmount(web.fetch) })
              ] })
            ] }),
            hasSubagents && subagents !== void 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: BalancePill_default.titleRule, "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: BalancePill_default.subagentsTitle, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("balance.dialog.subagents", { count: subagents.sessions }) }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentsTotal, children: subagentAmount(subagents.total) })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: BalancePill_default.subagents, "data-session-balance-subagents": true, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentHead, children: t("balance.dialog.subagentName") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${BalancePill_default.subagentHead} ${BalancePill_default.subagentNum}`, children: t("balance.dialog.subagentToken") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${BalancePill_default.subagentHead} ${BalancePill_default.subagentNum}`, children: t("balance.dialog.subagentWeb") }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: `${BalancePill_default.subagentHead} ${BalancePill_default.subagentNum}`, children: t("balance.dialog.subagentTotal") }),
                subagents.items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: BalancePill_default.subagentName, children: [
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentLabel, children: item.label ?? item.id }),
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentMeta, children: subagentMeta(item) })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentNum, children: subagentAmount(item.token) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentNum, children: subagentWeb(item) }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: BalancePill_default.subagentNum, children: subagentAmount(item.total) })
                ] }, item.id))
              ] })
            ] }),
            models.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: BalancePill_default.titleRule, "aria-hidden": true }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: BalancePill_default.modelsTitle, children: modelsTitle }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", { className: BalancePill_default.details, "data-session-balance-models": true, children: models.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_react.Fragment, { children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { className: BalancePill_default.route, children: row.model }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children: amount(row.total) })
              ] }, row.model)) })
            ] })
          ]
        }
      ),
      document.body
    )
  ] });
});

// ../dsh-cost-stats/src/client/locales.ts
var NS = "cost-stats";
var zh = {
  "balance.amount": "\xA5{amount}",
  "balance.account": "\u4F59\u989D \xA5{amount}",
  "balance.sessionCost": "\u4F1A\u8BDD\u8D39 \xA5{amount}",
  "balance.sessionCostEst": "\u4F1A\u8BDD\u8D39(\u4F30) \xA5{amount}",
  "balance.period.peak": "\u9AD8\u5CF0",
  "balance.period.offpeak": "\u4F4E\u8C37",
  "balance.dialog.title": "\u8D26\u6237\u4E0E\u8D39\u7528",
  "balance.dialog.period": "\u8BA1\u4EF7\u65F6\u6BB5",
  "balance.dialog.account": "\u8D26\u6237\u4F59\u989D",
  "balance.dialog.sessionCost": "\u672C\u4F1A\u8BDD\u8D39\u7528",
  "balance.dialog.cacheRead": "\u8F93\u5165\uFF08\u7F13\u5B58\u547D\u4E2D\uFF09",
  "balance.dialog.uncachedInput": "\u8F93\u5165\uFF08\u7F13\u5B58\u672A\u547D\u4E2D\uFF09",
  "balance.dialog.output": "\u8F93\u51FA",
  "balance.dialog.webSearch": "\u7F51\u9875\u641C\u7D22\uFF08{count} \u6B21\uFF09",
  "balance.dialog.webFetch": "\u7F51\u9875\u6293\u53D6\uFF08{count} \u6B21\uFF09",
  "balance.dialog.webFree": "\u514D\u8D39",
  "balance.dialog.subagents": "\u5B50\u4EE3\u7406\uFF08{count} \u4E2A\u4F1A\u8BDD\uFF09",
  "balance.dialog.subagentName": "\u5B50\u4EE3\u7406",
  "balance.dialog.subagentToken": "Token",
  "balance.dialog.subagentWeb": "\u7F51\u9875",
  "balance.dialog.subagentTotal": "\u5408\u8BA1",
  "balance.dialog.subagentRequests": "{count} \u6B21\u8BF7\u6C42",
  "balance.dialog.subagentSearch": "\u641C\u7D22 {count}",
  "balance.dialog.subagentFetch": "\u6293\u53D6 {count}",
  "balance.dialog.models": "\u5404\u6A21\u578B\uFF08\u672C\u4F1A\u8BDD\uFF09",
  "balance.dialog.modelsWithSubagents": "\u5404\u6A21\u578B\uFF08\u672C\u4F1A\u8BDD + \u5B50\u4EE3\u7406\uFF09"
};
var en = {
  "balance.amount": "\xA5{amount}",
  "balance.account": "Bal \xA5{amount}",
  "balance.sessionCost": "Cost \xA5{amount}",
  "balance.sessionCostEst": "Cost(est) \xA5{amount}",
  "balance.period.peak": "Peak",
  "balance.period.offpeak": "Off-peak",
  "balance.dialog.title": "Account & cost",
  "balance.dialog.period": "Billing period",
  "balance.dialog.account": "Account balance",
  "balance.dialog.sessionCost": "This session",
  "balance.dialog.cacheRead": "Input (cache hit)",
  "balance.dialog.uncachedInput": "Input (cache miss)",
  "balance.dialog.output": "Output",
  "balance.dialog.webSearch": "Web search ({count})",
  "balance.dialog.webFetch": "Web fetch ({count})",
  "balance.dialog.webFree": "Free",
  "balance.dialog.subagents": "Subagents ({count})",
  "balance.dialog.subagentName": "Subagent",
  "balance.dialog.subagentToken": "Token",
  "balance.dialog.subagentWeb": "Web",
  "balance.dialog.subagentTotal": "Total",
  "balance.dialog.subagentRequests": "{count} req",
  "balance.dialog.subagentSearch": "search {count}",
  "balance.dialog.subagentFetch": "fetch {count}",
  "balance.dialog.models": "By model (this session)",
  "balance.dialog.modelsWithSubagents": "By model (session + subagents)"
};

// ../dsh-cost-stats/src/client/index.ts
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "cost-stats: dictionaries");
  ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
    name: "conversation.composer.dock",
    id: "cost-stats",
    order: 2,
    locale: NS
  }, BalancePill));
}

		return module.exports;
	}
});
