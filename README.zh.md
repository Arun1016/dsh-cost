# dsh-cost

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) Web 界面的**实时账户余额 + 会话费用**胶囊。它在输入框上方、官方时间与 token 两颗胶囊的同一行多显示一颗：计费时段圆点 · 余额 · 会话费用，点开可看明细。

> 社区插件，与 DeepSeek 官方无隶属关系，也不由官方随包分发。

## 功能

- **胶囊**：注册在 `conversation.composer.dock` 槽位（`id: cost-stats`、`order: 1`），与官方胶囊同排。
- **弹窗明细**：计费时段、账户余额、本次会话费用，用量按「缓存命中输入 / 未命中输入 / 输出」拆分，并给出逐模型明细。
- **与官方一致的口径**：含 2026-09-10 降价与 pro→flash 路由；跨越降价、路由切换或高峰边界的会话按请求逐一折算，不会混用两套价目。
- **没有 API key 也能用**：价格与会话费用照常显示，只隐藏余额部分。
- **不保存凭据**：API key 通过 dsh 的 credentials seam 解析，只在进程内使用。
- 定位与关闭行为复用官方 `ui-primitives` 的 `useAnchoredPosition`、`useDismissOnOutsidePointer`。

## 运行要求

- DeepSeek Harness (dsh) `>= 0.2.0-rc.2`。
- 想在胶囊里看到**实时余额**，需要一个 DeepSeek **API key**（`DEEPSEEK_API_KEY`，或通过 dsh credentials 配置）。用 DeepSeek **账户登录**（而非 API key）时只能看到费用部分。

## 安装

在插件市场搜索 `dsh-cost` 一键安装，或命令行：

```sh
dsh plugin --profile <profile> add github:Arun1016/dsh-cost
```

> **请用上面这条 `github:` 来源安装。** npm 上另有一个同名 `dsh-cost` 包（他人所写、与本插件无关），`dsh plugin add dsh-cost` 装到的会是那一个。

## 配置

```yaml
- id: cost-stats
  name: dsh-cost
  config:
    holidays: ['2026-01-01']   # 法定节假日全天按空闲计价
```

`holidays` 默认为内建的 2026 年法定节假日表（来源：国办发明电〔2025〕7 号）。跨年只需改配置，不必改代码。

## 计费口径

| 项 | 口径 |
|---|---|
| Flash（2026-09-10 12:00 起） | 高峰 `2 / 0.04 / 8` 元每百万 token，空闲为高峰一半 |
| Flash（降价前） | `3.0 / 0.1 / 9.0` |
| Pro | `9.0 / 0.3 / 27.0` |
| 高峰 | 工作日 `9:00–12:00`、`14:00–18:00` |
| 空闲 | 其余时间；周末与法定节假日全天 |
| pro→flash 路由 | 2026-09-14 12:00 起按 Flash 计价 |
| `inputTokens` | 指未命中输入；缓存写入也按未命中价计费 |
| reasoning | 属于输出子集，不另计 |

## 隐私

- 无遥测、无统计、不访问第三方接口。
- 唯一的外部请求是 `https://api.deepseek.com/user/balance`，用你的 key 认证。
- 本插件不把 key 写入磁盘；余额在内存中缓存 30 秒。

## 已知限制

- 冷会话花费是估算（界面标 `(估)`），等 settled 用量出现后才精确。
- 按请求累加，与账户账单可能存在分位舍入差。
- 事件里缺少 model source 或 usage 时跳过计价。
- 刚充值后余额可能滞后最多 30 秒。
- 内建节假日表只覆盖 2026 年。

## 开发

源码在 `src/`（宿主半边 `index.ts`，客户端半边 `client/`），沿用官方 monorepo 工具链构建（`tsc -b` 出类型，`tsdown` 出客户端包）。发布包只含 `lib/` 与 `cordis.patch.yml`。

## 许可证

MIT，见 [LICENSE](LICENSE)。
