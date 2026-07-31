import { useEffect, useState, type SyntheticEvent } from "react";
import { ComboPanel } from "./components/combo/ComboPanel.tsx";
import { DualRoleEditor } from "./components/keymap/picker/DualRoleEditor.tsx";
import { KeyboardLayoutEditor } from "./components/keymap/layout/KeyboardLayoutEditor.tsx";
import { KeyboardLayout3D } from "./components/connect/KeyboardLayout3D.tsx";
import { Preview3DDebugPanel } from "./components/connect/Preview3DDebugPanel.tsx";
import {
  loadPreview3DParams,
  savePreview3DParams,
  type Preview3DParams,
} from "./components/connect/preview3dParams.ts";
import { useAutoFitZoom } from "./components/keymap/layout/autoFitSize.ts";
import { CornerCloseButton } from "./components/common/CornerCloseButton.tsx";
import { HelpIcon } from "./components/common/HelpIcon.tsx";
import { configSwapName, KEYBOARD_HERO_NAME } from "./components/common/viewTransition.ts";
import {
  ALWAYS_ENABLED_ATTR,
  QuickConfigPanel,
} from "./components/keymap/quickConfig/QuickConfigPanel.tsx";
import { LayerTabBar } from "./components/keymap/LayerTabs.tsx";
import { PersonalizationSection } from "./components/keymap/PersonalizationSection.tsx";
import { MacroPanel } from "./components/macro/MacroPanel.tsx";
import { MatrixTester } from "./components/matrix/MatrixTester.tsx";
import { NewHomePage } from "./components/shell/NewHomePage.tsx";
import { SiteConfigPage } from "./components/shell/SiteConfigPage.tsx";
import { QmkSettingsPanel } from "./components/qmk/QmkSettingsPanel.tsx";
import { RgbPanel } from "./components/rgb/RgbPanel.tsx";
import { KeyboardColorPanel } from "./components/color/KeyboardColorPanel.tsx";
import { TapDancePanel } from "./components/tapdance/TapDancePanel.tsx";
import { SpinnerIcon, WaitingForConnection } from "./components/connect/WaitingForConnection.tsx";
import { useI18n } from "./contexts/i18n.tsx";
import { NO_DEVICE, usePreviewAppearance } from "./contexts/previewAppearance.tsx";
import { useConnectionTransition } from "./hooks/useConnectionTransition.ts";
import { usePageNavigation } from "./hooks/usePageNavigation.ts";
import { useKeySelection, type Selected } from "./hooks/useKeySelection.ts";

/**
 * 未选中按键时挂在快捷配置外层的激活类事件拦截器,用来替代 pointer-events-none
 * (那会连滚轮一起吞掉,见调用处注释)。标了 {@link ALWAYS_ENABLED_ATTR} 的子树
 * ——目前是「配置设置」那组开关——不受影响:它们是面板级设置,和选没选中按键无关。
 */
function swallowEvent(e: SyntheticEvent) {
  if ((e.target as Element | null)?.closest?.(`[${ALWAYS_ENABLED_ATTR}]`)) return;
  e.stopPropagation();
  // 只对 click 调 preventDefault:在 pointerdown/keydown 上调用会连带取消浏览器的
  // 默认滚动手势(触摸拖动、空格翻页),而这里要禁掉的只是「激活」。
  if (e.type === "click") e.preventDefault();
}

