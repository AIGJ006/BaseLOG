import type { ReactNode } from 'react';
import type { Inquiry } from '../../api/types/inquiry';
import { formatDate, formatDateTime } from '../time/dateFormat';
import { CATEGORY_LABELS, INQUIRY_TEXT, STATUS_LABELS } from './inquiryText';
import './inquiry.css';

/**
 * 문의 한 건 (023): 종류 · 보낸 날짜 · 상태(접수/답변 완료) · 내용 · 사진 · 답변. 내가 보낸 문의와 관리자 문의 화면이 함께 쓴다.
 * `who`는 관리자 화면의 보낸 사람, `children`은 답변 아래(관리자 답변 칸)에 붙는다.
 */
export default function InquiryCard({
  inquiry,
  who,
  statusLabels = STATUS_LABELS,
  children,
}: Readonly<{
  inquiry: Inquiry;
  who?: ReactNode;
  /** 관리자 화면은 처리 전·처리 완료 */
  statusLabels?: Record<Inquiry['status'], string>;
  children?: ReactNode;
}>) {
  return (
    <li className="inquiry-item" data-testid="inquiry-item" data-status={inquiry.status}>
      <div className="inquiry-item-head">
        <span className="inquiry-item-category">{CATEGORY_LABELS[inquiry.category]}</span>
        <time dateTime={inquiry.createdAt}>{formatDate(inquiry.createdAt)}</time>
        <span className="inquiry-status" data-status={inquiry.status}>
          {statusLabels[inquiry.status]}
        </span>
        {who}
      </div>
      {inquiry.targetHandle ? <span>{INQUIRY_TEXT.target(inquiry.targetHandle)}</span> : null}
      <p className="inquiry-item-content">{inquiry.content}</p>
      {inquiry.imageUrl ? (
        <a
          className="inquiry-item-photo"
          href={inquiry.imageUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src={inquiry.imageUrl} alt={INQUIRY_TEXT.photoAlt} loading="lazy" />
        </a>
      ) : null}
      {inquiry.status === 'ANSWERED' && inquiry.answer ? (
        <section className="inquiry-answer" aria-label={INQUIRY_TEXT.answerTitle}>
          <div className="inquiry-answer-head">
            <span>{INQUIRY_TEXT.answerTitle}</span>
            {inquiry.answeredAt ? (
              <time dateTime={inquiry.answeredAt}>{formatDateTime(inquiry.answeredAt)}</time>
            ) : null}
          </div>
          <p className="inquiry-answer-text">{inquiry.answer}</p>
        </section>
      ) : null}
      {children}
    </li>
  );
}
