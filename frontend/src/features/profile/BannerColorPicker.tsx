import { useId, useState, type ChangeEvent } from 'react';
import { BANNER_COLOR_PRESETS, bannerColorStyle, normalizeBannerColor } from './bannerColor';

/**
 * 025 배너 색 고르기 (2026-10-15 민서 요청, 디스코드 "배너 색상" 방식). 추천 색 + 직접 고르기(색 고르기 창·#16진수) +
 * [기본색으로]. 배너 사진이 있으면 사진이 먼저 보이고, 색은 사진이 없을 때 칠한다. null = 기본 배경(--color-brand-soft).
 */
export default function BannerColorPicker({
  value,
  onChange,
}: Readonly<{ value: string | null; onChange: (color: string | null) => void }>) {
  const id = useId();
  const [text, setText] = useState(value ?? '');
  const [invalid, setInvalid] = useState(false);

  // 밖에서 값이 바뀌면(추천 색 누름·저장 뒤) 색 코드 칸도 맞춘다
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setText(value ?? '');
    setInvalid(false);
  }

  function onText(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setText(next);
    if (next.trim() === '') {
      setInvalid(false);
      return;
    }
    const color = normalizeBannerColor(next);
    setInvalid(color === null);
    if (color !== null && color !== value) {
      onChange(color);
    }
  }

  const isPreset = BANNER_COLOR_PRESETS.some((p) => p.value === value);

  return (
    <div className="banner-color" role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className="banner-color__label">
        배너 색
      </span>
      <p id={`${id}-help`} className="field-help">
        배너 사진이 없을 때 이 색으로 채워요
      </p>
      <div className="banner-color__swatches">
        <button
          type="button"
          className="banner-color__swatch banner-color__swatch--default"
          aria-pressed={value === null}
          aria-label="기본색"
          title="기본색"
          onClick={() => onChange(null)}
        />
        {BANNER_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            className="banner-color__swatch"
            style={bannerColorStyle(preset.value)}
            aria-pressed={value === preset.value}
            aria-label={preset.name}
            title={preset.name}
            onClick={() => onChange(preset.value)}
          />
        ))}
        <label
          className="banner-color__swatch banner-color__swatch--custom"
          data-active={value !== null && !isPreset ? 'true' : undefined}
          style={value !== null && !isPreset ? bannerColorStyle(value) : undefined}
          title="직접 고르기"
        >
          <span aria-hidden="true">+</span>
          <span className="visually-hidden">직접 고르기</span>
          <input
            type="color"
            value={value ?? BANNER_COLOR_PRESETS[0].value}
            onChange={(event) => onChange(event.target.value.toLowerCase())}
          />
        </label>
      </div>
      <div className="banner-color__hex">
        <label htmlFor={`${id}-hex`}>색 코드</label>
        <input
          id={`${id}-hex`}
          value={text}
          onChange={onText}
          placeholder={BANNER_COLOR_PRESETS[0].value}
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : `${id}-help`}
        />
        {value !== null ? (
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            기본색으로
          </button>
        ) : null}
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          #과 16진수 6자리로 적어 주세요
        </p>
      ) : null}
    </div>
  );
}