function App() {
  const { t } = useI18n();
  const [layer, setLayer] = useState(0);
  const [preview3dParams, setPreview3dParams] = useState<Preview3DParams>(loadPreview3DParams);
  const [selected, setSelected] = useState<Selected | null>(null);
  // Page mode + every animated-navigation concern (hero morph, push/push-back slide, QMK
  // unsaved-changes gate) — see src/hooks/usePageNavigation.ts. `onNavigated` clears the
  // key/encoder selection whenever the page mode actually changes, mirroring what `navigate`
  // and `handleQmkLeaveResolved` used to do inline before this state lived in its own hook.
  const nav = usePageNavigation({ onNavigated: () => setSelected(null) });
  // WebHID connect/disconnect lifecycle + its zoom-rise/darken-reveal transition — see
  // src/hooks/useConnectionTransition.ts. `onAttached`/`onDetached` run the navigation-state
  // resets that `attachTransport`/`finishDisconnect` used to do inline, at the same points.
  const conn = useConnectionTransition({
    onAttached: () => {
      setLayer(0);
      setSelected(null);
      nav.resetForConnect();
    },
    onDetached: () => {
      setSelected(null);
      nav.resetForDisconnect();
    },
  });
  const { keyboard, productName, lastDeviceName } = conn;
  // Keeps 个性化/键盘配色's persisted settings (spacing, case/keycap color, the
  // per-key paint map, ...) scoped to whichever keyboard is actually connected
  // — see contexts/previewAppearance.tsx's doc comment for why this can't just
  // read `keyboard.uid` directly instead of round-tripping through a setter.
  const { setActiveDevice } = usePreviewAppearance();
  useEffect(() => {
    setActiveDevice(keyboard?.uid ?? NO_DEVICE);
  }, [keyboard, setActiveDevice]);
  // `boardViewportRef` goes on the overflow-scrolling viewport around the
  // interactive board; its width is independent of the board's, so auto-fit can
  // measure it without feedback. `autoFitZoom` is non-null only while
  // 预览区域自适应大小 is on, overriding the discrete 预览区域缩放 level so the
  // board tracks the window width as it changes.
  const { ref: boardViewportRef, zoom: autoFitZoom } = useAutoFitZoom(keyboard);

  // The selected key/encoder's write paths (assign, dual-role hold write,
  // right-click context assign, `.vil` export/import) and auto-advance setting —
  // see src/hooks/useKeySelection.ts. `selected`/`setSelected` stay here (not
  // inside the hook) since `nav`/`conn`'s callbacks above need to clear the
  // selection before `keyboard` (this hook's input) exists.
  const {
    autoAdvance,
    setAutoAdvance,
    importing,
    justModified,
    handleAssign,
    handleHoldWrite,
    handleContextAssign,
    handleExport,
    handleImportFile,
  } = useKeySelection({ keyboard, layer, productName, selected, setSelected });

  if (conn.status === "reconnecting") {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-background">
        <SpinnerIcon className="h-10 w-10 animate-spin text-brand-primary" />
      </div>
    );
  }

  const connected = conn.status === "connected";
  const inTransition = conn.transition !== "none";
  // Keep the waiting page mounted through the transition so its 3D model
  // (three.js scene) isn't torn down and re-created mid-animation.
  const showWaiting = !connected || inTransition;
  // Only connect uses the waiting page's 3D-model zoom/curtain; disconnect
  // has its own black curtain (below) and never touches it.
  const waitingZoom = conn.transition === "zoom" || conn.transition === "rise";
  const disconnecting = conn.transition === "darken" || conn.transition === "reveal";

  return (
    <>
      {connected && (
        <div
          key="config"
          // During the rise transition this becomes a fixed, self-scrolling overlay; tell Lenis to
          // leave it alone. Omitted otherwise — on the normal page this div wraps everything, and a
          // permanent data-lenis-prevent here would stop Lenis from scrolling the page at all.
          {...(inTransition ? { "data-lenis-prevent": "" } : {})}
          className={
            inTransition
              ? `fixed inset-0 ${disconnecting ? "z-30" : "z-50"} overflow-y-auto bg-[#E9E6E6] dark:bg-black/30 dark:backdrop-blur-md`
              : "min-h-screen bg-[#E9E6E6] dark:bg-brand-background"
          }
          style={
            inTransition
              ? {
                  // Disconnect never moves the config page itself — it just sits still
                  // under the black curtain while the waiting page slides down over it.
                  transform: conn.transition === "zoom" ? "translateY(100%)" : "translateY(0)",
                  transition:
                    conn.transition === "rise" ? "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
                }
              : undefined
          }
        >
          {nav.mode === "newHome" && keyboard ? (
            <NewHomePage
              keyboard={keyboard}
              layer={layer}
              productName={productName}
              onDisconnect={conn.handleDisconnect}
              onNavigatePush={(next) => nav.navigateSlide(next, "push")}
              onGoToKeymap={nav.handleGoToKeymap}
              onPersonalize={nav.handlePersonalize}
              suppressHeroName={nav.heroNameSuppressed}
            />
          ) : nav.mode === "siteConfig" ? (
            <SiteConfigPage onExit={() => nav.navigateSlide("newHome", "push-back")} />
          ) : (
            <>
          {/* Shared page shell for every mode besides 首页/网站配置: just a
              CornerCloseButton back to NewHomePage. No top Navbar, no left
              sidebar — NewHomePage's own menu (and the deep links off
              individual panels, e.g. QuickConfigPanel's "详细设置") are the
              only way into these pages. 键盘配置 reverses its hero-morph entry;
              个性化 handles its own animated back internally (this button is a
              plain fallback for its non-fullscreen view); every other mode
              gets the mirrored "push-back" slide. */}
          <CornerCloseButton
            ref={nav.cornerCloseRef}
            onClick={() => {
              if (nav.mode === "keymap") {
                nav.handleBackToHome(nav.cornerCloseRef.current);
              } else if (nav.mode === "color") {
                nav.navigate("newHome");
              } else {
                nav.navigateBack();
              }
            }}
            label={t("navBackToNewHome")}
            active
          />
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-[1600px]">
            <main className="min-w-0 p-6 md:p-8">
              <div key={nav.mode} className="page-transition">
              {nav.mode !== "keymap" && (
              <div className="mb-6">
                <div className="flex items-center gap-2">
                  <h1 className="text-3xl font-bold text-brand-on-surface">
                    {nav.mode === "matrix"
                      ? t("navMatrixTest")
                      : nav.mode === "macro"
                        ? t("navMacro")
                        : nav.mode === "tapdance"
                          ? t("navTapDance")
                          : nav.mode === "combo"
                            ? t("navCombo")
                            : nav.mode === "rgb"
                              ? t("navRgb")
                            : nav.mode === "color"
                              ? t("navKeyboardColor")
                              : nav.mode === "advanced"
                                ? t("navAdvanced")
                                : nav.mode === "preview3d"
                                  ? t("navPreview3d")
                                  : t("navNewHome")}
                  </h1>
                  {nav.mode === "preview3d" && <HelpIcon text={t("preview3dHint")} />}
                  {nav.mode === "macro" && <HelpIcon text={t("macroHint")} />}
                  {nav.mode === "tapdance" && <HelpIcon text={t("tapDanceHint")} />}
                  {nav.mode === "combo" && <HelpIcon text={t("comboHint")} />}
                  {nav.mode === "rgb" && <HelpIcon text={t("rgbHint")} />}
                </div>
                {nav.mode === "matrix" && (
                  <p className="mt-1 text-brand-on-surface-variant">{t("matrixInstructions")}</p>
                )}
              </div>
              )}
              {keyboard && nav.mode === "keymap" && (
                <>
                  {/* Layer tabs stay in normal flow (scroll away); only the
                      board below is pinned — same split as the 键盘配色 page
                      (see KeyboardColorPanel). Both are direct siblings of the
                      quick-config section below (not wrapped in their own
                      short div) so the sticky board's containing block spans
                      the whole scrollable page, giving it room to stay pinned
                      while the (now much taller, three-section) quick-config
                      area scrolls underneath — a containing block no taller
                      than the tabs+board themselves would give sticky zero
                      room to travel and it would never visibly stick. */}
                  <LayerTabBar
                    layers={keyboard.layers}
                    active={layer}
                    onSelect={setLayer}
                    isConfigured={(l) => keyboard.isLayerConfigured(l)}
                    centered
                  />
                  {/* 吸顶:px/py 给外壳的立体投影(.keyboard-case-shaded 向下与
                      左右的 box-shadow)留出空间:overflow-x-auto 会让
                      overflow-y 计算为 auto,容器边缘会裁掉溢出的阴影,padding
                      区域不被裁剪。`mb-1.5`(而非等量抵消 pb-6 的 -mb-6)让底部
                      净留白净得 +30px,与 个性化 页吸顶键盘区/设置区之间的
                      gap-[30px] 对齐,统一两处页面置顶区与下方内容的间隔。
                      `top-0` 贴齐视口顶部(此处上方已无 Navbar);背景改用
                      .keyboard-preview-sticky 的渐变(见 index.css)——底部
                      24px 由不透明渐变为透明,让下方快捷配置区内容随滚动柔和
                      显现,而不是在容器边缘硬切,与 个性化 全屏页
                      BOARD_FADE_ZONE_HEIGHT 同款。 */}
                  <div
                    // Marks the keyboard preview so an expanded quick-config
                    // card below stays open when a key here is clicked — the
                    // click still re-selects the cap, it just doesn't collapse
                    // the card (see ExpandableCardColumn's outside-click close).
                    data-keyboard-preview
                    ref={boardViewportRef}
                    className="keyboard-preview-sticky sticky top-0 z-10 -mx-4 mb-1.5 -mt-2 overflow-x-auto px-4 pb-6 pt-2"
                  >
                    <div key={layer} className="tab-panel-appear flex w-full justify-center">
                      {/* `justify-center`: a board narrower than the viewport (small
                          layouts, or auto-fit not needing to shrink to full width)
                          would otherwise sit flush left, off-axis from the centered
                          layer tabs above it (see `centered` on that LayerTabBar).
                          Nested (not on the tab-panel-appear div itself) so this
                          element's own view-transition-group morph animation
                          doesn't fight the mount keyframe above it — only tagged
                          with KEYBOARD_HERO_NAME for the brief window
                          handleGoToKeymap/handleBackToHome are morphing it
                          to/from NewHomePage's hero preview. */}
                      <div
                        style={{
                          viewTransitionName: nav.heroNavAnimating ? KEYBOARD_HERO_NAME : undefined,
                        }}
                      >
                        <KeyboardLayoutEditor
                          keyboard={keyboard}
                          layer={layer}
                          zoomOverride={autoFitZoom}
                          selected={selected}
                          onKeySelect={(row, col, part) => {
                            // Clicking the hold band selects that sub-part, which
                            // swaps the quick-config grid below for the dedicated
                            // dual-role editor; the top / whole cap toggles selection
                            // for the normal quick-config + picker flow.
                            if (part === "hold") {
                              setSelected({ kind: "key", row, col, part: "hold" });
                              return;
                            }
                            setSelected((prev) =>
                              prev?.kind === "key" &&
                              prev.row === row &&
                              prev.col === col &&
                              prev.part === part
                                ? null
                                : { kind: "key", row, col, ...(part ? { part } : {}) },
                            );
                          }}
                          onEncoderSelect={(index, direction) =>
                            setSelected({ kind: "encoder", index, direction })
                          }
                          onContextAssign={handleContextAssign}
                        />
                      </div>
                    </div>
                  </div>
                  {/* 修改成功提示:固定高度占位避免出现/消失时内容跳动;透明度过渡
                      而非直接切换 display,退场更柔和。计时逻辑(含"连续修改则重置
                      计时")在 useKeySelection 的 markModified 里。 */}
                  <p
                    className="mt-1.5 h-4 text-center text-xs text-success transition-opacity duration-150"
                    style={{ opacity: justModified ? 1 : 0 }}
                    aria-live="polite"
                  >
                    {t("keyModifiedSuccess")}
                  </p>
                  {/* 按键配置区:与上面的预览一样标记出来,点击这里不会清空选中态
                      (清空逻辑见文件顶部的 pointerdown 监听)。 */}
                  <div data-key-config>
                  {/* 个性化:预览与配置区之间的一行横向按钮(配置键盘颜色 / 导出
                      当前层图片 / 导出所有层图片)。放在 data-key-config 内,点它
                      不会清空当前选中的按键;放在快捷配置的置灰包裹层之外,未选中
                      按键时照样可用。 */}
                  <PersonalizationSection
                    keyboard={keyboard}
                    layer={layer}
                    productName={productName}
                    zoomOverride={autoFitZoom}
                    onOpenPersonalization={nav.handlePersonalize}
                  />
                  {/* 与 个性化 页互切时,这块「键盘预览下方的配置区」是动画主角:
                      离场时下滑淡出、入场时上滑淡入(见 configSwapName 与
                      index.css 的 config-area-slide-out/in)。名字只在那一次导航
                      期间挂上,平时是 undefined。上面那排个性化按钮刻意留在外面
                      ——两个页面的按钮排在同一位置且几乎一样,让它跟随 root 交叉
                      淡化,视觉上就像切换过程中它一直站在原地。 */}
                  <div
                    style={{ viewTransitionName: configSwapName(nav.configSwapFrom, "keymap") }}
                  >
                  {selected?.kind === "key" && selected.part === "hold" ? (
                    <DualRoleEditor
                      key={`${selected.row},${selected.col}`}
                      qmkId={keyboard.getKey(layer, selected.row, selected.col)}
                      layerCount={keyboard.layers}
                      onWrite={handleHoldWrite}
                    />
                  ) : (
                    // 快捷配置始终显示;未选中按键时整体置灰且不可交互(提示浮在
                    // 模拟键盘上)。置灰在面板内部按块处理,以便提示徽标保持不透明
                    // ——祖先若用 opacity 会连带把徽标一起变透明。
                    //
                    // 「不可交互」只拦截激活类事件(点击 / 按下 / 键盘),不用
                    // pointer-events-none:后者会让整块不参与命中测试,连滚轮都收不到,
                    // 于是未选中按键时快捷配置区就没法横向滚动了。
                    <section className="mt-6">
                      <div
                        aria-disabled={!selected}
                        className={selected ? undefined : "select-none"}
                        {...(selected
                          ? {}
                          : {
                              onClickCapture: swallowEvent,
                              onPointerDownCapture: swallowEvent,
                              onMouseDownCapture: swallowEvent,
                              onKeyDownCapture: swallowEvent,
                            })}
                      >
                        <QuickConfigPanel
                          onPick={handleAssign}
                          keyboard={keyboard}
                          onNavigate={nav.navigate}
                          onOpenQmkSection={nav.openQmkSection}
                          autoAdvance={autoAdvance}
                          onAutoAdvanceChange={setAutoAdvance}
                          disabled={!selected}
                          // 选中双功能键的上半区(tap)时,只允许基础键码:除「功能」
                          // 列前三张卡片外的所有卡片置灰不可交互。
                          dualRoleTap={selected?.kind === "key" && selected.part === "tap"}
                          // 按键叠加(多功能)据此判断:选中键当前是基础键码时把它
                          // 叠进新框架的 tap 半区,否则(非基础键 / 未选中)清空重来。
                          currentQmkId={
                            selected?.kind === "key"
                              ? keyboard.getKey(layer, selected.row, selected.col)
                              : selected?.kind === "encoder"
                                ? keyboard.getEncoder(layer, selected.index, selected.direction)
                                : null
                          }
                          importing={importing}
                          onExport={handleExport}
                          onImportFile={handleImportFile}
                        />
                      </div>
                    </section>
                  )}
                  </div>
                  </div>
                </>
              )}
              {/* 纯展示页:只渲染当前图层的 3D 键盘,点击键帽不做任何事(选中态、
                  改键都留在首页的 2D 视图里)。 */}
              {keyboard && nav.mode === "preview3d" && (
                <>
                  <KeyboardLayout3D
                    keyboard={keyboard}
                    layer={layer}
                    params={preview3dParams}
                    onKeySelect={() => {}}
                    onEncoderSelect={() => {}}
                  />
                  <Preview3DDebugPanel
                    params={preview3dParams}
                    onChange={(next) => {
                      setPreview3dParams(next);
                      savePreview3DParams(next);
                    }}
                  />
                </>
              )}
              {keyboard && nav.mode === "matrix" && keyboard.supportsMatrixTester && (
                <MatrixTester keyboard={keyboard} />
              )}
              {keyboard && nav.mode === "macro" && <MacroPanel keyboard={keyboard} />}
              {keyboard && nav.mode === "tapdance" && (
                <TapDancePanel keyboard={keyboard} />
              )}
              {keyboard && nav.mode === "combo" && (
                <ComboPanel keyboard={keyboard} />
              )}
              {keyboard && nav.mode === "rgb" && <RgbPanel keyboard={keyboard} />}
              {keyboard && nav.mode === "advanced" && (
                <QmkSettingsPanel
                  keyboard={keyboard}
                  onSectionsChange={nav.handleQmkSectionsChange}
                  onPendingCountChange={nav.setQmkPendingCount}
                  leaveRequested={nav.qmkLeaveRequested}
                  onLeaveResolved={nav.handleQmkLeaveResolved}
                />
              )}
              {keyboard && nav.mode === "color" && (
                <KeyboardColorPanel
                  keyboard={keyboard}
                  productName={productName}
                  heroArriving={nav.heroNavAnimating}
                  configSwapFrom={nav.configSwapFrom}
                  onBackToHome={nav.handleBackToHome}
                  onOpenPreview3d={() => nav.navigateSlide("preview3d", "push")}
                  onOpenKeymap={nav.handleGoToKeymap}
                />
              )}
              </div>
            </main>
        </div>
      </div>
          {importing && <div className="io-busy-overlay" />}
            </>
          )}
        </div>
      )}
      {/* Disconnect's black curtain, fading in over the config page during "darken"
          and staying opaque through "reveal" so the waiting page below has a
          blackened backdrop to slide down over. Always mounted (rather than only
          while disconnecting) so the very first opacity change is a genuine CSS
          transition, not a same-frame mount-and-set that wouldn't animate. */}
      <div
        className="pointer-events-none fixed inset-0 z-40 bg-black transition-opacity duration-[350ms] ease-in"
        style={{ opacity: disconnecting ? 1 : 0 }}
      />
      {showWaiting && (
        <div
          key="waiting"
          className={`fixed inset-0 ${disconnecting ? "z-50" : "z-40"} ${
            inTransition ? "pointer-events-none" : ""
          }`}
          // Primed off-screen above during "darken" (no transition, so mounting
          // here doesn't itself animate), then slid down into view during "reveal".
          style={
            conn.transition === "darken"
              ? { transform: "translateY(-100%)", transition: "none" }
              : conn.transition === "reveal"
                ? { transform: "translateY(0)", transition: "transform 520ms cubic-bezier(0.4, 0, 0.2, 1)" }
                : undefined
          }
        >
          <WaitingForConnection
            status={conn.status}
            attaching={conn.attaching}
            error={conn.error}
            onConnect={conn.handleConnect}
            onConnectDemo={conn.handleConnectDemo}
            lastDeviceName={lastDeviceName}
            onReconnectSaved={conn.handleReconnectSaved}
            zoom={waitingZoom}
          />
        </div>
      )}
    </>
  );
}

export default App;
