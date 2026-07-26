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
   **状态:已修复**,按"提取纯逻辑/无状态子组件,保留状态机本体"的原则逐个拆分,
   每次拆分后都用 `pnpm build`+`pnpm test`+浏览器实测(Playwright 驱动一个挂载目标
   组件的临时 dev 页面,验证交互和 0 console 报错后再删除)验收:
   - `KeycodeCascadeSelector.tsx`(917→545行)拆出 `cascadeGrouping.ts`(纯分组
     逻辑)、`CascadeColumns.tsx`(三栏选择器)、`CascadeInfoPanel.tsx`(信息面板)。
   - `QuickConfigPanel.tsx`(764→477行)拆出 `quickConfigData.ts`(静态分类数据)、
     `MultiFunctionCardBody.tsx`(多功能卡片)、`ConfigSettingsSection.tsx`(配置
     设置区块)。
   - `App.tsx`(641→460行)拆出 `hooks/useKeySelection.ts`(选中态的全部写入路径:
     assign / 双功能 hold 写入 / 右键菜单 / `.vil` 导入导出),延续项目已有的
     `useConnectionTransition`/`usePageNavigation` hook 模式。
   - `KeyboardLayoutPreview.tsx`(593→311行)拆出 `appearance.tsx`(外观类型/常量/
     `shapeStyle`/`appearanceMetrics`/`KeyboardZoom`),用 `export *`
     整体转发,6 个外部引用方(`KeyboardLayoutEditor`、`StyleConfig`、
     `MatrixTester`、`KeyboardColorPanel`、`NewHomePage`、`previewAppearance`
     context)零改动。
   - `StyleConfig.tsx`(557→287行)拆出 `fullscreenPreviewMetrics.ts`(纯几何/
     调参常量)、`useFullscreenPreview.ts`(打开/关闭状态机)、
     `usePullToExitCurtain.ts`(下拉退出手势,当前经 `PULL_TO_EXIT_ENABLED`
     关闭,但仍按启用状态验证过行为)。
   `protocol/keyboard.ts`(1374行)、`keycodes.ts`(1759行)因是逐行对照
   `vial-gui` 移植的协议层,体量大属预期,未拆分。

### P2 — 收尾清理

7. 根目录的 `dev-measure.html`/`dev-measure-main.tsx`(临时测量工具)、`3d-plan.md` 建议
   挪进 `dev/` 或 `scripts/` 子目录,避免与正式入口 `index.html` 混淆。
   **状态:已修复** — 三个文件移入 `dev/`,`dev-measure.html` 的 script src 与
   `dev-measure-main.tsx` 内部对 `src/` 的相对导入已同步更新为多一层 `../`。
8. `CLAUDE.md` 提到的 `note.md` 实际不存在于仓库根,是文档失效引用。
   **状态:已修复** — 该文件在提交 `6b34f03` 中被一并删除且未留存,`CLAUDE.md` 中的引用
   句子已直接移除,不再指向不存在的文件。

## 本次修复范围

P0 全部三项、P1 全部四项(目录搬迁、路径别名、dev 工具归位、失效文档引用清理、拆分大文件)、
P2 全部两项均已完成。所有改动均以 `pnpm build`(tsc 严格模式)+ `pnpm test` 通过为最低验收
标准;涉及交互逻辑的拆分(级联选择器、快捷配置面板、全屏预览)额外用 Playwright 驱动一个
挂载目标组件的临时 dev 页面做了实际浏览器验证(点击/悬停/拖拽路径 + 0 console 报错),验证
通过后清理掉临时文件。
