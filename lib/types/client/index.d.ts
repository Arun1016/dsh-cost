/**
 * Cost-statistics browser half: the dictionaries plus the composer-dock pill.
 * The pill arrives as one more entry in the dock's centered flex row, so it
 * sits beside the official time and token pills with the same metrics.
 * @module dsh-cost/client
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type CostStatsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** Cost-statistics pill and dialog copy. */
        'cost-stats': CostStatsKey;
    }
}
/** Required services: the slot registry and the dictionaries. */
export declare const inject: string[];
/**
 * Client plugin body: register the dictionaries and the dock pill.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map