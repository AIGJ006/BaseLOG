import { useEffect, useState } from 'react';
import { getMemberNest, type NestLook } from '../../api/nest';
import DefaultAvatar from '../../components/DefaultAvatar';
import NestScene from './NestScene';

/** 둥지 프로필 사진 크기(px). 실제 크기는 nest.css의 `--blog-avatar-size`(컴퓨터 160, 휴대폰 120)가 정한다 */
const BLOG_AVATAR_SIZE = 160;
/** 새로 뒤집었을 때 둥지 그림을 동그라미보다 이만큼 크게 그려 새 둘레만 보이게 한다 */
const BIRD_ZOOM = 1.7;

/** 둥지 모습을 못 불러오면(새 키우기를 안 한 사람 등) 1단계 기본 새를 보인다 */
const FIRST_BIRD: NestLook = {
  level: 1,
  levelName: '아기 새',
  streakDays: 0,
  background: 'bg-basic',
  nestType: 'nest-basic',
  decorations: [],
};

interface BlogAvatarProps {
  handle: string;
  nickname: string;
  profileImageUrl: string | null;
}

/**
 * 둥지 프로필 사진 (021, 2026-10-16 민서). 누구 둥지든 사진을 누를 때마다 그 사람이 키운 새 그림과 사진이 번갈아 보인다(아래 끝 🐣
 * 표시). 따로 켜고 끄는 설정은 없다(2026-10-16 민서 "무조건 새 나오게, 설정 없애 줘").
 */
export default function BlogAvatar({ handle, nickname, profileImageUrl }: BlogAvatarProps) {
  const [look, setLook] = useState<NestLook>(FIRST_BIRD);
  const [showBird, setShowBird] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMemberNest(handle)
      .then((found) => {
        if (!cancelled) {
          setLook(found);
        }
      })
      .catch(() => {
        // 못 불러오면 기본 새 그대로
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  const photo = profileImageUrl ? (
    <img
      src={profileImageUrl}
      data-testid="blog-avatar"
      alt=""
      width={BLOG_AVATAR_SIZE}
      height={BLOG_AVATAR_SIZE}
      className="blog-avatar__photo"
    />
  ) : (
    <span className="blog-avatar__default">
      <DefaultAvatar nickname={nickname} handle={handle} size={BLOG_AVATAR_SIZE} />
    </span>
  );

  return (
    <button
      type="button"
      className="blog-avatar__flip"
      aria-pressed={showBird}
      aria-label={`${nickname} 님의 새 보기`}
      onClick={() => setShowBird((shown) => !shown)}
    >
      {showBird ? (
        <span className="blog-avatar__bird" data-testid="blog-bird">
          <span
            className="blog-avatar__scene"
            style={{
              left: `${50 - BIRD_ZOOM * 50}%`,
              top: `${50 - BIRD_ZOOM * 0.8 * 47}%`,
              width: `${BIRD_ZOOM * 100}%`,
            }}
          >
            <NestScene look={look} width="100%" />
          </span>
        </span>
      ) : (
        photo
      )}
      <span className="blog-avatar__badge" aria-hidden="true">
        {showBird ? '🙂' : '🐣'}
      </span>
    </button>
  );
}
