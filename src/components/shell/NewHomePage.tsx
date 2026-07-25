import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";

interface Props {
  onNavigate: (mode: "keymap") => void;
}

/**
 * 新版首页,清空重来的过渡态:仅展示 "Hello World" 占位文案,右下角保留一个退出
 * 悬浮按钮退回旧版 Navbar/Sidebar 布局(mode "keymap")。此前的 hero 键盘预览、菜单项
 * 退出动画、HomeSitePage 子页面路由已一并移除,后续从这块空白画布上重新搭建。
 */
export function NewHomePage({ onNavigate }: Props) {
  const { t } = useI18n();

  return (
    <div className="relative flex h-screen items-center justify-center bg-black text-brand-on-surface">
      <span className="text-3xl font-bold">Hello World</span>
      <button
        type="button"
        onClick={() => onNavigate("keymap")}
        aria-label={t("navExitNewHome")}
        className="fixed bottom-6 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-brand-on-surface-variant backdrop-blur transition hover:bg-red-500/20 hover:text-red-500"
      >
        <Icon icon="mdi:close" className="h-6 w-6" />
      </button>
    </div>
  );
}
