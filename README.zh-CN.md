# dsh-fs-browser

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4b32c3)](https://github.com/deepseek-ai/deepseek-harness)
[![npm](https://img.shields.io/npm/v/dsh-fs-browser?color=cb3837)](https://www.npmjs.com/package/dsh-fs-browser)

[English](README.md)

一个 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的开源插件：在工作区会话里嵌入**右侧文件浏览列**，与对话共用同一页面框架——边聊边看文件，文本带真正的语法高亮与行号，图片内嵌预览，并且**按工作区记住你上次打开的目录与展开状态**。

文件列是**嵌入布局的列**而非悬浮层：可向右折叠、可拖宽到视口一半、按工作区记忆状态（目录 + 展开/收起），跨会话、跨重启保持。

## 特性

- **与对话并排嵌入右列**——注册在布局的 `details` 座位；会话头部「📁 文件」开关、面板内 ⏴ 收起；拖动列边缘可加宽到视口一半（见[布局前提](#布局前提)）
- **Shiki 语法高亮**——与产品 read 卡片同引擎（同步 JS 正则引擎 + css-variables 主题）；已内置 23 种语法（ts/js/jsx、bash、json、python、yaml、sql、c/cpp、cs、java、go、rust、css、html/xml、markdown、ruby、perl、lua、elisp、haskell、julia、php、toml、ini）；未知/缺失语法自动降级到内置轻量分词器——绝不报错
- **行号 + 选中复制**——行号列不进入你的选区；预览区选中文本即浮出「📋」复制按钮（复制成功变「✓」），复制原文（不含行号）
- **双语界面**——全部文案随应用语言设置自动切换（中文 / English），无需重启
- **图片预览**——png/jpg/gif/webp/svg/bmp（≤2MB base64 回退，≤8MB 走同源 HTTP 路由）；二进制文件显示「类型 · 大小」提示而非报错（文件名保留在预览头）
- **按工作区记忆**——打开的目录与是否展开写入持久化 storage **域**（`~/.dsh/storages/fs_browser.json`，按 workspaceId 为键），进入对应工作区会话时自动恢复
- **跨平台路径**——Windows（`C:\…`）与 POSIX 路径均可正确导航；列目录容忍内核锁定文件（如 `C:\DumpStack.log`）
- **免构建分发**——浏览器半携带内联 Shiki 的预构建产物（`lib/client.js`）；Host 半是纯 JS，仅依赖 `storage-domain`（+ `zod`）

## 安装

### 方式 A：安装发布 tarball（推荐）

从 [releases 页面](https://github.com/revive/dsh-fs-browser/releases) 下载 `dsh-fs-browser-<version>.tgz`（tarball 自带构建好的浏览器包和 bundle 分层，无需 harness 检出或构建步骤），用 `dsh` CLI 装进 profile：

```sh
dsh plugin --profile <name> add ./dsh-fs-browser-<version>.tgz
```

本包是 dsh **bundle**：`dsh.bundle.patch` 指向内置的 `cordis.patch.yml`（负责插入插件行），`dsh.client` 注册浏览器半。不启动即可验证分层：

```sh
dsh --profile <name> --dump-config    # 查找 "# == dsh-fs-browser"
```

> 安装 bundle **不会**热挂载进正在运行的 GUI（bundle 分层在启动时组合，HMR 只热应用 patch 文件）：`dsh plugin add` 之后请重启 GUI。重启后会话头部出现「📁 文件」开关。

### 方式 A′：从 npm 直接安装

`dsh-fs-browser` 已[发布到 npm](https://www.npmjs.com/package/dsh-fs-browser) 后，`dsh` 会直接从 registry 解析该包——同样的 bundle 语义，无需下载 tarball：

```sh
dsh plugin --profile <name> add dsh-fs-browser
```

### 方式 B：从源码检出安装

插件的宿主依赖是零改动；唯一可选的 harness 侧改造是下一节的布局几何。`~/.dsh` 下两处即可：

1. 让每个 profile 都能解析到该包（运行时把 `~/.dsh/profiles/node_modules` 当作共享扁平回退）：

   ```sh
   cd ~/.dsh/profiles/web          # 或你当前使用的 profile
   pnpm add /path/to/dsh-fs-browser
   ```

2. 在用户层 `~/.dsh/cordis.patch.yml`（作用于所有 profile）加一行：

   ```yaml
   - insert:
       - id: dsh-fs-browser
         name: 'dsh-fs-browser'
   ```

重启 GUI（`pnpm dsh web --no-open`）并用新打印的 URL 打开。卸载 = 移除以上两处（`pnpm remove` + 删除那行）。

> 浏览器半（`lib/client.js`）是构建产物——克隆后请先构建（见[开发](#开发)）。发布 tarball 里已包含。

## 使用

点击会话头部「📁 文件」开关（或自动重开——面板记得是否展开）：

- **文件列表**——目录在前、点击进入、`..` 返回、显示大小；工作区由会话 cwd 推导（回退：包含该会话的工作区 → 第一个工作区）
- **预览**——点文件：文本在列表下方渲染（行号 + Shiki 高亮；拖动分隔条调整上下比例，默认列表占 1/3）；图片内嵌；超大文件显示大小提示，二进制文件显示「类型 · 大小」提示
- **复制**——预览区选中文本即浮出「复制」按钮，复制精确原文（不含行号）
- **宽度**——拖动列左缘（对话与文件列的交界，悬停出现小圆钮把手）可加宽到视口一半
- **记忆**——每次切目录/收起都会按工作区保存目录与展开状态；再进该工作区会话自动恢复

支持的文本语法（Shiki）：TypeScript/JS/JSX/TSX、Bash/Shell、JSON、Python、YAML、SQL、C/C++、C#、Java、Go、Rust、CSS、HTML/XML、Markdown、Ruby、Perl、Lua、Emacs Lisp、Haskell、Julia、PHP、TOML、INI。

## 布局前提

「拖宽到视口一半」依赖 harness 侧一处小几何改动（`@deepseek-ai/dsh-client-ui-layout` 的 `packages/client/ui-layout/src/client/columns.ts`）：

- 右侧列上限：`detailsMax(viewport) = max(520, floor(viewport/2))`（把 `computeColumns` 里固定的 `DETAILS_MAX = 520` 换成视口相关）
- 中间列下限：`CENTER_MIN = 480`（出厂 640 在常见笔记本宽度下没有余量）

然后重建客户端库：`pnpm run build:lib:client`（运行中的 UI 是从各包 `lib/` 产物组合的，不只是 `apps/web/dist`）。不改也不影响使用，只是右列宽度会被默认值限制。

## 工作原理

```
浏览器客户端包（Shiki 内联，ModuleLoader 闭包）
  │  同源 fetch（cookie 认证——与产品资源同一通道）
  ├─ GET  /worx-file?p=<path>  ──> 原始文件字节（图片预览，≤8 MB）
  └─ POST /worx-api            ──> { op: list | read | state, args }
                                      │
Host（lib/index.js，纯 JS；仅依赖 storage-domain + zod）
  ├─ ctx.fs（fs-sandbox）：listDir / readText+readBytes
  └─ ctx.storageDomain：域 'fs_browser'，表 'state'
       （持久后端写入 ~/.dsh/storages/fs_browser.json——不经 fs-sandbox）
按工作区状态以 workspaceId 为键。旧版工作区内 .worx-state.json 会在首次启动时
  一次性导入，之后保留并隐藏于文件列表。
```

- 客户端插件（`dsh.client` + `exports["./client"]`）以 `priority: -100` 注册 `details` 座位（遮蔽内置工具详情面板）与头部开关
- Host 行声明 `inject: ['fs', 'webServer', 'storageDomain']`，保证在这些服务就绪前不会激活

## 开发

前置：一份 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 检出（提供 `tsdown`、解析私有 `@deepseek-ai/*` 工作区包）与一个可测试的 profile（见安装）。

```sh
pnpm install              # 拉取开发工具链（tsdown、shiki、typescript）
pnpm build                # build:host 把 src/index.js 拷到 lib/index.js，
                          # 再由 build:client 把 Shiki 打包进 lib/client.js
pnpm pack                 # -> dsh-fs-browser-<version>.tgz
```

- **Host 半**（`src/index.js`）是手写纯 JS——`pnpm run build:host` 会拷到 `lib/index.js`；改 `src/index.js`，不要改 `lib/`
- **Client 半**（`src/client.ts`）由 tsdown 构建：`react` 保持 external（页面 `require('react')`），其余（Shiki 与语法）全部内联
- 运行中的 GUI 按内容哈希 rev 服务 `lib/client.js`——重建后刷新页面（或重启 GUI）即生效；Host 侧改动需重启 GUI
- 快速迭代时也可借任何已装有 `shiki` 的上下文构建（如 `packages/client/ui-primitives/node_modules`）——产物一致

## 项目结构

```
dsh-fs-browser/
  package.json            # dsh-fs-browser；dsh.bundle.patch -> cordis.patch.yml，
                          # dsh.client 声明 + exports["./client"]
  cordis.patch.yml        # bundle 分层（dsh.bundle.patch）——兼作 --patch 开发覆盖
  tsdown.config.ts        # 自包含客户端构建（ModuleLoader 闭包包装）
  tsconfig.json           # 客户端 TS 编译选项
  src/client.ts           # 浏览器半：面板组件 + Shiki 高亮
  src/index.js            # Host 半（手写纯 JS）：/worx-file + /worx-api 路由
                          #   + fs_browser 存储域；由 build:host 拷到 lib/index.js
  lib/index.js            # 构建产物（Host 拷贝，gitignored）
  lib/client.js           # 构建产物（Shiki 内联，gitignored）
  .github/workflows/release.yml   # tag v* → 云端构建 + 打包 + release + 挂 tarball
  README.md / README.zh-CN.md
  LICENSE                 # MIT
```

## 发布

包按 dsh **bundle** 形态组织——用户 `dsh plugin --profile <name> add dsh-fs-browser` 即可安装并进入 profile 的 bundle 分层。`peerDependencies` 保持极简（`react`、`@deepseek-ai/dsh-storage-domain`、`zod`）：这两个运行时包从安装环境的共享扁平回退（`$DSH_HOME/profiles/node_modules`）解析，浏览器半自含 Shiki。

**每个 GitHub release 都附带打包 tarball**。仓库内置的 GitHub Action（`.github/workflows/release.yml`，在 `v*` 标签时触发）使其全自动：推送 `v<版本>` 标签后，工作流会检出该标签、校验其与已提交的 `package.json` 版本一致、云端构建浏览器包与 Host 半、打包 `dsh-fs-browser-<version>.tgz`、创建（或更新）release 并上传 tarball——无需本地构建。

```sh
git tag v0.1.1 && git push origin v0.1.1   # 工作流自动产出 dsh-fs-browser-0.1.1.tgz release
```

**npm**：同样的 tarball 内容发布到 [npm](https://www.npmjs.com/package/dsh-fs-browser)（`npm publish`）。发布后用户可直接从 registry 安装（见安装方式 A′）：

```sh
dsh plugin --profile <name> add dsh-fs-browser
```

本地等价步骤为 `pnpm build && pnpm pack`。用户安装 tarball：

```sh
dsh plugin --profile <name> add ./dsh-fs-browser-<version>.tgz
```

发布前在本地验证 tarball：装进一个 profile、启动 GUI、确认会话头部出现「📁 文件」且文件列可用。

## License

[MIT](LICENSE)