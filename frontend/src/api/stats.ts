/**
 * 024 관리자 통계. 방문 기록(`POST /api/visits`)은 누구나, 통계(`GET /api/admin/stats`)는 관리자만 부른다. 날짜는 한국 시간
 * `YYYY-MM-DD`.
 */
import { apiGet, apiPost } from './client';
import type { Visibility } from './posts';

export interface StatCounts {
  total: number;
  today: number;
  last7Days: number;
}

export interface AdminStats {
  today: string;
  visitors: {
    today: number;
    yesterday: number;
    last7Days: number;
    last30Days: number;
    total: number;
    /** 처음 센 날. 아직 없으면 null */
    since: string | null;
  };
  /** 최근 30일, 오래된 날부터(오늘 포함) */
  daily: { date: string; visitors: number; memberVisitors: number; views: number }[];
  members: StatCounts;
  posts: StatCounts;
  comments: StatCounts;
  views: { today: number; last7Days: number; total: number };
  /** 최근 7일 많이 본 전체 공개 글 */
  topPosts: { postId: number; title: string; handle: string; views: number }[];
}

export function getAdminStats(): Promise<AdminStats> {
  return apiGet<AdminStats>('/api/admin/stats');
}

/** 방문 기록. 실패해도 화면에는 아무 영향이 없다. 보냈으면 true(실패면 다음 화면에서 다시 보낸다) */
export function recordSiteVisit(): Promise<boolean> {
  return apiPost('/api/visits', undefined, { notFoundScreen: false }).then(
    () => true,
    () => false,
  );
}

/**
 * 031 둥지 방문 기록(`POST /api/members/{handle}/visits`). 둥지 주인 본인·관리자·봇은 서버가 세지 않는다. 실패해도 화면에는 아무
 * 영향이 없다. 보냈으면 true(실패면 다음에 다시 보낸다)
 */
export function recordNestVisit(handle: string): Promise<boolean> {
  return apiPost(`/api/members/${encodeURIComponent(handle)}/visits`, undefined, {
    notFoundScreen: false,
  }).then(
    () => true,
    () => false,
  );
}

/** 내 둥지 통계(`GET /api/me/stats`, 로그인 본인 것만). 지운 글은 빼고, 받은 좋아요·댓글은 다른 사람이 남긴 것만 센다 */
export interface MyStats {
  today: string;
  /** 031 내 둥지 방문자(같은 사람은 하루 한 번, 나·관리자·검색 로봇 제외) */
  visitors: { today: number; last7Days: number; last30Days: number; total: number };
  views: { today: number; last7Days: number; last30Days: number; total: number };
  /** 최근 30일, 오래된 날부터(오늘 포함) */
  daily: { date: string; visitors: number; views: number; likes: number; comments: number }[];
  posts: StatCounts;
  likes: StatCounts;
  comments: StatCounts;
  /** 최근 30일 많이 본 내 글(공개 범위 무관) */
  topPosts: { postId: number; title: string; visibility: Visibility; views: number }[];
}

export function getMyStats(): Promise<MyStats> {
  return apiGet<MyStats>('/api/me/stats');
}
