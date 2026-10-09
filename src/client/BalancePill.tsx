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

import { Fragment, memo, useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  IconDataOutlineRegular,
  useAnchoredPosition,
  useDismissOnOutsidePointer,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges the tokenUsage key into SessionProjectionMap for useProjection.
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
// Type-only: merges the sessionStats key into SessionProjectionMap for useProjection.
import type {} from '@deepseek-ai/dsh-session-stats/client'
import { NS } from './locales.ts'
import css from './BalancePill.module.css'

/** Full props the composer dock delivers: the derived runtime and locale shares. */
export type BalancePillProps = PropsRuntime<'conversation.composer.dock'> & PropsLocale<typeof NS>

/** Fallback unit prices (CNY per million tokens; flash peak from 2026-09-10). */
const FALLBACK_PRICES = { input: 2.0, cacheRead: 0.04, output: 8.0 }

/** Viewport margin the placement clamp keeps (mirrors the official panel). */
const PANEL_MARGIN = 12

/** Distance between the trigger's top edge and the panel's bottom. */
const PANEL_GAP = 8

/** Unplaced portal panel: hidden but laid out so the clamp measures it. */
const MEASURE_STYLE: CSSProperties = { visibility: 'hidden', left: 0, top: 0 }

/** The three billed buckets in CNY. */
interface CostBuckets {
  cacheRead: number
  uncachedInput: number
  output: number
}

/** One model's share of this session's cost. */
interface ModelCost {
  model: string
  total: number
}

/** The fields this pill reads from `/api/dsh-balance`. */
interface BalanceState {
  /** Account balance as the API reported it. */
  total?: string
  /** Any failure hides the whole segment. */
  error?: string
  /** Unit prices in effect now. */
  prices?: { input: number; cacheRead: number; output: number }
  /** Billing period in effect now. */
  period?: 'peak' | 'off-peak'
  /** Host-folded session cost in CNY. */
  sessionCost?: number
  /** Host-folded bucket split; a local estimate fills it when absent. */
  buckets?: CostBuckets
  /** Per-model cost, most expensive first; empty for a cold session. */
  models?: ModelCost[]
}

/**
 * Session cost in CNY from the token-usage projection at the given rates.
 * @param usage - the session's token-usage projection value.
 * @param prices - the rates in effect; the flash fallback applies when absent.
 * @returns the estimated cost in CNY.
 */
function sessionCost(
  usage: TokenUsageProjection | undefined,
  prices: { input: number; cacheRead: number; output: number } = FALLBACK_PRICES,
): number {
  if (usage === undefined) return 0
  return (
    usage.uncachedInputTokens * prices.input
    + usage.cacheReadTokens * prices.cacheRead
    + usage.cacheWriteTokens * prices.input // cache writes bill at the miss rate
    + usage.outputTokens * prices.output
  ) / 1_000_000
}

/**
 * The local bucket estimate, matching `sessionCost` (cache writes join
 * uncached input).
 * @param usage - the session's token-usage projection value.
 * @param prices - the rates in effect.
 * @returns the three bucket costs in CNY; all zero without usage.
 */
function bucketCost(
  usage: TokenUsageProjection | undefined,
  prices: { input: number; cacheRead: number; output: number },
): CostBuckets {
  if (usage === undefined) return { cacheRead: 0, uncachedInput: 0, output: 0 }
  return {
    cacheRead: usage.cacheReadTokens * prices.cacheRead / 1_000_000,
    uncachedInput: (usage.uncachedInputTokens + usage.cacheWriteTokens) * prices.input / 1_000_000,
    output: usage.outputTokens * prices.output / 1_000_000,
  }
}

/**
 * Format an amount: four decimals below one cent, two otherwise.
 * @param yuan - the amount in CNY.
 * @returns the display string.
 */
function formatAmount(yuan: number): string {
  if (yuan > 0 && yuan < 0.01) return yuan.toFixed(4)
  return yuan.toFixed(2)
}

export const BalancePill = memo(function BalancePill({ useProjection, sessionId, t }: BalancePillProps) {
  const usage = useProjection('tokenUsage')
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Placement and dismissal follow the official stat pills' seat.
  const pos = useAnchoredPosition({
    open,
    anchorRef: rootRef,
    panelRef,
    side: 'top',
    gap: PANEL_GAP,
    margin: PANEL_MARGIN,
  })
  useDismissOnOutsidePointer(rootRef, open, setOpen, panelRef)
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown) }
  }, [open])

  // Each step is the cheapest signal that another request happened; the host
  // folds by each event's own timestamp, so the reading keeps up with the
  // conversation instead of waiting for the fallback poll.
  const steps = useProjection('sessionStats')?.steps ?? 0
  const [balance, setBalance] = useState<BalanceState>({})
  useEffect(() => {
    let alive = true
    const query = sessionId === undefined ? '' : `?sessionId=${encodeURIComponent(sessionId)}`
    const load = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/dsh-balance${query}`)
        const data = await res.json() as {
          error?: unknown
          balance_infos?: { total_balance?: unknown }[]
          prices?: { input?: unknown; cacheRead?: unknown; output?: unknown; period?: unknown }
          sessionCost?: {
            total?: unknown
            buckets?: { cacheRead?: unknown; uncachedInput?: unknown; output?: unknown }
            models?: { model?: unknown; total?: unknown }[]
          }
        }
        if (!alive) return
        if (data.error !== undefined) {
          setBalance({ error: String(data.error) })
          return
        }
        const info = data.balance_infos?.[0]
        const rawTotal = data.sessionCost?.total
        const parsedPrices = data.prices === undefined ? undefined : {
          input: Number(data.prices.input),
          cacheRead: Number(data.prices.cacheRead),
          output: Number(data.prices.output),
        }
        const parsedPeriod = typeof data.prices?.period === 'string'
          ? data.prices.period as 'peak' | 'off-peak'
          : undefined
        const rawBuckets = data.sessionCost?.buckets
        const parsedBuckets = rawBuckets === undefined ? undefined : {
          cacheRead: Number(rawBuckets.cacheRead),
          uncachedInput: Number(rawBuckets.uncachedInput),
          output: Number(rawBuckets.output),
        }
        const parsedModels = Array.isArray(data.sessionCost?.models)
          ? data.sessionCost.models.flatMap(row => (
            typeof row?.model === 'string' && typeof row.total === 'number'
              ? [{ model: row.model, total: row.total }]
              : []
          ))
          : undefined
        setBalance({
          ...(info === undefined ? {} : { total: String(info.total_balance) }),
          ...(parsedPrices === undefined ? {} : { prices: parsedPrices }),
          ...(parsedPeriod === undefined ? {} : { period: parsedPeriod }),
          ...(typeof rawTotal === 'number' && Number.isFinite(rawTotal)
            ? { sessionCost: rawTotal }
            : {}),
          ...(parsedBuckets === undefined ? {} : { buckets: parsedBuckets }),
          ...(parsedModels === undefined ? {} : { models: parsedModels }),
        })
      } catch (error) {
        if (alive) setBalance({ error: String(error) })
      }
    }
    void load()
    // Fallback poll: the balance and the billing period move on their own
    // (entering a peak window), independent of session steps.
    const timer = window.setInterval(() => { void load() }, 60_000)
    return () => { alive = false; window.clearInterval(timer) }
    // A route that is unavailable (a host without this plugin's row) retries
    // only on the fallback poll instead of once per conversation step.
  }, [sessionId, balance.error === undefined ? steps : -1])

  // The period comes with the prices: without them there is no reading to show.
  if (balance.error !== undefined || balance.prices === undefined) return null

  const peak = balance.period === 'peak'
  const periodText = balance.period === undefined
    ? null
    : (peak ? t('balance.period.peak') : t('balance.period.offpeak'))
  const balanceText = balance.total === undefined
    ? null
    : t('balance.account', { amount: Number(balance.total).toFixed(2) })
  const exact = balance.sessionCost
  // Host-folded cost first; a session the host cannot see is estimated locally
  // at the rates the route reported.
  const cost = exact ?? sessionCost(usage, balance.prices)
  const costText = cost > 0
    ? (exact !== undefined
      ? t('balance.sessionCost', { amount: formatAmount(cost) })
      : t('balance.sessionCostEst', { amount: formatAmount(cost) }))
    : null
  if (periodText === null && balanceText === null && costText === null) return null

  const buckets = balance.buckets ?? bucketCost(usage, balance.prices)
  const models = balance.models ?? []
  const amount = (yuan: number): string => t('balance.amount', { amount: formatAmount(yuan) })
  const separator = <span className={css.sep} aria-hidden>·</span>
  const labelText = [periodText, balanceText, costText].filter(part => part !== null).join(' · ')

  return (
    <span ref={rootRef} className={css.anchor}>
      <button
        type="button"
        className={css.pill}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={labelText}
        onClick={() => { setOpen(!open) }}
      >
        <IconDataOutlineRegular />
        <span className={css.label}>
          {periodText !== null && (
            <span className={css.period}>
              {/* Peak costs more (red), off-peak less (green). */}
              <span className={peak ? `${css.periodDot} ${css.peak}` : css.periodDot} aria-hidden />
              {periodText}
            </span>
          )}
          {periodText !== null && balanceText !== null && separator}
          {balanceText}
          {balanceText !== null && costText !== null && separator}
          {costText}
        </span>
      </button>
      {createPortal(
        open && (
          <div
            ref={panelRef}
            className={css.panel}
            role="dialog"
            aria-label={t('balance.dialog.title')}
            style={pos ?? MEASURE_STYLE}
          >
            <div className={css.title}>
              <span className={css.titleLabel}>
                <IconDataOutlineRegular />
                {t('balance.dialog.title')}
              </span>
            </div>
            <div className={css.titleRule} aria-hidden />
            <dl className={css.details} data-session-balance>
              {periodText !== null && (
                <>
                  <dt>{t('balance.dialog.period')}</dt>
                  <dd>{periodText}</dd>
                </>
              )}
              {balanceText !== null && (
                <>
                  <dt>{t('balance.dialog.account')}</dt>
                  <dd>{balanceText}</dd>
                </>
              )}
              {costText !== null && (
                <>
                  <dt>{t('balance.dialog.sessionCost')}</dt>
                  <dd>{costText}</dd>
                </>
              )}
              {costText !== null && (
                <>
                  <dt>{t('balance.dialog.cacheRead')}</dt>
                  <dd>{amount(buckets.cacheRead)}</dd>
                  <dt>{t('balance.dialog.uncachedInput')}</dt>
                  <dd>{amount(buckets.uncachedInput)}</dd>
                  <dt>{t('balance.dialog.output')}</dt>
                  <dd>{amount(buckets.output)}</dd>
                </>
              )}
            </dl>
            {models.length > 0 && (
              <>
                <div className={css.titleRule} aria-hidden />
                <div className={css.modelsTitle}>{t('balance.dialog.models')}</div>
                <dl className={css.details} data-session-balance-models>
                  {models.map(row => (
                    <Fragment key={row.model}>
                      <dt className={css.route}>{row.model}</dt>
                      <dd>{amount(row.total)}</dd>
                    </Fragment>
                  ))}
                </dl>
              </>
            )}
          </div>
        ),
        document.body,
      )}
    </span>
  )
})
