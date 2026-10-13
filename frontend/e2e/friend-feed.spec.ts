import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { createPost, hasAccount, login, setScreen } from './support';

/**
 * 친구·피드 화면 확인: 요청 → 상대가 수락 → 피드에 친구의 공개 글 → 끊기.
 *
 * 회원 셋을 환경 변수로 받는다(모두 이메일 인증, 비밀번호 `E2E_PASSWORD`):
 * - B 작성자 `E2E_EMAIL` — 공개 글 둘·비공개 글 하나
 * - A 독자 `E2E_READER_EMAIL` — B의 블로그에서 친구 요청을 보낸다
 * - D `E2E_LONELY_EMAIL` — 친구가 없다(시작할 때 남은 친구를 끊는다)
 *
 * 같은 회원을 다른 spec·지난 실행이 쓰므로 A·B 관계는 시작할 때 지우고, 친구 수는 시작 값에서 늘고 주는지만 본다.
 */
const READER_EMAIL = process.env.E2E_READER_EMAIL ?? '';
const LONELY_EMAIL = process.env.E2E_LONELY_EMAIL ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? '';

async function newPage(browser: Browser): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext();
  return { context, page: await context.newPage() };
}

async function token(page: Page): Promise<string> {
  await page.request.get('/api/auth/csrf');
  const state = await page.request.storageState();
  return decodeURIComponent(state.cookies.find((c) => c.name === 'XSRF-TOKEN')?.value ?? '');
}

async function loginAs(page: Page, email: string): Promise<void> {
  const response = await page.request.post('/api/auth/login', {
    form: { email, password: PASSWORD },
    headers: { 'X-XSRF-TOKEN': await token(page) },
  });
  expect(response.status(), await response.text()).toBe(200);
}

/** 상태를 바꾸는 API 호출 (CSRF 헤더 포함, 2xx 확인). */
async function call(
  page: Page,
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await page.request.fetch(path, {
    method,
    data,
    headers: { 'X-XSRF-TOKEN': await token(page), ...headers },
  });
  expect(response.status(), `${method} ${path}: ${await response.text()}`).toBeLessThan(300);
  return response;
}

async function handleOf(page: Page): Promise<string> {
  const response = await page.request.get('/api/me');
  expect(response.status()).toBe(200);
  return ((await response.json()) as { handle: string }).handle;
}

async function friendCountOf(page: Page, handle: string): Promise<number> {
  const response = await page.request.get(`/api/members/${encodeURIComponent(handle)}`);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { friendCount: number }).friendCount;
}

function friendPath(handle: string): string {
  return `/api/members/${encodeURIComponent(handle)}/friend`;
}

async function write(
  page: Page,
  title: string,
  visibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC',
): Promise<{ id: number; path: string }> {
  const id = await createPost(page, { title, contentMd: '본문' });
  const response = await call(
    page,
    'POST',
    `/api/posts/${id}/publish`,
    { title, contentMd: `${title} 본문`, tags: [], visibility, baseVersion: 0 },
    { 'Idempotency-Key': crypto.randomUUID() },
  );
  const { url } = (await response.json()) as { url: string };
  return { id, path: new URL(url, 'http://localhost').pathname };
}

async function noHorizontalScroll(page: Page): Promise<void> {
  const size = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(size.scrollWidth).toBeLessThanOrEqual(size.innerWidth);
}

