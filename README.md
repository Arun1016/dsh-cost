# dsh-cost

Real-time **account balance** and **per-session cost** pill for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web GUI. It adds one more pill next to the built-in clock and token pills above the composer — billing period dot · balance · session cost — and opens a breakdown when clicked.

> Community plugin. Not affiliated with, endorsed by, or shipped by DeepSeek.

## Features

- **Pill** in the `conversation.composer.dock` slot (`id: cost-stats`, `order: 1`), on the same row as the official clock and token pills.
- **Popup breakdown**: billing period, account balance, current session cost, usage split into cached input / uncached input / output, and per-model detail.
- **Official pricing**, including the 2026-09-10 price cut and the pro→flash routing. A session that spans a price change, a routing change or a peak boundary is folded per request, so two rate tables are never mixed.
- **Works without an API key**: prices and session cost still render; only the balance segment is hidden.
- **No credentials stored**: the key is resolved through dsh's credentials seam and used in-process only.
- Positioning and dismiss behaviour reuse the official `ui-primitives` helpers (`useAnchoredPosition`, `useDismissOnOutsidePointer`).

## Requirements

- DeepSeek Harness (dsh) `>= 0.2.0-rc.2`.
- A DeepSeek **API key** (`DEEPSEEK_API_KEY`, or configured through dsh credentials) if you want the live balance. Installs signed in with a DeepSeek *account* rather than an API key see the cost side only.

## Install

From the plugin market (search `dsh-cost`), or from a terminal:

```sh
dsh plugin --profile <profile> add dsh-cost
```

## Configuration

```yaml
- id: cost-stats
  name: dsh-cost
  config:
    holidays: ['2026-01-01']   # statutory holidays bill off-peak all day
```

`holidays` defaults to the built-in 2026 PRC statutory-holiday table (State Council notice 国办发明电〔2025〕7号). A new year is a Config edit, not a code change.

## Billing model

| Item | Rule |
|---|---|
| Flash (from 2026-09-10 12:00) | peak `2 / 0.04 / 8` CNY per M tokens; off-peak is half |
| Flash (before the price cut) | `3.0 / 0.1 / 9.0` |
| Pro | `9.0 / 0.3 / 27.0` |
| Peak | workdays `09:00–12:00` and `14:00–18:00` |
| Off-peak | everything else; weekends and statutory holidays all day |
| pro→flash routing | billed as Flash from 2026-09-14 12:00 |
| `inputTokens` | uncached input; cache writes bill at the uncached rate |
| reasoning | subset of output, not billed separately |

## Privacy

- No telemetry, no analytics, no third-party endpoints.
- The only outbound request is `https://api.deepseek.com/user/balance`, authenticated with your key.
- This plugin never writes the key to disk; balances are cached in memory for 30 s.

## Known limitations

- Cold-session cost is an estimate (marked `(估)`) until settled usage exists.
- Costs accumulate per request, so rounding may differ from the account ledger.
- Events without a model source or usage are skipped.
- Balance can lag up to 30 s behind a top-up.
- The built-in holiday table covers 2026.

## Development

Source lives in `src/` (host half `index.ts`, client half `client/`), built with the official dsh monorepo toolchain (`tsc -b` for types, `tsdown` for the client bundle). The published package ships only `lib/` and `cordis.patch.yml`.

## License

MIT — see [LICENSE](LICENSE).
