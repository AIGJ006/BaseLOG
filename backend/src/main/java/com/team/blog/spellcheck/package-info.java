/**
 * spellcheck 모듈: 글쓰기 화면의 AI 맞춤법·띄어쓰기 검사 (022). [맞춤법 검사] 버튼을 누를 때만 AI를 한 번 부른다(쓰는 동안 자동 검사 없음). 고친
 * 말은 돌려주기만 하고 글을 바꾸거나 저장하지 않는다.
 *
 * <p>공급자 키·주소·모델과 Gemini 하루 한도·쉬는 시간 상태는 013 태그 추천({@code tag.application.suggest})과 함께 쓴다 — 같은 키라서
 * 한도도 하나다. AI 동의도 013과 같은 동의를 본다.
 */
package com.team.blog.spellcheck;
