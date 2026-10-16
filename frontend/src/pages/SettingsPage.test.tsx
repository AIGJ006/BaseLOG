import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../api/client';
import { SessionProvider } from '../features/auth/SessionProvider';
import { ME, errorBody, json, requestsTo, stubFetch } from '../test/fetchRoutes';
import SettingsPage from './SettingsPage';

vi.mock('../features/profile/uploadProfileImage', () => ({
  uploadProfileImage: vi.fn(async () => 55),
  uploadBannerImage: vi.fn(async () => 77),
}));

vi.mock('../components/ProfileImageCropper', () => ({
  default: ({
    onCropped,
    output,
  }: {
    onCropped: (blob: Blob) => void;
    output?: { width: number; height: number };
  }) => (
    <button
      type="button"
      data-output={output ? `${output.width}x${output.height}` : '기본'}
      onClick={() => onCropped(new Blob(['x'], { type: 'image/webp' }))}
    >
      가짜 자르기 완료
    </button>
  ),
}));

const PROFILE = {
  handle: 'kim755030',
  nickname: '김민서',
  bio: '백엔드 개발을 공부하고 있어요.',
  profileImageId: null,
  profileImageUrl: null,
  nicknameChangeAvailableAt: null,
  bannerImageId: null,
  bannerImageUrl: null,
  bannerColor: null,
};

const SETTINGS = {
  email: 'kim755030@naver.com',
  provider: 'LOCAL',
  previousLogin: null,
  defaultVisibility: 'PUBLIC',
  lastActiveVisible: true,
  passwordChangeAvailable: true,
};

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderPage(path = '/settings') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionProvider>
        <Where />
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/login" element={<p>로그인 화면</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}

function routes(overrides: Record<string, (init: RequestInit | undefined) => Response> = {}) {
  return stubFetch({
    'GET /api/me': () => json(200, ME),
    'GET /api/me/profile': () => json(200, PROFILE),
    'GET /api/me/settings': () => json(200, SETTINGS),
    'PATCH /api/me/profile': (init) => json(200, { ...PROFILE, ...JSON.parse(String(init?.body)) }),
    'PATCH /api/me/settings': (init) =>
      json(200, { ...SETTINGS, ...JSON.parse(String(init?.body)) }),
    ...overrides,
  });
}

function bodyOf(mock: ReturnType<typeof stubFetch>, method: string, path: string, index = 0) {
  return JSON.parse(String(requestsTo(mock, method, path)[index]?.[1]?.body));
}

beforeEach(() => resetClientForTests());
afterEach(() => vi.unstubAllGlobals());

