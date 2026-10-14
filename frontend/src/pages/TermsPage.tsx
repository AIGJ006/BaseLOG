import AgreementMeta from '../components/AgreementMeta';
import { useCurrentAgreements } from '../features/auth/useCurrentAgreements';
import '../features/auth/auth.css';

/**
 * 이용약관 (07 §3-1, FR-011). 본문은 확정 전 초안이다(사이트 맨 아래 꼬리말에서도 연다).
 */
export default function TermsPage() {
  const { agreements, failed } = useCurrentAgreements();
  return (
    <main className="auth-page document-page">
      <h1>이용약관</h1>
      <AgreementMeta document={agreements?.terms} failed={failed} />
      <p className="placeholder-note">이 약관은 초안이에요. 확정되면 이 안내를 지워요.</p>
      <section>
        <h2>1. 목적</h2>
        <p>이 약관은 BaseLOG 서비스 이용에 필요한 회원과 서비스의 권리·의무를 정해요.</p>
      </section>
      <section>
        <h2>2. 계정</h2>
        <p>
          회원은 이메일 또는 소셜 계정(Google·GitHub)으로 가입해요. 계정 정보는 본인만 쓰고, 다른
          사람에게 빌려주거나 넘기지 않아요. 비밀번호가 새어 나간 것 같으면 바로 바꿔 주세요.
        </p>
      </section>
      <section>
        <h2>3. 게시물과 권리</h2>
        <p>
          회원이 쓴 글·댓글·사진의 권리는 회원에게 있어요. BaseLOG는 서비스를 보여 주는 데 필요한
          만큼만(목록·검색·미리보기 등) 게시물을 쓸 수 있어요.
        </p>
        <p>
          글은 전체 공개·친구 공개·나만 보기 중에서 고를 수 있어요. 공개 범위는 회원이 정하고, 바꾼
          범위는 바로 적용돼요.
        </p>
      </section>
      <section>
        <h2>4. 하지 말아야 할 일</h2>
        <ul>
          <li>다른 사람의 권리(저작권·초상권·개인 정보 등)를 침해하는 글</li>
          <li>욕설·혐오·괴롭힘, 불법 정보나 광고·도배</li>
          <li>다른 사람인 척하거나, 서비스를 망가뜨리려는 시도</li>
        </ul>
      </section>
      <section>
        <h2>5. 신고와 이용 제한</h2>
        <p>
          문제가 있는 글·댓글은 누구나 신고할 수 있어요. 운영자가 확인해 게시물을 숨기거나, 반복해서
          어기면 일정 기간 또는 영구적으로 이용을 제한할 수 있어요.
        </p>
      </section>
      <section>
        <h2>6. 탈퇴</h2>
        <p>
          회원은 언제든 설정 화면에서 탈퇴할 수 있어요. 탈퇴 신청 후 30일 동안은 되돌릴 수 있고, 그
          뒤에는 개인 정보를 익명 처리해요.
        </p>
      </section>
      <section>
        <h2>7. 서비스 변경과 책임</h2>
        <p>
          BaseLOG는 기능을 더하거나 바꿀 수 있고, 점검·장애로 잠시 쓸 수 없을 때가 있어요. 회원이
          올린 게시물의 내용에 대한 책임은 그 회원에게 있어요.
        </p>
      </section>
      <section>
        <h2>8. 약관 변경</h2>
        <p>약관을 바꾸면 공지로 먼저 알리고, 바뀐 약관은 알린 날부터 적용돼요.</p>
      </section>
    </main>
  );
}
