# Vialite

[English](README.md) · **简体中文**

一款面向 [Vial](https://get.vial.today/) 协议键盘的原生 Web 配置器,通过 [WebHID](https://developer.mozilla.org/zh-CN/docs/Web/API/WebHID_API) 直接与键盘通信 —— 无需 Qt、无需 WebAssembly、无需安装驱动。

这是一个从零编写的 Web 前端,而非对官方 `vial-gui`/`vial-web` 的构建封装(后者将 PyQt5 桌面应用编译成 WebAssembly)。Vial HID 协议本身在 `src/protocol/` 下用 TypeScript 重新实现,移植自 [`vial-gui`](https://github.com/vial-kb/vial-gui) 的 Python 实现。

## 功能

- **键位编辑** —— 逐层分配键码,提供可搜索的键码选择器、完整的物理布局渲染(含 ISO 回车键与旋钮编码器)、布局选项(layout options)支持,以及 3D 键盘预览。
- **双功能 / 长按短按键** —— 为 layer-tap / mod-tap 等双功能键码提供专用编辑器。
- **宏(Macros)** —— 录制与编辑宏序列(需键盘支持)。
- **Tap Dance** —— 配置单击 / 双击与长按 / 长按短按动作。
- **组合键(Combos)** —— 定义多键组合,支持预览卡片与重新排序。
- **单键 / 灯光颜色** —— 键盘颜色配置。
- **QMK 高级设置** —— grave-escape、magic、one-shot、tap-hold、鼠标键以及 combo 计时,配合随滚动同步的目录。
- **矩阵测试器** —— 解锁并轮询的矩阵诊断(需键盘支持)。
- **导入 / 导出** —— `.vil` 布局文件,通过重新实现的序列化器往返读写。
- **双语界面** —— 手写的中英文词典,语言选择持久化保存,并支持明暗主题。键帽标签保持英文,与 `vial-gui` 一致。

依赖设备能力的功能面板(宏、tap dance、组合键、矩阵测试器)在所连接键盘不支持时会显示为不可用。

## 环境要求

- Chrome 或 Edge(Safari 与 Firefox 不支持 WebHID —— 参见 [caniuse.com/webhid](https://caniuse.com/webhid))
- Node.js
- [pnpm](https://pnpm.io/)

## 开发

```
pnpm install         # 安装依赖
pnpm dev             # 启动 Vite 开发服务器
pnpm build           # tsc -b(类型检查)+ vite build
pnpm test            # 运行测试(vitest)
pnpm preview         # 预览生产构建
```

在 Chrome/Edge 中打开命令行输出的 localhost 地址,点击 Connect,然后在设备选择器中选择你的 Vial 键盘。

`pnpm build` 中的 `tsc -b`(严格模式)是主要的正确性校验;没有单独的 lint 步骤。CI 在向 `main` 推送 / 提 PR 时依次运行 `pnpm build` 和 `pnpm test`。

## 项目结构

- `src/protocol/` —— 与框架无关的 Vial/VIA HID 协议重新实现(传输层、键盘客户端、键码表、KLE 解析器、`.vil` 序列化、宏)。`keycodes.ts` 保存原始键码表(`KEYCODE_CATEGORIES`、`label()`)。
- `src/components/keymap/keycodeMeta.ts` —— 键码 **UI 元数据的唯一真源**:分类/子分组层级(`BASIC_GROUPS`、`LAYER_GROUPS`、`QUANTUM_GROUPS` 等)、分类/分组/单键说明的翻译 key(`CATEGORY_KEYS`、`CATEGORY_DESC`、`CLEAR_LABELS`、`KEYCODE_HELP`),以及连接设备的实时分类(`deviceCategories()`)。凡是展示按键、按键标签、按键说明或分类标题的界面都从这里读取(说明文案经 `src/contexts/i18n.tsx` 解析),不再在组件里内联任何表。
- `src/components/` —— React 界面,按关注点每个目录一个(`keymap`、`layout`、`macro`、`tapdance`、`combo`、`color`、`qmk`、`matrix`、`io`、`connect`、`shell`、`site`、`common`)。
- `src/contexts/` —— i18n、主题、键位显示与预览外观设置、消息提示等 React context。
- `src/App.tsx` —— 顶层状态与组件装配(不使用外部状态库)。

## 许可证

Vialite 基于 [GNU 通用公共许可证 v2.0](LICENSE)(GPL-2.0)授权。

`src/protocol/` 下的协议层移植自官方 Vial 桌面客户端 [`vial-gui`](https://github.com/vial-kb/vial-gui),该项目 © Vial 贡献者,采用 GPL-2.0 授权。作为衍生作品,Vialite 沿用相同的许可证。感谢 [Vial](https://get.vial.today/) 项目提供的协议设计、参考实现以及键盘侧固件,正是它们让这个配置器成为可能。
