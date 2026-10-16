import { useEffect, useState } from 'react';
import { getMyNest, setNestShowOnBlog } from '../../api/nest';
import '../notification/notification.css';

const FAILED_MESSAGE = '바꾸지 못했어요. 잠시 뒤에 다시 해 주세요';
const LOAD_FAILED_MESSAGE = '새 보이기 설정을 불러오지 못했어요. 새로 고쳐 주세요';

/**
 * 설정 > 프로필의 "내 둥지에 새 보이기" 스위치 (021, 2026-10-16 민서). 처음엔 꺼져 있고, 켜면 내 둥지 프로필 오른쪽에 내 새 액자가
 * 보인다. 누를 때마다 바로 저장한다(프로필 [저장]과 따로).
 */
export default function NestOnBlogSetting() {
  const [shown, setShown] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyNest()
      .then((me) => {
        if (!cancelled) {
          setShown(me.nest.showOnBlog ?? false);
        }
      })
      .catch(() => {
        // 지금 값을 모르면 꺼짐으로 보이지 않고 스위치를 막아 둔다
        if (!cancelled) {
          setLoadFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle() {
    if (shown === null || saving) {
      return;
    }
    const next = !shown;
    setShown(next);
    setError(null);
    setSaving(true);
    setNestShowOnBlog(next)
      .then((me) => setShown(me.nest.showOnBlog ?? next))
      .catch(() => {
        setShown(!next);
        setError(FAILED_MESSAGE);
      })
      .finally(() => setSaving(false));
  }

  return (
    <section aria-labelledby="nest-on-blog-title">
      <ul className="notification-settings-list">
        <li>
          <span id="nest-on-blog-title">내 둥지에 새 보이기</span>
          <button
            type="button"
            role="switch"
            className="notification-switch"
            aria-checked={shown ?? false}
            aria-labelledby="nest-on-blog-title"
            disabled={shown === null || saving}
            onClick={toggle}
          />
        </li>
      </ul>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {loadFailed ? <p className="field-help">{LOAD_FAILED_MESSAGE}</p> : null}
      <p className="field-help">켜면 내 둥지 프로필 사진을 누를 때 내가 키운 새가 보여요</p>
    </section>
  );
}
