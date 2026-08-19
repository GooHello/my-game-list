# Shan's Game List — 优化路线图

> 生成时间：2026-08-19 | 基于全量代码勘察与对抗核实

## 实施进度

| 阶段 | 状态 | 提交 |
|------|------|------|
| P0 立即修复（8 条） | ✅ 全部完成并实测（鉴权/遍历/XSS/部署/筛选/remark 等，curl 逐项验证） | `adc4272` |
| P1 框架治理 | ✅ 全部完成（scripts 25→3、删死路由死依赖、39 孤儿封面、标签外置、schema 校验、统一 ID、validate-data 工具） | `35f5517` |
| P2 功能增强（7 条） | ✅ 全部完成（状态筛选、卡片懒渲染、useIsMobile hook、移动 3 列、社交元数据、冗余副本清理；HeroSection 随 P1 删除） | `94d004c` |
| P3 长期演进 | ✅ 封面压缩管线完成（存量 35.9→27.8MB，上传端 canvas 自动压缩）；其余 3 项经确认暂缓 | `2972c89` |

**P3 暂缓项**（2026-08-19 确认，按需启动）：数据层升级（当前体量无瓶颈）、admin 前端重构（单人使用 ROI 低）、评测功能重建（待确定写评测计划）。

日常工具：
- `npm run validate-data` —— 任何数据改动后跑一遍
- `npm run compress-covers` —— 压缩超 200KB 的封面（`--dry-run` 预览）

---

## 项目现状总结

项目整体**功能可用、数据完整**：451 条游戏记录 schema 一致，Next.js 15 静态站可正常构建，Admin 面板 CRUD 功能齐全，封面图 451 张全部有文件对应。主要问题集中在三方面：**Admin 面板存在多个安全漏洞**（路径遍历、无鉴权、XSS、上传扩展名伪造），任何一个被利用都可导致数据丢失或本机被控制；**大量死代码和结构债务**（22 个废弃脚本、空转的 review 路由+3 个白装依赖、5 个全空 schema 字段、39 张孤儿封面）拖慢维护效率；**前端硬编码业务规则**（标签配置写死在 page.tsx、playStatus 无筛选入口）违反项目自身 CHANGELOG 确立的"前端只渲染"原则。此外，项目目录当前**没有 .git 仓库**，Admin 面板的一键部署功能完全失效。

---

## P0 立即修复（本周就做——正在造成安全风险或功能错误）

| # | 条目 | 说明 |
|---|------|------|
| 1 | **初始化 Git 仓库**（基础设施/S） | 当前目录无 .git，Admin 一键部署和 CI 均不可用 → `git init && git add -A && git commit -m "initial"` 恢复版本控制，这是后续所有改动的前提。 |
| 2 | **修复 `/api/restore/:file` 路径遍历漏洞**（high/S） | `path.join(BACKUP_DIR, req.params.file)` 无校验，Windows 反斜杠遍历可逃逸目录覆盖任意文件 → 加 `path.basename` + 白名单正则 `/^[\w.-]+\.json$/` + `path.resolve().startsWith()` 双重防御，约 4 行。 |
| 3 | **Admin 面板加鉴权 + 限制监听地址**（high/S） | 13 个端点（含 DELETE/git push）零鉴权且默认绑定 0.0.0.0 → `app.listen(PORT, '127.0.0.1')` + 全局 API Key 中间件 `app.use('/api', ...)` + 前端 fetch 加 `x-admin-key` header，约 10 行。 |
| 4 | **修复 `renderTable()` 存储型 XSS**（high/S） | innerHTML 直接拼接 Steam 抓取的 title/tags/appId 无转义 → 添加 `escapeHtml()` 工具函数包裹所有用户可控字符串，onclick 改用 dataset + addEventListener，约 10 行。 |
| 5 | **修复"缺失封面"筛选逻辑反转**（high/S） | 第 312 行逻辑排除有封面的游戏、保留 bing_ 前缀的 → 改为 `if (coverFilter === 'missing' && g.cover) return false;`，1 行。 |
| 6 | **修复 `/api/deploy` 静默失败**（high/S） | 先返回成功后异步 exec，无 .git 时 100% 静默报错 → exec 前检查 `existsSync('.git')`，改为同步等待返回真实结果，前端展示成功/失败，约 20 行。 |
| 7 | **修复 `update-and-fetch.js` 缺失 remark 字段**（high/S） | 13 字段对象覆盖 14 字段 schema，一旦 remark 有值运行脚本即静默清除 → 第 38 行补 `remark: row.remark ? row.remark.toString().trim() : null`，1 行。 |
| 8 | **修复封面上传扩展名伪造**（medium/S） | multer 取 `file.originalname` 扩展名，可上传 .html 伪装图片 → 忽略 originalname，按 mimetype 映射固定扩展名（jpeg→.jpg, png→.png, webp→.webp），static 加 `X-Content-Type-Options: nosniff`，约 10 行。 |

