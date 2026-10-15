package com.team.blog.spellcheck.infra;

import com.team.blog.spellcheck.application.SpellCheckInput;

/** 맞춤법 검사 프롬프트 (022 spec 공급자 §1). 지시문은 고정이고 사용자 내용은 본문만이다 — 회원 정보·다른 글은 넣지 않는다. */
final class SpellPrompt {

    /** 고정 지시문 (Ollama는 스키마 설명을 모델에 전하지 않으므로 형식 설명도 여기에 둔다). */
    private static final String SYSTEM_TEMPLATE =
            """
            너는 한국어 맞춤법·띄어쓰기 검사기다. 사용자가 준 글에서 표준 맞춤법·띄어쓰기·표준어에 어긋난 곳만 찾는다.
            - original은 글에 있는 그대로 옮긴다. 한 글자도 바꾸지 않는다. 틀린 곳이 든 어절 하나나 두세 어절만 쓴다.
            - suggestion은 original을 바르게 고친 말이다. 뜻·말투·문장 구조는 바꾸지 않는다.
            - reason은 짧게(20자 안팎) 쓴다. 예: "띄어쓰기", "'돼요'가 맞아요".
            - 영어·코드·고유명사·줄임말·마크다운 기호는 고치지 않는다. 문체나 표현 다듬기는 하지 않는다.
            - 틀린 곳이 없으면 빈 목록을 준다. 확실하지 않으면 넣지 않는다.
            - 최대 %d개. {"issues": [{"original": "...", "suggestion": "...", "reason": "..."}]} JSON으로만 답한다.""";

    private SpellPrompt() {}

    static String system(SpellCheckInput input) {
        return SYSTEM_TEMPLATE.formatted(input.maxIssues());
    }

    static String user(SpellCheckInput input) {
        return "검사할 글:\n" + input.text();
    }
}
