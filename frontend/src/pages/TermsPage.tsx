import AgreementMeta from '../components/AgreementMeta';
import TermsContent from '../components/TermsContent';
import { useCurrentAgreements } from '../features/auth/useCurrentAgreements';
import '../features/auth/auth.css';

/**
 * 이용약관 (07 §3-1, FR-011). 본문은 확정 전 초안이다(사이트 맨 아래 꼬리말·설정 [이용약관] 탭에서도 연다).
 */
export default function TermsPage() {
  const { agreements, failed } = useCurrentAgreements();
  return (
    <main className="auth-page document-page">
      <h1>이용약관</h1>
      <AgreementMeta document={agreements?.terms} failed={failed} />
      <p className="placeholder-note">이 약관은 초안이에요. 확정되면 이 안내를 지워요.</p>
      <TermsContent />
    </main>
  );
}
