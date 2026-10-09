/**
 * Locale dictionaries of the cost-statistics pill. Keys mirror the pill's
 * three readings (billing period, account balance, session cost) and the
 * dialog's breakdown rows.
 * @module dsh-cost/client/locales
 */
/** Dictionary namespace owned by this plugin. */
export const NS = 'cost-stats';
/** Simplified Chinese dictionary. */
export const zh = {
    'balance.amount': '¥{amount}',
    'balance.account': '余额 ¥{amount}',
    'balance.sessionCost': '会话费 ¥{amount}',
    'balance.sessionCostEst': '会话费(估) ¥{amount}',
    'balance.period.peak': '高峰',
    'balance.period.offpeak': '低谷',
    'balance.dialog.title': '账户与费用',
    'balance.dialog.period': '计价时段',
    'balance.dialog.account': '账户余额',
    'balance.dialog.sessionCost': '本会话费用',
    'balance.dialog.cacheRead': '输入（缓存命中）',
    'balance.dialog.uncachedInput': '输入（缓存未命中）',
    'balance.dialog.output': '输出',
    'balance.dialog.models': '各模型（本会话）',
};
/** English dictionary. */
export const en = {
    'balance.amount': '¥{amount}',
    'balance.account': 'Bal ¥{amount}',
    'balance.sessionCost': 'Cost ¥{amount}',
    'balance.sessionCostEst': 'Cost(est) ¥{amount}',
    'balance.period.peak': 'Peak',
    'balance.period.offpeak': 'Off-peak',
    'balance.dialog.title': 'Account & cost',
    'balance.dialog.period': 'Billing period',
    'balance.dialog.account': 'Account balance',
    'balance.dialog.sessionCost': 'This session',
    'balance.dialog.cacheRead': 'Input (cache hit)',
    'balance.dialog.uncachedInput': 'Input (cache miss)',
    'balance.dialog.output': 'Output',
    'balance.dialog.models': 'By model (this session)',
};
//# sourceMappingURL=locales.js.map