---

## P1 框架治理（结构性优化——让项目回到可维护状态）

| # | 条目 | 说明 |
|---|------|------|
| 1 | **清理 scripts/ 目录**（medium/S） | 25 个脚本仅 3 个被 package.json 引用 → 删除 15 个纯一次性脚本；从 `fix-final.js` 提取 STEAM_CORRECTIONS 到 `data/steam-corrections.json`；从 `fix-bing-covers.js` 提取 ENGLISH_NAMES 到 `data/english-names.json`；删除提取后的源脚本。 |
| 2 | **删除死 review 路由 + 空字段 + 无用依赖**（medium/S） | 451 条记录 reviewFile/pros/cons/playtime/showPlaytime 全空 → 删除 `src/app/review/` 目录、移除 react-markdown/remark-gfm/rehype-raw 三个依赖、清理 GameCard 中相关 UI 分支、从 admin 编辑模态框移除相关表单。构建产物减少约 150KB。 |
| 3 | **清理孤儿封面 + 修复路径不一致**（medium/S） | 39 张孤儿文件（4.37MB）+ 3 条 cover 路径与 id 不匹配 → 重命名 3 个不一致文件（注意先处理同名冲突）、更新 games.json cover 字段、删除 39 个孤儿；DELETE 端点补充删除对应封面文件。 |
| 4 | **Admin 写入端点加 schema 校验**（medium/S） | PUT 直接 spread 合并无白名单，req.body.id 可覆盖原始 id → 新增 `validateGameSchema()` 函数，14 字段白名单 + 类型约束，PUT 只允许白名单字段通过。约 30 行。 |
| 5 | **统一 ID 生成策略**（medium/S） | admin POST 不做 toLowerCase、import-excel 和 update-and-fetch 做 toLowerCase → 抽取统一 `generateId(title)` 到 `scripts/lib/utils.js`，强制 toLowerCase + 空 id 兜底 `game-${Date.now()}`，三处引用。 |
| 6 | **标签配置外置到 JSON**（medium/M） | page.tsx 第 12-61 行硬编码 TAG_TIERS（30 标签）+ TAG_MAPPING（52 条），其中 10 条映射目标不在 CORE_TAGS 中是死代码 → 抽取到 `data/tag-config.json`，补充"单人/多人/剧情丰富"等高频标签，消除 Mobile 特殊分支。 |
| 7 | **提取共享工具模块**（medium/M） | Steam 爬虫在 10 个脚本重复、Excel 转换在 6+ 脚本复制 → 提取到 `scripts/lib/` 下的 `steam-fetcher.js`、`excel-utils.js`、`game-schema.js`，3 个活脚本统一引用。 |
| 8 | **杂项配置修正**（low/S） | package.json name `'portfolio'` → `'my-game-list'`；next.config.ts 删除 via.placeholder.com remotePatterns；`globals.css` dark mode 媒体查询与 Steam 深色主题冲突需统一；`layout.tsx` lang `'en'` → `'zh-CN'`，description 数字改动态或 `'450+'`。 |

---

## P2 功能增强（按价值排序）

| # | 条目 | 说明 |
|---|------|------|
| 1 | **增加 playStatus 筛选入口**（medium/S） | 125 款游玩中 + 326 款已通关，但无按状态浏览入口 → FilterBar 增加"全部/游玩中/已通关"三档按钮，page.tsx 加 selectedStatus state + 过滤条件，约 20 行。 |
| 2 | **首页虚拟列表/懒渲染**（medium/M） | 451 张卡片同时挂载 + 40MB 封面全量原图 → 引入 `@tanstack/virtual` 或 IntersectionObserver 懒渲染，仅渲染可视区域约 45 张卡片，DOM 节点从 ~3000 降至 ~400。 |
| 3 | **移动端网格 3 列优化**（medium/S） | grid-cols-4 在手机 375px 屏宽下每卡仅约 84×112px，弹出面板文字 text-[8px] 难以辨认 → 改为 `grid-cols-3 sm:grid-cols-4`，手机端每卡约 115px 宽，1 行改动。 |
| 4 | **补充社交分享元数据**（low/S） | 无 openGraph/twitter card，社交分享无预览图 → layout.tsx metadata 补充 openGraph 配置（title/description/images），约 15 行。 |
| 5 | **提取 useIsMobile 公共 hook**（low/S） | GameCard 和 FilterBar 各自独立检测 isMobile → 抽取到 `src/hooks/useIsMobile.ts`，消除重复，确保 resize 行为一致。 |
| 6 | **删除 HeroSection.tsx 死代码**（low/S） | 58 行组件零引用 → 直接删除，零风险。 |
| 7 | **清理冗余数据副本**（low/S） | `data/gamelist - 副本.xlsx` 和 `data/Standard_Game_List - 副本.xlsx` 两个冗余副本 → 确认后删除；为 `data/backup/` 添加 README 说明各备份时间线。 |

