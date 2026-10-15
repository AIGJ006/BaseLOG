import { useOutletContext } from 'react-router-dom';

/** 안쪽 화면이 알려 주는 휴지통 글 수. 아직 모르면 `null`이라 숫자를 붙이지 않는다. */
export interface ManageNestContext {
  setTrashCount: (count: number | null) => void;
}

/** 내 둥지 관리 안에서 그려질 때만 값이 있다(화면만 따로 그리는 시험에서는 `undefined`). */
export function useManageNest(): ManageNestContext | undefined {
  return useOutletContext<ManageNestContext | undefined>();
}
