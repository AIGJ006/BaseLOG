import { useEffect, useState } from 'react';
import { listAttachments } from '../../api/attachments';
import type { Attachment } from '../../api/attachments';
import { formatBytes } from '../image-upload/storageHint';
import './attachment.css';

/** 글 읽기 화면 본문 아래의 첨부파일 목록 (018 US2). 첨부가 없으면 그리지 않는다. 이름을 누르면 내려받는다. */
export default function PostAttachments({ postId }: { postId: number }) {
  const [items, setItems] = useState<Attachment[]>([]);

  useEffect(() => {
    let alive = true;
    listAttachments(postId)
      .then((loaded) => {
        if (alive) setItems(loaded);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [postId]);

  if (items.length === 0) {
    return null;
  }
  return (
    <section className="attachment-box attachment-box--detail" aria-label="첨부파일">
      <h2 className="attachment-box__title">첨부파일 {items.length}</h2>
      <ul className="attachment-list">
        {items.map((a) => (
          <li key={a.id} className="attachment-list__item">
            <span className="attachment-list__icon" aria-hidden="true">
              📎
            </span>
            <a className="attachment-list__name" href={a.downloadUrl} download={a.name}>
              {a.name}
            </a>
            <span className="attachment-list__size">{formatBytes(a.size)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
