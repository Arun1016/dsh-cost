/**
 * Cost-statistics browser half: the dictionaries plus the composer-dock pill.
 * The pill arrives as one more entry in the dock's centered flex row, so it
 * sits beside the official time and token pills with the same metrics.
 * @module dsh-cost/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer-owned slots service.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session standard useProjection seat.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the Conversation service and the composer-dock slot.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: the tokenUsage projection key merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
// Type-only: the sessionStats projection key merge.
import type {} from '@deepseek-ai/dsh-session-stats/client'
import { BalancePill } from './BalancePill.tsx'
import { en, NS, zh, type CostStatsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Cost-statistics pill and dialog copy. */
    'cost-stats': CostStatsKey
  }
}

/** Required services: the slot registry and the dictionaries. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries and the dock pill.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'cost-stats: dictionaries')

  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'cost-stats',
    order: 1,
    locale: NS,
  }, BalancePill))
}