describe('SettingsPage (FR-046~053)', () => {
  it('비로그인이면 로그인 화면으로 보내고 돌아올 곳을 남긴다', async () => {
    stubFetch({ 'GET /api/me': () => json(401, errorBody('LOGIN_REQUIRED', '로그인이 필요해요')) });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/login?returnTo=%2Fsettings'),
    );
  });

  it('왼쪽 탭으로 나뉘고, 기본은 프로필 · 탭을 누르면 ?tab=으로 바뀐다', async () => {
    routes();
    renderPage();
    const tabs = await screen.findByRole('tablist', { name: '설정' });
    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((t) => t.textContent),
    ).toEqual(['프로필', '계정', '화면', '알림', '이용약관']);
    expect(within(tabs).getByRole('tab', { name: '프로필' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('region', { name: '프로필' })).toBeVisible();
    expect(screen.queryByRole('region', { name: '계정' })).toBeNull();

    fireEvent.click(within(tabs).getByRole('tab', { name: '계정' }));

    expect(screen.getByTestId('where')).toHaveTextContent('/settings?tab=account');
    expect(screen.getByRole('region', { name: '계정' })).toBeVisible();
    expect(screen.queryByRole('region', { name: '프로필' })).toBeNull();
  });

  it('위·아래 방향키와 Home·End로 탭을 옮기며 고른다', async () => {
    routes();
    renderPage();
    const tabs = await screen.findByRole('tablist', { name: '설정' });
    expect(tabs).toHaveAttribute('aria-orientation', 'vertical');
    const profileTab = within(tabs).getByRole('tab', { name: '프로필' });
    profileTab.focus();

    fireEvent.keyDown(profileTab, { key: 'ArrowDown' });
    const accountTab = within(tabs).getByRole('tab', { name: '계정' });
    expect(accountTab).toHaveFocus();
    expect(accountTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('where')).toHaveTextContent('/settings?tab=account');

    fireEvent.keyDown(accountTab, { key: 'End' });
    expect(within(tabs).getByRole('tab', { name: '이용약관' })).toHaveFocus();

    fireEvent.keyDown(within(tabs).getByRole('tab', { name: '이용약관' }), { key: 'ArrowDown' });
    expect(profileTab).toHaveFocus();

    fireEvent.keyDown(profileTab, { key: 'ArrowUp' });
    expect(within(tabs).getByRole('tab', { name: '이용약관' })).toHaveFocus();
  });

  it('폰 너비에서는 탭이 가로라서 왼쪽·오른쪽 방향키로 옮긴다', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(max-width: 640px)',
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    routes();
    renderPage();
    const tabs = await screen.findByRole('tablist', { name: '설정' });
    expect(tabs).toHaveAttribute('aria-orientation', 'horizontal');
    const profileTab = within(tabs).getByRole('tab', { name: '프로필' });
    profileTab.focus();

    fireEvent.keyDown(profileTab, { key: 'ArrowDown' });
    expect(profileTab).toHaveFocus();
    fireEvent.keyDown(profileTab, { key: 'ArrowRight' });
    const accountTab = within(tabs).getByRole('tab', { name: '계정' });
    expect(accountTab).toHaveFocus();
    expect(accountTab).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(accountTab, { key: 'ArrowLeft' });
    expect(profileTab).toHaveFocus();
  });

  it('이용약관 탭에서 AI 동의와 약관 본문을 함께 본다', async () => {
    routes();
    renderPage('/settings?tab=terms');
    const terms = await screen.findByRole('region', { name: '이용약관' });
    expect(terms).toBeVisible();
    expect(within(terms).getByRole('heading', { level: 3, name: '1. 목적' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '이용약관' })).toHaveAttribute('aria-selected', 'true');
  });

  it('닉네임 조건을 보이고, 지금 닉네임이면 "지금 쓰는 닉네임이에요"', async () => {
    routes();
    renderPage();
    const nickname = await screen.findByLabelText('닉네임');
    expect(nickname).toHaveAccessibleDescription(/한글·영문·숫자로 2~10자/);
    expect(screen.getByText('지금 쓰는 닉네임이에요')).toBeInTheDocument();
  });

  it('프로필·계정 정보를 보이고 블로그 주소·이메일은 읽기 전용', async () => {
    routes();
    renderPage('/settings?tab=account');
    expect(await screen.findByLabelText('닉네임')).toHaveValue('김민서');
    expect(screen.getByLabelText('소개')).toHaveValue('백엔드 개발을 공부하고 있어요.');
    expect(screen.getByText('@kim755030')).toBeInTheDocument();
    expect(screen.getByText('kim755030@naver.com')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '이메일' })).not.toBeInTheDocument();
    expect(screen.getByTestId('default-avatar')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: '개인정보 처리방침' })).toHaveAttribute(
      'href',
      '/privacy',
    );
    expect(screen.getByRole('heading', { name: '비밀번호 변경' })).toBeInTheDocument();
  });

  it('[저장]은 바꾼 칸만 보낸다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    renderPage();
    const bio = await screen.findByLabelText('소개');
    await user.clear(bio);
    await user.type(bio, '새 소개');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ bio: '새 소개' });
  });

  it('바꾼 칸이 없으면 보내지 않는다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    renderPage();
    await screen.findByLabelText('닉네임');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('바꾼 내용이 없어요')).toBeInTheDocument();
    expect(requestsTo(mock, 'PATCH', '/api/me/profile')).toHaveLength(0);
  });

  it('실패한 칸을 모두 보이고 입력값은 그대로 둔다 (SC-008)', async () => {
    routes({
      'PATCH /api/me/profile': () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
            {
              field: 'nickname',
              code: 'NICKNAME_DUPLICATE',
              message: '이미 사용 중인 닉네임이에요',
            },
            { field: 'bio', code: 'BIO_TOO_MANY_LINES', message: '소개는 4줄까지 쓸 수 있어요' },
          ]),
        ),
    });
    const user = userEvent.setup();
    renderPage();
    const nickname = await screen.findByLabelText('닉네임');
    await user.clear(nickname);
    await user.type(nickname, '다른이름');
    await user.type(screen.getByLabelText('소개'), '{Enter}1{Enter}2{Enter}3{Enter}4');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('이미 사용 중인 닉네임이에요')).toBeInTheDocument();
    expect(screen.getByText('소개는 4줄까지 쓸 수 있어요')).toBeInTheDocument();
    expect(nickname).toHaveValue('다른이름');
  });

  it('닉네임 30일 제한 중이면 칸을 막고 다음 변경 가능일을 보인다', async () => {
    routes({
      'GET /api/me/profile': () =>
        json(200, { ...PROFILE, nicknameChangeAvailableAt: '2026-11-07T03:00:00Z' }),
    });
    renderPage();
    expect(await screen.findByLabelText('닉네임')).toBeDisabled();
    expect(screen.getByText(/다음 변경 가능일 2026\.11\.07/)).toBeInTheDocument();
  });

  it('409 NICKNAME_CHANGE_TOO_SOON이면 그 문구를 닉네임 칸에 보인다', async () => {
    routes({
      'PATCH /api/me/profile': () =>
        json(
          409,
          errorBody(
            'NICKNAME_CHANGE_TOO_SOON',
            '닉네임은 바꾼 뒤 30일이 지나야 다시 바꿀 수 있어요',
            [],
            { nextChangeAvailableAt: '2026-11-07T03:00:00Z' },
          ),
        ),
    });
    const user = userEvent.setup();
    renderPage();
    const nickname = await screen.findByLabelText('닉네임');
    await user.clear(nickname);
    await user.type(nickname, '다른이름');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(
      await screen.findByText(/닉네임은 바꾼 뒤 30일이 지나야 다시 바꿀 수 있어요/),
    ).toBeInTheDocument();
  });

  it('소개 글자 수는 코드 포인트로 센다', async () => {
    routes({ 'GET /api/me/profile': () => json(200, { ...PROFILE, bio: null }) });
    const user = userEvent.setup();
    renderPage();
    await user.type(await screen.findByLabelText('소개'), '😀가');
    expect(screen.getByText('2/200')).toBeInTheDocument();
  });

  it('사진을 고르면 [저장] 때 올리고 그 ID로 연결한다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    const createObjectURL = vi.fn(() => 'blob:cropped');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    renderPage();
    await screen.findByRole('button', { name: '사진 바꾸기' });
    await user.upload(
      screen.getByLabelText('프로필 사진 파일'),
      new File(['x'], 'me.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: '가짜 자르기 완료' }));
    expect(screen.getByRole('img', { name: '새 프로필 사진 미리보기' })).toHaveAttribute(
      'src',
      'blob:cropped',
    );
    expect(requestsTo(mock, 'PATCH', '/api/me/profile')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    const { uploadProfileImage } = await import('../features/profile/uploadProfileImage');
    expect(uploadProfileImage).toHaveBeenCalledTimes(1);
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ profileImageId: 55 });
  });

  it('[사진 바꾸기]는 자르기 화면 없이 바로 파일 고르기 창을 띄운다', async () => {
    routes();
    const user = userEvent.setup();
    renderPage();
    const button = await screen.findByRole('button', { name: '사진 바꾸기' });
    const input = screen.getByLabelText<HTMLInputElement>('프로필 사진 파일');
    const click = vi.spyOn(input, 'click');
    await user.click(button);
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '가짜 자르기 완료' })).not.toBeInTheDocument();
  });

  it('[기본 이미지로]는 profileImageId null을 보낸다', async () => {
    const mock = routes({
      'GET /api/me/profile': () =>
        json(200, { ...PROFILE, profileImageId: 9, profileImageUrl: 'https://img.example/p.webp' }),
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: '기본 이미지로' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ profileImageId: null });
  });

  it('025 배너: [사진 바꾸기] → 1500×600 자르기 → [저장] 때 올리고 bannerImageId로 연결한다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:banner'), revokeObjectURL: vi.fn() }),
    );
    renderPage();
    const preview = await screen.findByTestId('profile-banner-preview');
    expect(preview).toHaveAttribute('data-empty', 'true');
    expect(screen.queryByRole('button', { name: '배너 지우기' })).not.toBeInTheDocument();
    const input = screen.getByLabelText<HTMLInputElement>('배너 사진 파일');
    const click = vi.spyOn(input, 'click');
    await user.click(screen.getByRole('button', { name: '배너 사진 바꾸기' }));
    expect(click).toHaveBeenCalledTimes(1);
    await user.upload(input, new File(['x'], 'sky.png', { type: 'image/png' }));
    const crop = screen.getByRole('button', { name: '가짜 자르기 완료' });
    expect(crop).toHaveAttribute('data-output', '1500x600');
    await user.click(crop);
    expect(screen.getByRole('img', { name: '새 배너 미리보기' })).toHaveAttribute(
      'src',
      'blob:banner',
    );
    expect(requestsTo(mock, 'PATCH', '/api/me/profile')).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    const { uploadBannerImage, uploadProfileImage } =
      await import('../features/profile/uploadProfileImage');
    expect(uploadBannerImage).toHaveBeenCalledTimes(1);
    expect(uploadProfileImage).not.toHaveBeenCalled();
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ bannerImageId: 77 });
  });

  it('025 배너: 있으면 미리보기로 보이고 [배너 지우기]는 bannerImageId null을 보낸다', async () => {
    const mock = routes({
      'GET /api/me/profile': () =>
        json(200, { ...PROFILE, bannerImageId: 3, bannerImageUrl: 'https://img.example/b.webp' }),
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('img', { name: '배너' })).toHaveAttribute(
      'src',
      'https://img.example/b.webp',
    );
    await user.click(screen.getByRole('button', { name: '배너 지우기' }));
    expect(screen.queryByRole('img', { name: '배너' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ bannerImageId: null });
  });

  it('025 배너 색: 추천 색을 누르면 미리보기가 그 색이 되고 [저장] 때 bannerColor를 보낸다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    renderPage();
    const preview = await screen.findByTestId('profile-banner-preview');
    expect(screen.getByRole('button', { name: '기본색' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: '기본색으로' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '하늘' }));
    expect(screen.getByRole('button', { name: '하늘' })).toHaveAttribute('aria-pressed', 'true');
    expect(preview.style.getPropertyValue('--banner-color')).toBe('#74c0fc');
    expect(screen.getByLabelText('색 코드')).toHaveValue('#74c0fc');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ bannerColor: '#74c0fc' });
  });

  it('025 배너 색: 색 코드를 직접 적으면 소문자로 맞추고, 틀리면 알려 주고 보내지 않는다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    renderPage();
    const hex = await screen.findByLabelText('색 코드');
    await user.type(hex, '12zz');
    expect(screen.getByRole('alert')).toHaveTextContent('#과 16진수 6자리로 적어 주세요');
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByText('배너 색 코드를 고쳐 주세요')).toBeInTheDocument();
    expect(requestsTo(mock, 'PATCH', '/api/me/profile')).toHaveLength(0);
    await user.clear(hex);
    await user.type(hex, '#6AFF1E');
    expect(screen.queryByText('#과 16진수 6자리로 적어 주세요')).not.toBeInTheDocument();
    expect(
      screen.getByTestId('profile-banner-preview').style.getPropertyValue('--banner-color'),
    ).toBe('#6aff1e');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ bannerColor: '#6aff1e' });
  });

  it('025 배너 색: 색 코드를 적었다가 모두 지우면 기본색으로 저장한다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    renderPage();
    const hex = await screen.findByLabelText('색 코드');
    await user.type(hex, '#6aff1e');
    expect(
      screen.getByTestId('profile-banner-preview').style.getPropertyValue('--banner-color'),
    ).toBe('#6aff1e');
    await user.clear(hex);
    expect(screen.getByRole('button', { name: '기본색' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('소개'), '안녕');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).not.toHaveProperty('bannerColor');
  });

  it('025 배너 색: [기본색으로]는 bannerColor null을 보낸다', async () => {
    const mock = routes({
      'GET /api/me/profile': () => json(200, { ...PROFILE, bannerColor: '#9775fa' }),
    });
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByRole('button', { name: '보라' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(screen.getByRole('button', { name: '기본색으로' }));
    expect(screen.getByRole('button', { name: '기본색' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('색 코드')).toHaveValue('');
    await user.click(screen.getByRole('button', { name: '저장' }));
    await screen.findByText('저장했어요');
    expect(bodyOf(mock, 'PATCH', '/api/me/profile')).toEqual({ bannerColor: null });
  });

  it('025 배너를 올리지 못하면 저장하지 않고 이유를 보인다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:banner'), revokeObjectURL: vi.fn() }),
    );
    const { uploadBannerImage } = await import('../features/profile/uploadProfileImage');
    vi.mocked(uploadBannerImage).mockRejectedValueOnce(new Error('network'));
    renderPage();
    await user.upload(
      await screen.findByLabelText('배너 사진 파일'),
      new File(['x'], 'sky.png', { type: 'image/png' }),
    );
    await user.click(screen.getByRole('button', { name: '가짜 자르기 완료' }));
    await user.click(screen.getByRole('button', { name: '저장' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '배너를 올리지 못했어요. 다시 시도해 주세요',
    );
    expect(requestsTo(mock, 'PATCH', '/api/me/profile')).toHaveLength(0);
  });

  it('최근 활동 공개를 바꾸면 바로 저장하고, 새 글 기본 공개 범위 칸은 없다', async () => {
    const mock = routes();
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByLabelText('최근 활동을 친구에게 보이기'));
    await waitFor(() =>
      expect(bodyOf(mock, 'PATCH', '/api/me/settings')).toEqual({ lastActiveVisible: false }),
    );
    expect(screen.queryByLabelText('새 글 기본 공개 범위')).not.toBeInTheDocument();
  });

  it('직전 로그인: 없으면 "첫 로그인", 있으면 YYYY.MM.DD HH:mm(Asia/Seoul)과 로그인 방식', async () => {
    routes();
    const { unmount } = renderPage('/settings?tab=account');
    const account = await screen.findByRole('region', { name: '계정' });
    expect(within(account).getByText('첫 로그인')).toBeInTheDocument();
    expect(
      within(account).getByText('끄면 나도 친구의 최근 활동을 볼 수 없어요', { exact: false }),
    ).toBeInTheDocument();
    unmount();
    routes({
      'GET /api/me/settings': () =>
        json(200, {
          ...SETTINGS,
          previousLogin: { at: '2026-10-06T01:30:00Z', provider: 'GOOGLE' },
        }),
    });
    renderPage('/settings?tab=account');
    expect(await screen.findByText('2026.10.06 10:30, Google')).toBeInTheDocument();
  });

  it('소셜 계정은 비밀번호 변경을 보이지 않고 로그인 수단을 보인다', async () => {
    routes({
      'GET /api/me/settings': () =>
        json(200, { ...SETTINGS, provider: 'GITHUB', passwordChangeAvailable: false }),
    });
    renderPage('/settings?tab=account');
    const account = await screen.findByRole('region', { name: '계정' });
    expect(within(account).getByText('GitHub')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '비밀번호 변경' })).not.toBeInTheDocument();
  });
});

it('설정에는 친구 영역이 없다 (친구 화면으로 옮김)', async () => {
  routes();
  renderPage('/settings?tab=account');
  expect(await screen.findByRole('region', { name: '계정' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '받은 친구 요청' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: '내 친구' })).not.toBeInTheDocument();
});
