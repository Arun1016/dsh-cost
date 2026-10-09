/**
 * Cost-statistics browser half: the dictionaries plus the composer-dock pill.
 * The pill arrives as one more entry in the dock's centered flex row, so it
 * sits beside the official time and token pills with the same metrics.
 * @module dsh-cost/client
 */
import { BalancePill } from "./BalancePill.js";
import { en, NS, zh } from "./locales.js";
/** Required services: the slot registry and the dictionaries. */
export const inject = ['slots', 'locale'];
/**
 * Client plugin body: register the dictionaries and the dock pill.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'cost-stats: dictionaries');
    ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
        name: 'conversation.composer.dock',
        id: 'cost-stats',
        order: 1,
        locale: NS,
    }, BalancePill));
}
//# sourceMappingURL=index.js.map