test.describe('친구·피드', () => {
  test.skip(
    !hasAccount || READER_EMAIL === '' || LONELY_EMAIL === '',
    'E2E_EMAIL·E2E_READER_EMAIL·E2E_LONELY_EMAIL·E2E_PASSWORD가 필요합니다',
  );
  test.skip(({ isMobile }) => isMobile, '폭은 시험 안에서 직접 바꾼다 — desktop 프로젝트에서만');

  test('요청 → 수락 → 피드 → 끊기', async ({ browser }) => {
    test.setTimeout(180_000);
    const stamp = Date.now().toString(36);

    // 1) B 글, A·B 관계는 비운 채로 시작
    const b = await newPage(browser);
    await login(b.page);
    const bHandle = await handleOf(b.page);
    await write(b.page, `B 공개 하나 ${stamp}`);
    const bPost = await write(b.page, `B 공개 둘 ${stamp}`);
    await write(b.page, `B 비공개 ${stamp}`, 'PRIVATE');
    const a = await newPage(browser);
    await loginAs(a.page, READER_EMAIL);
    const aHandle = await handleOf(a.page);
    await call(a.page, 'DELETE', friendPath(bHandle));
    const startCount = await friendCountOf(a.page, bHandle);

    // 2) A로 B 블로그 → "공개 글 N · 친구 N"(링크 아님) → [친구 요청] → [요청 취소], 친구 수는 그대로
    await a.page.goto(`/@${bHandle}`);
    const counts = a.page.getByTestId('blog-counts');
    await expect(counts).toContainText(`친구 ${startCount.toLocaleString('ko-KR')}`);
    await expect(counts.getByRole('link')).toHaveCount(0);
    const area = a.page.locator('.friend-button');
    const put = a.page.waitForResponse(
      (r) => r.url().endsWith(friendPath(bHandle)) && r.request().method() === 'PUT',
    );
    await area.getByRole('button', { name: '친구 요청' }).click();
    expect((await put).status()).toBe(200);
    await expect(area.getByRole('button', { name: '요청 취소' })).toBeVisible();
    await expect(area).toHaveAttribute('data-status', 'REQUEST_SENT');
    await expect(counts).toContainText(`친구 ${startCount.toLocaleString('ko-KR')}`);

    // 3) B로 A 블로그 → [수락]·[거절] → [수락] → [친구 ✓]
    await b.page.goto(`/@${aHandle}`);
    const bArea = b.page.locator('.friend-button');
    await expect(bArea.getByRole('button', { name: '거절' })).toBeVisible();
    await bArea.getByRole('button', { name: '수락' }).click();
    await expect(bArea.getByRole('button', { name: '친구 끊기' })).toHaveText('친구 ✓');

    // 4) A가 B 블로그를 새로 고치면 [친구 ✓], 친구 수 +1. 글 상세 작성자 카드도 [친구 ✓]
    await a.page.reload();
    await expect(area.getByRole('button', { name: '친구 끊기' })).toBeVisible();
    await expect(counts).toContainText(`친구 ${(startCount + 1).toLocaleString('ko-KR')}`);
    await a.page.goto(bPost.path);
    await expect(
      a.page.getByTestId('author-card').getByRole('button', { name: '친구 끊기' }),
    ).toBeVisible();

    // 5) 계정 메뉴 [친구 관리] → 피드 탭: B 공개 글만 최신순, 비공개 없음
    await a.page
      .getByRole('banner')
      .getByRole('button', { name: /계정 메뉴/ })
      .click();
    await a.page.getByRole('banner').getByRole('link', { name: '친구 관리' }).click();
    await expect(a.page).toHaveURL(/\/friends$/);
    const titles = a.page.getByTestId('card-title');
    await expect(titles.first()).toHaveText(`B 공개 둘 ${stamp}`);
    const texts = await titles.allTextContents();
    expect(texts.slice(0, 2)).toEqual([`B 공개 둘 ${stamp}`, `B 공개 하나 ${stamp}`]);
    expect(texts).not.toContain(`B 비공개 ${stamp}`);

    // 6) 글을 열고 뒤로 → 요청 없이 카드 그대로
    const before = texts.length;
    let feedRequests = 0;
    a.page.on('request', (r) => {
      if (new URL(r.url()).pathname === '/api/feed') {
        feedRequests += 1;
      }
    });
    await titles.first().click();
    await expect(a.page).toHaveURL(new RegExp(`${bPost.path}$`));
    await a.page.goBack();
    await expect(titles).toHaveCount(before);
    expect(feedRequests).toBe(0);

    // 7) 내 블로그의 친구 수는 친구 화면의 내 친구 탭 링크
    await b.page.goto(`/@${bHandle}`);
    await b.page.getByTestId('blog-counts').getByRole('link', { name: /^친구/ }).click();
    await expect(b.page).toHaveURL(/\/friends\?tab=friends$/);
    await expect(
      b.page.getByRole('region', { name: '내 친구' }).getByText(`@${aHandle}`),
    ).toBeVisible();

    // 8) 비로그인: [친구 요청]은 로그인 화면으로. /friends는 로그인으로, 머리말에 [피드] 없음
    const anon = await newPage(browser);
    await anon.page.goto(`/@${bHandle}`);
    await anon.page.getByRole('button', { name: '친구 요청' }).click();
    await expect(anon.page).toHaveURL(/\/login\?returnTo=/);
    await expect(anon.page.getByRole('banner').getByRole('link', { name: '피드' })).toHaveCount(0);
    await anon.page.goto('/friends');
    await expect(anon.page).toHaveURL(/\/login\?returnTo=%2Ffriends$/);
    expect((await anon.page.request.get('/api/feed')).status()).toBe(401);

    // 9) 친구가 없는 D — 남은 친구를 먼저 끊는다
    const d = await newPage(browser);
    await loginAs(d.page, LONELY_EMAIL);
    const friends = (await (await d.page.request.get('/api/me/friends')).json()) as {
      items: { handle: string }[];
    };
    for (const friend of friends.items) {
      await call(d.page, 'DELETE', friendPath(friend.handle));
    }
    await d.page.goto('/friends');
    await expect(d.page.getByTestId('empty-feed')).toContainText(
      '아직 친구가 없어요. 홈에서 마음에 드는 블로그를 찾아 친구 요청을 보내 보세요',
    );
    await expect(d.page.getByTestId('empty-feed').getByRole('link', { name: '홈' })).toBeVisible();

    // 10) 375px: 가로 스크롤 없음, 친구 버튼 44px 이상
    await setScreen(a.page, { width: 375, height: 812 });
    for (const path of ['/friends', `/@${bHandle}`]) {
      await a.page.goto(path);
      await a.page.waitForLoadState('networkidle');
      await noHorizontalScroll(a.page);
    }
    const friendsButton = area.getByRole('button', { name: '친구 끊기' });
    const box = await friendsButton.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    // 11) [친구 ✓] → 확인 창 [끊기] → [친구 요청], 친구 수 원래대로. 피드에서 B 글이 빠진다
    await friendsButton.click();
    await a.page.getByRole('dialog').getByRole('button', { name: '끊기' }).click();
    await expect(area.getByRole('button', { name: '친구 요청' })).toBeVisible();
    await expect(counts).toContainText(`친구 ${startCount.toLocaleString('ko-KR')}`);
    await a.page.goto('/friends');
    await a.page.waitForLoadState('networkidle');
    await expect(a.page.getByTestId('card-title').filter({ hasText: stamp })).toHaveCount(0);

    for (const ctx of [a, b, d, anon]) {
      await ctx.context.close();
    }
  });
});
