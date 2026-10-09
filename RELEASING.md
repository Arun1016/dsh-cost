# 发布到社区插件市场（操作清单）

本插件（`dsh-cost`）要进 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
精选列表，才可能被 dsh 的插件市场搜到并一键安装。市场**只允许安装该列表内的来源**。

本地这一步已经做完：仓库已 `git init` 并完成首次提交（`main` 分支，35 个文件）。

---

## 为什么用 GitHub 来源而不是 npm

npm 上已有一个**同名但无关**的 `dsh-cost@0.2.1`（作者 GiantGKL，2026-08-13 后未再更新）。
npm 包名全局唯一，我们不能再用这个名字发布，且直接写 `dsh plugin add dsh-cost`
会装到**那个人**的插件。因此本插件的正规安装来源是 GitHub 仓库：

```sh
dsh plugin --profile <profile> add github:Arun1016/dsh-cost
```

仓库内含预构建的 `lib/`，安装时不需要构建步骤（`package.json` 无 `scripts`）。

---

## 1. 创建 GitHub 仓库

在 <https://github.com/new> 新建：

- Owner: `Arun1016`
- Repository name: `dsh-cost`
- Public
- **不要**勾选 "Add a README file" / .gitignore / license（本地已有内容）

## 2. 推送本地提交

```sh
cd C:\Users\Administrator\.dsh\plugins\dsh-cost-stats
git remote add origin https://github.com/Arun1016/dsh-cost.git
git push -u origin main
```

（会弹出 Git Credential Manager 的 GitHub 授权窗口，用你的账号登录一次即可。）

## 3. 添加 `dsh-plugin` topic

仓库首页 → 右侧 About 旁的齿轮 → Topics 填 `dsh-plugin` → 保存。

这是收录的硬性要求之一（让其他人更容易找到你的插件）。

## 4. 创建 Release 并挂上预构建包

- 打 tag：`git tag v1.0.0 && git push origin v1.0.0`
- 在 GitHub 上以该 tag 创建 Release，标题 `v1.0.0`
- 上传仓库根目录的 `dsh-cost-1.0.0.tgz`（`npm pack` 的产物）
  - 市场条目里的 `tarball:` 字段指向它：`.../releases/download/v1.0.0/dsh-cost-1.0.0.tgz`
  - 没有 npm 包时，这是"预构建安装"的推荐做法

## 5. 满 1 天后提交收录 PR

收录 CI 会检查**仓库创建满 1 天**，所以建完仓库当天提交会被自动拒；隔一天再提。

1. Fork <https://github.com/awesome-dsh-plugin/awesome-dsh-plugin>
2. 在你的 fork 里新增**一个文件**：`data/plugins/Arun1016__dsh-cost.yml`
   - 内容就是本目录的 [`contrib/market-entry.yml`](contrib/market-entry.yml)
   - 注意 `description.en` 里含 `: `（冒号加空格），**必须加引号**，否则 YAML 解析失败
   - 不要手改 README（列表 README 由脚本从 `data/plugins/*.yml` 生成）
3. 提 PR（一个 PR 最多 3 条，我们只加 1 条）

## 6. 合并之后

- 站点与市场会读取 `https://awesome-dsh-plugin.com/plugins.json`，通常一天内生效
- 之后在 dsh 的插件市场里就能搜到 `dsh-cost`，一键安装

---

## 日常发版流程

1. 改 `package.json` 的 `version`
2. 如果有源码改动：同步重建 `lib/`（官方 monorepo 工具链：`tsc -b` + `tsdown`）
3. `git commit -am "..."` → `git push`
4. `npm pack` 并把新 tgz 上传到对应 tag 的 Release
5. 若 `tarball:` 指向带版本号的固定地址，记得同步更新市场条目（改 URL 后提 PR）

## 备注

- 收录评审会**实际阅读代码**并核对描述里的每个说法（数字、命令、API 名称）。描述不要夸大。
- 市场里 `usage` 分类已有 236 个插件，其中余额/费用类十几个；维护者会判断是否重复。
  本插件的差异化点：与官方计费口径一致的**逐请求折叠**（跨降价、跨 pro→flash 路由、跨高峰边界不混用价目）、内建法定节假日表、零凭据落盘。
- 本插件与 DeepSeek 官方无隶属关系。
