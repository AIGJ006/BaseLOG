import { useEffect, useState } from 'react';
import { getSocialProviders, type SocialProvider } from '../../api/auth';

/**
 * 앱 키가 설정된 소셜 제공자 목록. 처음엔 `null`(읽는 중), 실패하면 빈 목록.
 */
export function useSocialProviders(): SocialProvider[] | null {
  const [providers, setProviders] = useState<SocialProvider[] | null>(null);
  useEffect(() => {
    let active = true;
    getSocialProviders()
      .then((value) => active && setProviders(value.providers))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, []);
  return providers;
}
