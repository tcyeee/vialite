import { useState } from "react";
import { useI18n } from "../../../contexts/i18n.tsx";
import { deserialize, serialize } from "../../../protocol/keycodes.ts";

interface Props {
  onPick: (qmkId: string) => void;
}

/**
 * 清空 / 穿透 / 任意按键三个快捷按钮,在基础按键(BasicKeyboardGrid)下方单开一行,
 * 三个按钮横向排布(无外框)。"任意按键" 弹出一个自由输入框,解析后归一化为 qmk_id
 * 再赋值。
 */
export function SpecialKeyButtons({ onPick }: Props) {
  const { t } = useI18n();
  const [anyOpen, setAnyOpen] = useState(false);
  const [anyValue, setAnyValue] = useState("");
  const [anyError, setAnyError] = useState<string | null>(null);

  const closeAny = () => {
    setAnyOpen(false);
    setAnyValue("");
    setAnyError(null);
  };

  const submitAny = () => {
    const text = anyValue.trim();
    if (!text) return;
    try {
      const qmkId = serialize(deserialize(text));
      onPick(qmkId);
      closeAny();
    } catch (err) {
      setAnyError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col items-start">
      <h4 className="mb-2 text-sm font-semibold opacity-70">{t("specialKeys")}</h4>
      <div className="flex flex-row flex-wrap items-center gap-2">
        <button
          className="btn btn-sm btn-outline"
          title={t("clearNoTitle")}
          onClick={() => onPick("KC_NO")}
        >
          {t("specialClear")}
        </button>
        <button
          className="btn btn-sm btn-outline"
          title={t("clearTransTitle")}
          onClick={() => onPick("KC_TRNS")}
        >
          {t("specialTransparent")}
        </button>
        <button className="btn btn-sm btn-outline" onClick={() => setAnyOpen(true)}>
          {t("specialAny")}
        </button>
      </div>

      <dialog className={`modal${anyOpen ? " modal-open" : ""}`}>
        <div className="modal-box">
          <h3 className="text-base font-semibold">{t("anyKeycodeHeading")}</h3>
          <p className="mt-1 text-sm opacity-60">{t("anyKeyPlaceholder")}</p>
          <input
            type="text"
            className="input input-bordered mt-4 w-full"
            placeholder={t("anyKeyPlaceholder")}
            value={anyValue}
            autoFocus
            onChange={(e) => {
              setAnyValue(e.target.value);
              setAnyError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitAny();
            }}
          />
          {anyError && (
            <div className="alert alert-error alert-soft mt-3 py-1 text-sm">
              <span>{anyError}</span>
            </div>
          )}
          <div className="modal-action">
            <button className="btn btn-sm" onClick={closeAny}>
              {t("cancel")}
            </button>
            <button className="btn btn-sm btn-primary" onClick={submitAny}>
              {t("set")}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={closeAny}>
            close
          </button>
        </form>
      </dialog>
    </div>
  );
}
