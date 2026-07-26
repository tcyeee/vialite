# Incident log: 主题切换水波扩散起点未对齐主题按钮

**Date**: 2026-07-27
**Status**: Reverted, unresolved. Root cause not confirmed.

## What was asked

点击顶部导航栏的主题(浅色/深色)切换按钮时，`document.startViewTransition` 驱动的圆形
水波扩散(见 `src/index.css` 的 `theme-reveal` keyframes、`src/contexts/theme.tsx` 的
`setRevealGeometry`)起点应该是这颗主题切换按钮的位置，而不是别处。用户反馈这个问题已经
反复尝试过多次，始终没有修好。

## What was tried this round

`setTheme(next, origin)` 在 `NewHomePage.tsx` 里由主题开关的 `<input type="checkbox"
className="theme-controller">` 的 `onChange` 调用，传入 `e.currentTarget`——也就是
checkbox 本身，而不是外层可见的胶囊按钮 `<label>`。

假设：daisyUI 的 `.swap` 是 `display:inline-grid`，checkbox/两个 `<span>` 图标都是同一个
grid cell 里的重叠 item；但 `.swap input` 只有 `appearance:none; border:none`，没有让它
撑满(stretch)到跟 `<span>` 一样大——checkbox 保留浏览器默认的原生尺寸(如 13px 见方)，且
默认对齐落在 grid area 的起始角(受 stretch 在“定长子项”上退化为 start 对齐的规则影响)，
而不是跟着 `place-content:center` 一起居中。于是 `e.currentTarget.getBoundingClientRect()`
算出来的中心点，跟用户视觉上看到的胶囊按钮中心是错位的。

据此把 `onChange` 里传给 `setTheme` 的 origin 从 `e.currentTarget` 改成
`e.currentTarget.closest("label")`（外层真正可见的胶囊按钮），预期水波圆心会对齐到按钮上。

## Result

用户验证后反馈依然没有修好——跟之前多次尝试一样。**这个假设(checkbox 在 grid 内错位)未
被证实是根因**，只是看代码推断的一种可能性，没有用真实浏览器测量 `getBoundingClientRect()`
去验证过。已撤销这次改动，`NewHomePage.tsx` 恢复为 `e.currentTarget`（即 HEAD 的状态）。

## Open questions / what to check before retrying

- 从未在真实浏览器里打印/测量过点击瞬间 `e.currentTarget.getBoundingClientRect()` 的实际
  值，也没有量过用户看到的水波实际圆心在哪、跟按钮偏差多少、偏差方向——排查应该从这一步
  开始，而不是继续猜测 CSS 细节。
- 没有确认 `setRevealGeometry`（`src/contexts/theme.tsx`）里写入的 `--theme-reveal-x/y`
  这两个 CSS 变量，在 `document.startViewTransition` 快照那一刻是否已经生效——`flushSync`
  只包住了 `setThemeState`，`root.style.setProperty` 是在 `setRevealGeometry` 里同步写的、
  发生在 `startViewTransition` 回调之前，理论上没问题，但没有实测确认时序。
- 没有检查 `html[data-theme-anim="reveal"]::view-transition-old/new(root)` 这两条规则在
  多显示器/DPI 缩放、或者页面本身有 `transform`(比如 hero 卡片的 3D 倾斜 `cardRef.style.
  transform`)时，clip-path 的坐标系是否还是简单的 viewport 坐标——如果水波偏移量跟卡片倾斜
  角度相关，说明问题出在坐标系而不是按钮定位。
- 没有排除是用户看错了别的按钮(比如把"翻译"按钮和主题按钮的水波混在一起判断)的可能——
  下次复现时应让用户明确指出"水波实际从哪里长出来"的截图或坐标，而不是仅凭口头"没修好"。
- 在没有真实测量数据之前，不要再对 daisyUI `.swap` 的 grid/stretch 行为做进一步猜测性修改。
