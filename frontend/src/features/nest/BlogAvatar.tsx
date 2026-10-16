import { useEffect, useState } from 'react';
import { getMemberNest, type NestLook } from '../../api/nest';
import DefaultAvatar from '../../components/DefaultAvatar';
import NestScene from './NestScene';

/** 둥지 프로필 사진 크기(px). 2026-10-16 민서 "동그라미를 좀 키워봐"로 64 → 128, 배너에 걸치지 않고 아래에 둔다 */
const BLOG_AVATAR_SIZE = 128;
/** 새로 뒤집었을 때 둥지 그림을 동그라미보다 이만큼 크게 그려 새 둘레만 보이게 한다 */
const BIRD_ZOOM = 1.7;

interface BlogAvatarProps {
  handle: string;
  nickname: string;
  profileImageUrl: string | null;
}

/**
 * 둥지 프로필 사진 (021, 2026-10-16 민서). 주인이 설정 > 프로필에서 "내 둥지에 새 보이기"를 켰으면 사진을 누를 때마다 내 새 그림과
 * 사진이 번갈아 보인다(아래 끝 🐣 표시). 꺼져 있거나 둥지를 못 불러오면 그냥 사진이다.
 */
export default function BlogAvatar({ handle, nickname, profileImageUrl }: BlogAvatarProps) {
  const [look, setLook] = useState<NestLook | null>(null);
  const [showBird, setShowBird] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMemberNest(handle)
      .then((found) => {
        if (!cancelled) {
          setLook(found.showOnBlog ? found : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLook(null);
        }
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
    <DefaultAvatar nickname={nickname} handle={handle} size={BLOG_AVATAR_SIZE} />
  );

  if (!look) {
    return photo;
  }
  const sceneWidth = BLOG_AVATAR_SIZE * BIRD_ZOOM;
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
              left: BLOG_AVATAR_SIZE / 2 - sceneWidth / 2,
              top: BLOG_AVATAR_SIZE / 2 - sceneWidth * 0.8 * 0.56,
            }}
          >
            <NestScene look={look} width={sceneWidth} />
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