---

## P3 长期演进（可选，按需启动）

| # | 条目 | 说明 |
|---|------|------|
| 1 | **数据层升级**（L） | games.json 224KB 全量打包进前端 JS bundle，随游戏数增长 bundle 线性膨胀 → 考虑构建时生成静态 JSON API（每页/每分类一个文件），或迁移到轻量 SQLite + 构建时 SSG。个人项目当前体量不急。 |
| 2 | **Admin 面板前端重构**（M） | 629 行单文件 vanilla JS + DOM 操作 → 当功能增加时维护成本急剧上升，可考虑迁移到 React/Vue 小应用，组件化编辑表单/列表/筛选。 |
| 3 | **封面图优化管线**（M） | 当前 `images.unoptimized: true`，所有封面原图交付（中位 60KB，P90 109KB，最大 1.78MB）→ 启用 Next.js Image Optimization 或构建时生成多尺寸缩略图，配合 srcSet 按视口交付。静态导出模式下需评估 GitHub Pages 兼容性。 |
| 4 | **评测功能重新设计**（M） | 如果未来想启用评测：review 路由 + markdown 渲染管线已搭好骨架，需要设计内容创作流程（admin 面板编辑 markdown → 存 `content/reviews/` → 构建时静态化），而非当前的全空字段占位。 |

---

## 实施纪律（基于 CHANGELOG.md 历史教训）

以下规则从项目自身踩过的坑中提炼，后续每次改动必须遵守：

### 规则 1：前端只渲染，业务规则下沉数据层
> *教训来源：page.tsx 写死 anchorList/mobileList/filter 导致底层数据与前端脱节*

- 标签分级、映射关系、分区规则等**业务配置**必须存在 `data/*.json` 中，前端 import 使用。
- 新增/删除游戏、调整分类，只改数据文件，不改组件代码。
- 禁止在前端出现 `if (title.includes('xxx'))` 式的硬编码业务判断。

### 规则 2：生成路径必须实际校验
> *教训来源：import-excel.js 写死 `/covers/${id}.jpg` 导致 bing_ 前缀图片全部 404*

- 任何生成文件路径的代码，必须用 `fs.existsSync()` 或 `fs.readdirSync()` 校验目标文件确实存在。
- cover 字段写入 games.json 前，必须确认对应图片文件已在 `public/covers/` 中。
- 备份恢复操作前，必须校验备份文件内容与当前 schema 兼容。

### 规则 3：改完必须验证
> *教训来源：多次修改后未启动 dev server 验证，汇报"完美实现"实际全部失败*

- 修改数据或代码后，必须 `npm run dev` 启动并在浏览器中确认效果。
- Admin 面板改动后，必须在 localhost:4000 实际操作一遍 CRUD 流程。
- 涉及 git/deploy 的改动，必须先确认 `.git` 存在且 remote 可达。

### 规则 4：单一数据源，单一写入路径
> *教训来源：依赖错误备份文件覆盖最新数据；三个脚本各自构建 game 对象字段数不同*

- `data/games.json` 是唯一真理。Excel 仅作为批量导入源，导入后 JSON 为准。
- 游戏记录的 schema 定义只维护一份（`scripts/lib/game-schema.js`），admin POST/PUT、import-excel、update-and-fetch 三处统一引用。
- 备份文件必须带时间戳命名并记录在 `data/backup/README.md` 中，禁止从命名模糊的"副本"文件恢复。

### 规则 5：安全端点必须防御
> *教训来源：13 个 API 端点零鉴权、路径遍历、XSS、扩展名伪造*

- 任何新增的 API 端点必须经过 API Key 中间件。
- 任何接收外部输入（文件名、游戏数据、上传文件）的端点必须做白名单校验和类型约束。
- 任何将外部数据渲染到 HTML 的地方必须转义，禁止裸 innerHTML 拼接。
