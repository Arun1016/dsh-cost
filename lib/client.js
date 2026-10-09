window.__ModuleLoader__.load({
	id: "dsh-cost",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:C:\Program Files\DSH\packages\experimental\dsh-cost-stats\src\client\BalancePill.module.css.mjs
		const css = ".ZG4e9a_anchor{min-width:0;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));display:inline-flex}.ZG4e9a_pill{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;cursor:pointer;background:0 0;border:none;border-radius:24px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}.ZG4e9a_pill svg{flex:none;width:14px;height:14px}.ZG4e9a_pill:hover,.ZG4e9a_pill[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.ZG4e9a_label{text-overflow:ellipsis;min-width:0;overflow:hidden}.ZG4e9a_period{display:inline}.ZG4e9a_periodDot{vertical-align:-.17em;background:var(--dsw-alias-state-success-primary);border-radius:50%;width:1em;height:1em;margin-right:.12em;display:inline-block}.ZG4e9a_peak{background:var(--dsw-alias-state-error-primary)}.ZG4e9a_sep{color:var(--dsw-alias-separator-primary);margin:0 2px}.ZG4e9a_modelsTitle{color:var(--dsw-alias-label-secondary);margin-bottom:8px;font-weight:500}.ZG4e9a_panel{z-index:1100;box-sizing:border-box;background:var(--dsw-specific-menu);width:max-content;min-width:min(300px,100vw - 24px);max-width:min(440px,100vw - 24px);backdrop-filter:var(--dsw-menu-backdrop-filter);--dsw-elevation-stroke-color:var(--dsw-alias-border-l1);box-shadow:var(--dsw-elevation-prominent);color:var(--dsw-alias-label-secondary);cursor:default;border:0;border-radius:12px;padding:16px;font-size:12px;line-height:18px;position:fixed}.ZG4e9a_title{color:var(--dsw-alias-label-primary);justify-content:space-between;gap:16px;margin-bottom:8px;font-weight:500;display:flex}.ZG4e9a_titleLabel{align-items:center;gap:6px;min-width:0;display:inline-flex}.ZG4e9a_titleLabel svg{flex:none;width:14px;height:14px}.ZG4e9a_titleRule{border-top:.5px solid var(--dsw-alias-border-l2);margin-bottom:10px}.ZG4e9a_details{color:var(--dsw-alias-label-tertiary);grid-template-columns:minmax(76px,auto) minmax(0,1fr);gap:6px 16px;margin:0;display:grid}.ZG4e9a_details dt,.ZG4e9a_details dd{min-width:0;margin:0}.ZG4e9a_details dd{color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;text-align:right}.ZG4e9a_details .ZG4e9a_route{overflow-wrap:anywhere}";
		const tagId = "dsh-cost/BalancePill.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cost";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var BalancePill_module_css_default = {
			"anchor": "ZG4e9a_anchor",
			"details": "ZG4e9a_details",
			"label": "ZG4e9a_label",
			"modelsTitle": "ZG4e9a_modelsTitle",
			"panel": "ZG4e9a_panel",
			"peak": "ZG4e9a_peak",
			"period": "ZG4e9a_period",
			"periodDot": "ZG4e9a_periodDot",
			"pill": "ZG4e9a_pill",
			"route": "ZG4e9a_route",
			"sep": "ZG4e9a_sep",
			"title": "ZG4e9a_title",
			"titleLabel": "ZG4e9a_titleLabel",
			"titleRule": "ZG4e9a_titleRule"
		};
		//#endregion
		//#region src/client/BalancePill.tsx
		/**
		* Account-balance and session-cost pill: the composer dock's third reading
		* beside the official time and token pills. It polls the owning host route
		* (`/api/dsh-balance`) for the account balance, the billing period in effect,
		* and the session cost the host folded per request; when that route is
		* unavailable the pill hides rather than showing a figure it cannot justify,
		* and when the session is not attached it falls back to a local estimate over
		* the token-usage projection, marked "(est)".
		*
		* The dialog reuses the ui-primitives anchoring and outside-dismiss helpers the
		* official stat pills use, so its placement and dismissal match them; it cannot
		* share their exclusive-open state, which lives inside ui-chat.
		* @module dsh-cost/client/BalancePill
		*/
		/** Fallback unit prices (CNY per million tokens; flash peak from 2026-09-10). */
		const FALLBACK_PRICES = {
			input: 2,
			cacheRead: .04,
			output: 8
		};
		/** Viewport margin the placement clamp keeps (mirrors the official panel). */
		const PANEL_MARGIN = 12;
		/** Distance between the trigger's top edge and the panel's bottom. */
		const PANEL_GAP = 8;
		/** Unplaced portal panel: hidden but laid out so the clamp measures it. */
		const MEASURE_STYLE = {
			visibility: "hidden",
			left: 0,
			top: 0
		};
		/**
		* Session cost in CNY from the token-usage projection at the given rates.
		* @param usage - the session's token-usage projection value.
		* @param prices - the rates in effect; the flash fallback applies when absent.
		* @returns the estimated cost in CNY.
		*/
		function sessionCost(usage, prices = FALLBACK_PRICES) {
			if (usage === void 0) return 0;
			return (usage.uncachedInputTokens * prices.input + usage.cacheReadTokens * prices.cacheRead + usage.cacheWriteTokens * prices.input + usage.outputTokens * prices.output) / 1e6;
		}
		/**
		* The local bucket estimate, matching `sessionCost` (cache writes join
		* uncached input).
		* @param usage - the session's token-usage projection value.
		* @param prices - the rates in effect.
		* @returns the three bucket costs in CNY; all zero without usage.
		*/
		function bucketCost(usage, prices) {
			if (usage === void 0) return {
				cacheRead: 0,
				uncachedInput: 0,
				output: 0
			};
			return {
				cacheRead: usage.cacheReadTokens * prices.cacheRead / 1e6,
				uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1e6,
				output: usage.outputTokens * prices.output / 1e6
			};
		}
		/**
		* Format an amount: four decimals below one cent, two otherwise.
		* @param yuan - the amount in CNY.
		* @returns the display string.
		*/
		function formatAmount(yuan) {
			if (yuan > 0 && yuan < .01) return yuan.toFixed(4);
			return yuan.toFixed(2);
		}
		const BalancePill = (0, react.memo)(function BalancePill({ useProjection, sessionId, t }) {
			const usage = useProjection("tokenUsage");
			const [open, setOpen] = (0, react.useState)(false);
			const rootRef = (0, react.useRef)(null);
			const panelRef = (0, react.useRef)(null);
			const pos = (0, _deepseek_ai_dsh_client_ui_primitives.useAnchoredPosition)({
				open,
				anchorRef: rootRef,
				panelRef,
				side: "top",
				gap: PANEL_GAP,
				margin: PANEL_MARGIN
			});
			(0, _deepseek_ai_dsh_client_ui_primitives.useDismissOnOutsidePointer)(rootRef, open, setOpen, panelRef);
			(0, react.useEffect)(() => {
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
			const [balance, setBalance] = (0, react.useState)({});
			(0, react.useEffect)(() => {
				let alive = true;
				const query = sessionId === void 0 ? "" : `?sessionId=${encodeURIComponent(sessionId)}`;
				const load = async () => {
					try {
						const data = await (await fetch(`/api/dsh-balance${query}`)).json();
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
						const parsedModels = Array.isArray(data.sessionCost?.models) ? data.sessionCost.models.flatMap((row) => typeof row?.model === "string" && typeof row.total === "number" ? [{
							model: row.model,
							total: row.total
						}] : []) : void 0;
						setBalance({
							...info === void 0 ? {} : { total: String(info.total_balance) },
							...parsedPrices === void 0 ? {} : { prices: parsedPrices },
							...parsedPeriod === void 0 ? {} : { period: parsedPeriod },
							...typeof rawTotal === "number" && Number.isFinite(rawTotal) ? { sessionCost: rawTotal } : {},
							...parsedBuckets === void 0 ? {} : { buckets: parsedBuckets },
							...parsedModels === void 0 ? {} : { models: parsedModels }
						});
					} catch (error) {
						if (alive) setBalance({ error: String(error) });
					}
				};
				load();
				const timer = window.setInterval(() => {
					load();
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
			const costText = cost > 0 ? exact !== void 0 ? t("balance.sessionCost", { amount: formatAmount(cost) }) : t("balance.sessionCostEst", { amount: formatAmount(cost) }) : null;
			if (periodText === null && balanceText === null && costText === null) return null;
			const buckets = balance.buckets ?? bucketCost(usage, balance.prices);
			const models = balance.models ?? [];
			const amount = (yuan) => t("balance.amount", { amount: formatAmount(yuan) });
			const separator = /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
				className: BalancePill_module_css_default.sep,
				"aria-hidden": true,
				children: "·"
			});
			const labelText = [
				periodText,
				balanceText,
				costText
			].filter((part) => part !== null).join(" · ");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				ref: rootRef,
				className: BalancePill_module_css_default.anchor,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: BalancePill_module_css_default.pill,
					"aria-haspopup": "dialog",
					"aria-expanded": open,
					"aria-label": labelText,
					onClick: () => {
						setOpen(!open);
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineRegular, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
						className: BalancePill_module_css_default.label,
						children: [
							periodText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: BalancePill_module_css_default.period,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: peak ? `${BalancePill_module_css_default.periodDot} ${BalancePill_module_css_default.peak}` : BalancePill_module_css_default.periodDot,
									"aria-hidden": true
								}), periodText]
							}),
							periodText !== null && balanceText !== null && separator,
							balanceText,
							balanceText !== null && costText !== null && separator,
							costText
						]
					})]
				}), (0, react_dom.createPortal)(open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: panelRef,
					className: BalancePill_module_css_default.panel,
					role: "dialog",
					"aria-label": t("balance.dialog.title"),
					style: pos ?? MEASURE_STYLE,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: BalancePill_module_css_default.title,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
								className: BalancePill_module_css_default.titleLabel,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconDataOutlineRegular, {}), t("balance.dialog.title")]
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: BalancePill_module_css_default.titleRule,
							"aria-hidden": true
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", {
							className: BalancePill_module_css_default.details,
							"data-session-balance": true,
							children: [
								periodText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("balance.dialog.period") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: periodText })] }),
								balanceText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("balance.dialog.account") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: balanceText })] }),
								costText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("balance.dialog.sessionCost") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: costText })] }),
								costText !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("balance.dialog.cacheRead") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: amount(buckets.cacheRead) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("balance.dialog.uncachedInput") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: amount(buckets.uncachedInput) }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("balance.dialog.output") }),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: amount(buckets.output) })
								] })
							]
						}),
						models.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: BalancePill_module_css_default.titleRule,
								"aria-hidden": true
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: BalancePill_module_css_default.modelsTitle,
								children: t("balance.dialog.models")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dl", {
								className: BalancePill_module_css_default.details,
								"data-session-balance-models": true,
								children: models.map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", {
									className: BalancePill_module_css_default.route,
									children: row.model
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: amount(row.total) })] }, row.model))
							})
						] })
					]
				}), document.body)]
			});
		});
		//#endregion
		//#region src/client/locales.ts
		/**
		* Locale dictionaries of the cost-statistics pill. Keys mirror the pill's
		* three readings (billing period, account balance, session cost) and the
		* dialog's breakdown rows.
		* @module dsh-cost/client/locales
		*/
		/** Dictionary namespace owned by this plugin. */
		const NS = "cost-stats";
		/** Simplified Chinese dictionary. */
		const zh = {
			"balance.amount": "¥{amount}",
			"balance.account": "余额 ¥{amount}",
			"balance.sessionCost": "会话费 ¥{amount}",
			"balance.sessionCostEst": "会话费(估) ¥{amount}",
			"balance.period.peak": "高峰",
			"balance.period.offpeak": "低谷",
			"balance.dialog.title": "账户与费用",
			"balance.dialog.period": "计价时段",
			"balance.dialog.account": "账户余额",
			"balance.dialog.sessionCost": "本会话费用",
			"balance.dialog.cacheRead": "输入（缓存命中）",
			"balance.dialog.uncachedInput": "输入（缓存未命中）",
			"balance.dialog.output": "输出",
			"balance.dialog.models": "各模型（本会话）"
		};
		/** English dictionary. */
		const en = {
			"balance.amount": "¥{amount}",
			"balance.account": "Bal ¥{amount}",
			"balance.sessionCost": "Cost ¥{amount}",
			"balance.sessionCostEst": "Cost(est) ¥{amount}",
			"balance.period.peak": "Peak",
			"balance.period.offpeak": "Off-peak",
			"balance.dialog.title": "Account & cost",
			"balance.dialog.period": "Billing period",
			"balance.dialog.account": "Account balance",
			"balance.dialog.sessionCost": "This session",
			"balance.dialog.cacheRead": "Input (cache hit)",
			"balance.dialog.uncachedInput": "Input (cache miss)",
			"balance.dialog.output": "Output",
			"balance.dialog.models": "By model (this session)"
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: the slot registry and the dictionaries. */
		const inject = ["slots", "locale"];
		/**
		* Client plugin body: register the dictionaries and the dock pill.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "cost-stats: dictionaries");
			ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "cost-stats",
				order: 1,
				locale: NS
			}, BalancePill));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map