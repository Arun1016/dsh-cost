/**
 * Locale dictionaries of the cost-statistics pill. Keys mirror the pill's
 * three readings (billing period, account balance, session cost) and the
 * dialog's breakdown rows.
 * @module dsh-cost/client/locales
 */
/** Dictionary namespace owned by this plugin. */
export declare const NS = "cost-stats";
/** Simplified Chinese dictionary. */
export declare const zh: {
    'balance.amount': string;
    'balance.account': string;
    'balance.sessionCost': string;
    'balance.sessionCostEst': string;
    'balance.period.peak': string;
    'balance.period.offpeak': string;
    'balance.dialog.title': string;
    'balance.dialog.period': string;
    'balance.dialog.account': string;
    'balance.dialog.sessionCost': string;
    'balance.dialog.cacheRead': string;
    'balance.dialog.uncachedInput': string;
    'balance.dialog.output': string;
    'balance.dialog.models': string;
};
/** English dictionary. */
export declare const en: {
    'balance.amount': string;
    'balance.account': string;
    'balance.sessionCost': string;
    'balance.sessionCostEst': string;
    'balance.period.peak': string;
    'balance.period.offpeak': string;
    'balance.dialog.title': string;
    'balance.dialog.period': string;
    'balance.dialog.account': string;
    'balance.dialog.sessionCost': string;
    'balance.dialog.cacheRead': string;
    'balance.dialog.uncachedInput': string;
    'balance.dialog.output': string;
    'balance.dialog.models': string;
};
/** Every dictionary key this plugin owns. */
export type CostStatsKey = keyof typeof zh;
//# sourceMappingURL=locales.d.ts.map