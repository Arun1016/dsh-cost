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
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
/** Full props the composer dock delivers: the derived runtime and locale shares. */
export type BalancePillProps = PropsRuntime<'conversation.composer.dock'> & PropsLocale<typeof NS>;
export declare const BalancePill: import("react").MemoExoticComponent<({ useProjection, sessionId, t }: BalancePillProps) => import("react").JSX.Element | null>;
//# sourceMappingURL=BalancePill.d.ts.map