/**
 * 친구 피드 API. 요청은 001 `client.ts`를 쓴다(CSRF 헤더·오류 본문). 목록 크기 `size`는 보내지 않는다 — 서버가 설정값으로 고정한다.
 */
import { apiGet } from './client';
import type { PostCard } from './types/reading';

/** 친구 피드 한 페이지. 카드는 005 `PostCard` 그대로. */
export interface FeedPage {
  items: PostCard[];
  nextCursor: string | null;
  /** 수락된 친구가 한 명이라도 있는가. 첫 페이지가 비었을 때만 실제 값이고 그 밖에는 true */
  hasFriends: boolean;
}

/** 친구 피드 (로그인 필요 — 비회원은 401). 수락된 친구의 공개 글만 온다. */
export function getFeed(cursor?: string | null): Promise<FeedPage> {
  return apiGet<FeedPage>(cursor ? `/api/feed?cursor=${encodeURIComponent(cursor)}` : '/api/feed');
}
