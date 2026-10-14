/**
 * 이용약관 본문(초안). 이용약관 화면과 설정의 [이용약관] 탭이 함께 쓴다.
 * 설정 탭 안에서는 탭 제목(h2) 아래라서 조 제목을 h3로 낮춘다.
 */
export default function TermsContent({ headingLevel = 2 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <>
      <section>
        <Heading>1. 목적</Heading>
        <p>이 약관은 BaseLOG 서비스 이용에 필요한 회원과 서비스의 권리·의무를 정해요.</p>
      </section>
      <section>
        <Heading>2. 계정</Heading>
        <p>
          회원은 이메일 또는 소셜 계정(Google·GitHub)으로 가입해요. 계정 정보는 본인만 쓰고, 다른
          사람에게 빌려주거나 넘기지 않아요. 비밀번호가 새어 나간 것 같으면 바로 바꿔 주세요.
        </p>
      </section>
      <section>
        <Heading>3. 게시물과 권리</Heading>
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
        <Heading>4. 하지 말아야 할 일</Heading>
        <ul>
          <li>다른 사람의 권리(저작권·초상권·개인 정보 등)를 침해하는 글</li>
          <li>욕설·혐오·괴롭힘, 불법 정보나 광고·도배</li>
          <li>다른 사람인 척하거나, 서비스를 망가뜨리려는 시도</li>
        </ul>
      </section>
      <section>
        <Heading>5. 신고와 이용 제한</Heading>
        <p>
          문제가 있는 글·댓글은 누구나 신고할 수 있어요. 운영자가 확인해 게시물을 숨기거나, 반복해서
          어기면 일정 기간 또는 영구적으로 이용을 제한할 수 있어요.
        </p>
      </section>
      <section>
        <Heading>6. 탈퇴</Heading>
        <p>
          회원은 언제든 설정 화면에서 탈퇴할 수 있어요. 탈퇴 신청 후 30일 동안은 되돌릴 수 있고, 그
          뒤에는 개인 정보를 익명 처리해요.
        </p>
      </section>
      <section>
        <Heading>7. 서비스 변경과 책임</Heading>
        <p>
          BaseLOG는 기능을 더하거나 바꿀 수 있고, 점검·장애로 잠시 쓸 수 없을 때가 있어요. 회원이
          올린 게시물의 내용에 대한 책임은 그 회원에게 있어요.
        </p>
      </section>
      <section>
        <Heading>8. 약관 변경</Heading>
        <p>약관을 바꾸면 공지로 먼저 알리고, 바뀐 약관은 알린 날부터 적용돼요.</p>
      </section>
    </>
  );
}
