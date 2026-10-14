/**
 * 024 관리자 통계. 방문 기록(`POST /api/visits`)은 누구나, 통계(`GET /api/admin/stats`)는 관리자만 부른다. 날짜는 한국 시간
 * `YYYY-MM-DD`.
 */
import { apiGet, apiPost } from './client';

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

/** 방문 기록. 실패해도 화면에는 아무 영향이 없다 */
export function recordSiteVisit(): Promise<void> {
  return apiPost('/api/visits', undefined, { notFoundScreen: false }).catch(() => undefined);
}
