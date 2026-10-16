import { Link } from 'react-router-dom';
import type { AuthorSummary } from '../../api/types/reading';
import DefaultAvatar from '../../components/DefaultAvatar';

const AVATAR = 20;

/**
 * 글 상세 작성자 줄 아래의 "함께 쓴 사람" — 작은 프로필 사진 + 닉네임, 누르면 그 사람의 둥지로. 없으면 그리지 않는다.
 */
export default function CollaboratorLine({
  collaborators,
}: {
  collaborators: AuthorSummary[] | undefined;
}) {
  if (!collaborators || collaborators.length === 0) {
    return null;
  }
  return (
    <div data-testid="post-collaborators" className="post-collaborators">
      <span className="post-collaborators-label">함께 쓴 사람</span>
      <ul className="post-collaborators-list">
        {collaborators.map((person) => (
          <li key={person.handle}>
            <Link to={`/@${person.handle}`} className="post-collaborator">
              {person.profileImageUrl ? (
                <img
                  src={person.profileImageUrl}
                  alt=""
                  width={AVATAR}
                  height={AVATAR}
                  loading="lazy"
                  className="post-collaborator-avatar"
                />
              ) : (
                <DefaultAvatar nickname={person.nickname} handle={person.handle} size={AVATAR} />
              )}
              <span className="post-collaborator-name">{person.nickname}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
