/**
 * 친구·피드 화면 문구. 끝에 마침표를 붙이지 않는다(README "정해진 것").
 */
export const FRIEND_MESSAGES = {
  /** 피드: 친구가 없을 때 (뒤에 [홈] 링크) */
  feedNoFriends: '아직 친구가 없어요. 홈에서 마음에 드는 둥지를 찾아 친구 요청을 보내 보세요',
  /** 피드: 친구는 있지만 공개 글이 없을 때 */
  feedNoPosts: '친구의 공개 글이 아직 없어요',
  /** 요청 실패 (서버가 이유를 주지 않았을 때) */
  failed: '잠시 후 다시 시도해 주세요',
} as const;

/** 친구 화면 (계정 메뉴 [친구]). 탭은 `?tab=`: 피드(기본)·받은 요청·내 친구 */
export type FriendsTab = 'feed' | 'requests' | 'friends';
export const FRIENDS_PATH = '/friends';
/** 알림(친구 요청)이 여는 곳. 서버 알림 주소와 같다 */
export const FRIEND_REQUESTS_PATH = `${FRIENDS_PATH}?tab=requests`;
/** 내 블로그 머리말의 친구 수가 여는 곳 */
export const MY_FRIENDS_PATH = `${FRIENDS_PATH}?tab=friends`;
