import logoBDark from '../assets/logo-b-dark.png';
import logoBLight from '../assets/logo-b-light.png';
import './nestB.css';

/**
 * 썸네일을 고르지 않은 글의 표지 (019): 로고의 둥지 B 그림을 옅은 브랜드 면 가운데에. 라이트·다크 그림을 함께 두고 CSS가
 * `data-theme`에 맞는 쪽만 보인다(머리말 로고와 같은 방식). 장식이라 화면 읽기 도구는 읽지 않는다.
 */
export default function NestB() {
  return (
    <span className="nest-b" data-testid="nest-b" aria-hidden="true">
      <img className="nest-b-img nest-b-light" src={logoBLight} alt="" />
      <img className="nest-b-img nest-b-dark" src={logoBDark} alt="" />
    </span>
  );
}
