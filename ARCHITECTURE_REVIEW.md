# 目录结构架构评审

日期:2026-07-26
范围:`src/` 目录组织(不含具体业务逻辑正确性)

## 总体评价

`protocol/` 与 React 视图层解耦、组件按功能域分目录(`combo/`、`macro/`、`matrix/`、`qmk/`、
`rgb/` 等)、测试文件就近放置(`*.test.ts` 与被测代码同目录)——这些都是成熟项目的做法。
问题主要集中在两类:**部分目录职责边界模糊/过度堆积**,以及**少数文件体量过大**。

## 问题清单

### P0 — 结构性问题

1. **`src/components/keymap/` 是一个失控的大杂烩目录**
   20+ 个文件混着四类完全不同的职责:布局渲染(`KeyboardLayoutPreview/Editor`、
   `KeycapFace`、`KeyboardCaseLayer`、`layoutGeometry.ts`、`keyEventMap.ts`、
   `keycapIcons.ts`、`autoFitSize.ts`、`caseOutline.ts`)、按键选择器
   (`KeycodeCascadeSelector`、`KeyInfoCard`、`DualRoleEditor`、`keycodeMeta.ts`)、
   样式配置(`StyleConfig.tsx`)、以及本身已经有子目录的快捷配置(`quickConfig/`)。
   **状态:已修复** — 拆分为 `keymap/layout/`、`keymap/picker/`、`keymap/style/`,
   `LayerTabs.tsx` 与 `quickConfig/` 留在 `keymap/` 根。

2. **`components/common/` 名不副实**
   `UnlockDialog.tsx` 强绑定 Vial 的解锁/matrix-tester 协议流程,不是通用组件,却和真正
   通用的 `ConfirmDialog`、`ColorPicker`、`HelpIcon` 放在一起。
   **状态:已修复** — 移至 `components/matrix/UnlockDialog.tsx`(它本来就只服务于
   `MatrixTester`)。

3. **`shell/` 与 `site/` 边界模糊**
   `NewHomePage`、`SiteConfigPage` 在 `shell/`,`SiteSettingsPanel`、`ThanksMarquee` 在
   `site/`,命名近似但实际上 `site/` 下的两个组件只被 `shell/SiteConfigPage.tsx` 一处引用。
   **状态:已修复** — 将 `site/` 整体挪到 `shell/site/`,在目录树上体现真实的从属关系:
   `shell/` = 全屏页面壳(`NewHomePage`/`SiteConfigPage`)+ 导航定义,
   `shell/site/` = 仅供 `SiteConfigPage` 组合使用的网站配置内容面板。

### P1 — 可维护性

4. **`src/` 根目录堆了一批松散工具文件**
   `mdiIcons.ts`、`mdiIcons.data.ts`、`debug.ts`、`analytics.ts`、`browserSupport.ts`
   直接摆在 `src/` 下,和 `App.tsx`、`main.tsx` 平级。
   **状态:已修复** — 归入 `src/lib/`,`src/` 根只保留应用入口文件。

5. **没有路径别名,深层相对导入会很痛**
   `components/keymap/quickConfig/` 这类三层嵌套目录里出现 `../../../protocol/keyboard`
   这种路径。
   **状态:已修复** — 新增 `@/*` → `src/*` 别名(`vite.config.ts` + `tsconfig.app.json`)。
   本次未强制转换全部现存的相对导入(风险/收益不对等的大范围机械改动),后续新代码及深层
   嵌套目录建议优先使用 `@/`。

6. **几个"上帝文件"体量过大**
   `App.tsx`(641行)、`KeycodeCascadeSelector.tsx`(917行)、`QuickConfigPanel.tsx`
   (764行)、`KeyboardLayoutPreview.tsx`(593行)、`StyleConfig.tsx`(557行)都明显超出
   单一职责该有的体量。
   **状态:未处理,建议单独立项** — 这类拆分涉及具体 UI/状态语义的重新划分,机械拆分风险
   较高,不适合和目录搬迁一起batch处理。`protocol/keyboard.ts`(1374行)、
   `keycodes.ts`(1759行)因是逐行对照 `vial-gui` 移植的协议层,体量大属预期,不算坏味道。

### P2 — 收尾清理(未处理,不在本次范围)

7. 根目录的 `dev-measure.html`/`dev-measure-main.tsx`(临时测量工具)、`3d-plan.md` 建议
   挪进 `dev/` 或 `scripts/` 子目录,避免与正式入口 `index.html` 混淆。
8. `CLAUDE.md` 提到的 `note.md` 实际不存在于仓库根,是文档失效引用。

## 本次修复范围

已完成 P0 全部三项 + P1 的第 4、5 项(目录搬迁 + 路径别名),并以 `pnpm build`(tsc 严格模式)
和 `pnpm test` 通过作为验收标准。P1 第 6 项(拆分大文件)与 P2 留待后续单独处理。
