# dsh-plugin-master

[English](README.md) | 中文

[DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的 Web 插件管理面板:浏览已安装的插件、按包名/仓库/描述/Loader 条目 id 模糊搜索、启用/禁用/卸载,并把系统自带与用户安装的插件清晰分组。

本插件取代 DSH 自带的只读 `ui-settings-plugin-inventory` 标签页,提供更丰富的视图;bundle patch 会禁用官方插件列表标签页,由插件管理器取而代之。

![dsh-plugin-master 设置标签页](docs/screenshot.png)

## 功能

- 双层分组:系统插件在前、用户安装的插件在后;每层均可展开/折叠。
- 实时模糊搜索:范围覆盖包名、仓库 URL、首页、描述、作者、关键词,以及该包名下每个 Loader 条目的 entry id / config id / 模块名。
- 启用/禁用:可单独操作一个 Loader 条目,也可整包切换。目标状态持久化到 profile 的 `cordis.patch.yml`,运行期允许时立即生效;需要重启时会用**弹窗**明确提示,而不是一行没人注意的小字。
- 卸载用户插件:走 `dsh plugin --profile <name> remove <package>`,带二次确认对话框,卸载后校验包是否真的从 `node_modules` 移除。
- 依赖感知的禁用保护:禁用某个被其他已启用插件(客户端服务)依赖的包时会被拒绝,并弹出清晰说明(例如禁用 `dsh-better-sidebar` 时,`dsh-plugin-better-sidebar-plugin-office` 还依赖它)。
- 安装方式标签:区分 npm registry、本地链接、本地路径、Git 仓库、tarball、workspace。
- 受保护 ID(插件管理器自身、Loader 基建、runtime、webserver、api gateway、settings、client-runtime、locale、modules)无法在页面里被禁用;可通过宿主配置(`protectedEntries`)扩展。
- 双语界面(简体中文 + 英文)。

## 安装

插件管理器按标准 DSH 插件方式装入 `web` profile:

### 从本仓库安装(本地 checkout,无需发布)

```sh
git clone https://github.com/helloydh007/dsh-plugin-master.git
cd dsh-plugin-master
./install.sh          # POSIX
# 或 Windows:
# powershell -File install.ps1
```

`install.sh` 会把当前目录链接到 `~/.dsh/profiles/web/node_modules/`,并在 profile 的 `cordis.patch.yml` 中注册插件(幂等,可重复执行)。在 clone 目录内运行时不会下载任何内容。

### 从已发布的 tarball / npm(发布后)

```sh
dsh plugin --profile web add dsh-plugin-master
```

### 通过启动器从本地 checkout 安装

```sh
dsh plugin --profile web add link:/绝对路径/dsh-plugin-master
```

然后重启 Web UI(重启 `dsh web` 并硬刷新浏览器)。**设置 → 插件** 下会出现 "插件管理" 标签页,排在(已被禁用的) "插件列表" 之前。

## 卸载

```sh
# 如果是通过 npm / dsh plugin add 安装的:
dsh plugin --profile web remove dsh-plugin-master

# 如果是通过 install.sh / symlink 安装的:
rm ~/.dsh/profiles/web/node_modules/dsh-plugin-master
# 并移除安装器追加到以下文件的两行配置:
#   ~/.dsh/profiles/web/cordis.patch.yml
# (行首有 "#Managed by dsh-plugin-master." 注释标记)
```

然后重启 `dsh web`。移除禁用行后,官方插件列表标签页会自动恢复。

## 使用

打开 **设置 → 插件 → 插件管理**:

1. **搜索** — 在搜索框输入关键字;查询会被分词并与包名、仓库 slug、描述、条目 id 做模糊匹配。`vision toolkit` 能命中 `vision-toolkit`;`anionex` 能命中 `@anionex/...`;小拼写错误也能通过子序列匹配找到目标。
2. **启用/禁用** — 使用任意 Loader 条目行上的开关,或卡片底部的整包按钮。目标状态写入 `cordis.patch.yml`。
3. **卸载** — 用户安装包的卡片上有红色卸载按钮,在弹窗中确认。host 会调用 `dsh plugin remove`,然后校验包已从 `node_modules` 移除。

## 为什么之前搜不到 DSH Vision Toolkit(以及其它连字符命名的包)

DSH 自带的插件列表标签页只对 `moduleName` 和 `entryId` 做严格子串匹配。Vision Toolkit 注册为 `@anionex/dsh-vision-toolkit`(entry id `vision-toolkit`),搜索 "Vision Toolkit"(带空格与大小写)就会找不到。插件管理器:

1. 把查询按 `-_. /@:` 拆 token 再匹配,所以 `vision toolkit` 能命中 `vision-toolkit`、`dsh aqua` 能命中 `dsh-client-ui-aqua`、`anionex` 能命中 `@anionex/...`。
2. 把 `package.json` 的 `repository` 字段纳入可搜索范围,即使 loader id 与仓库无关,搜作者或仓库 slug 也能命中。
3. token 命中失败时退化到子序列匹配。

## 开发

```sh
pnpm install
pnpm typecheck
pnpm build              # 同时构建 lib/index.mjs 与 lib/client.cjs
pnpm build:host         # 仅 host 半区(esbuild)
pnpm build:client       # 仅浏览器半区(tsdown)
```

`lib/index.mjs` 是 host 半区(Cordis + Typert);`lib/client.cjs` 是浏览器半区(设置标签页 + Remote 面),已按 DSH 模块加载器格式包装。

## 配置

host 服务通过 profile 的 `cordis.patch.yml` 中 `plugin-master` 行接受少量配置,全部键均可选:

```yaml
- id: plugin-master
  name: dsh-plugin-master
  config:
    protectedEntries: [my-auth-provider]
    settleTimeoutMs: 8000
    uninstallTimeoutMs: 60000
```

- `protectedEntries` — 额外禁止禁用的 Loader 条目 id。
- `settleTimeoutMs` — 等待运行时反映一次切换的最长时长,超时则提示需要重启。
- `uninstallTimeoutMs` — `dsh plugin remove` 的进程超时。

## 安全

- host 只读 `cordis.patch.yml`,只写自己标记的 row,绝不触碰用户手写的内容。
- 卸载走 `dsh plugin --profile <name> remove`,由启动器调用 pnpm 并自动 reconcile bundles,绝不直接删除目录。
- 禁用被其他已启用插件依赖(客户端服务)的包会被拒绝,并用弹窗说明依赖链。
- 受保护 ID 防止页面把自己、Loader 基建、API 网关、Web 服务器、设置 shell 关掉。
- host 不做内存缓存;每次读都从 `loader.entries()` 与现场 `node_modules` 实时计算快照。

## 已知限制

- **系统判定是权威的,不是启发式的。** 只有解析到 DSH 真实安装根的 `@deepseek-ai/` scope 的包才算系统包。位于 profile `bundles` 列表或伪装 `@deepseek-ai/` scope 的包留在用户组 —— 这是有意为之。
- **批量操作只支持整包级别。** 暂无"一键启用/禁用所有用户插件"按钮。
- **卸载依赖 pnpm。** 若 host 上没有 `dsh` 启动器或 pnpm,卸载按钮会报失败,而不是冒险直接删目录。

## 许可证

MIT
