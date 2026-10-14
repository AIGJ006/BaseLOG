package com.team.blog.spellcheck.application;

import com.team.blog.tag.application.suggest.Provider;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 맞춤법 검사 설정값 ({@code blog.ai.spell-check.*}, 022 spec 데이터 §4). 공급자 주소·모델·키·스레드 수는 013 {@code
 * blog.ai.tag-suggest.gemini/ollama}를 함께 쓰고, 여기에는 검사에만 다른 값(길이·시간 제한·출력 길이)을 둔다.
 *
 * @param enabled 기능 켜기 (끄면 503 {@code DISABLED})
 * @param minInputChars 정리 후 최소 길이 (코드 포인트, 미만이면 422)
 * @param maxIssues 한 번에 돌려줄 최대 고칠 곳 수
 * @param dailyLimitPerMember 회원당 하루 검사 수 (한국 시간 0시 초기화, 태그 추천과 따로 센다)
 * @param gemini 외부 AI
 * @param ollama 자체 AI
 */
@Validated
@ConfigurationProperties("blog.ai.spell-check")
public record SpellCheckProperties(
        @DefaultValue("true") boolean enabled,
        @Min(1) @DefaultValue("5") int minInputChars,
        @Min(1) @Max(200) @DefaultValue("50") int maxIssues,
        @Min(1) @DefaultValue("30") int dailyLimitPerMember,
        @Valid @NotNull @DefaultValue Gemini gemini,
        @Valid @NotNull @DefaultValue Ollama ollama) {

    /**
     * @param maxInputChars 보내는 본문 최대 길이 (넘으면 앞부분만 검사)
     * @param timeout 응답 시간 제한 (고칠 곳 목록이 태그보다 길어 013보다 길게)
     * @param maxOutputTokens 출력 최대 토큰
     */
    public record Gemini(
            @Min(1) @DefaultValue("5000") int maxInputChars,
            @NotNull @DefaultValue("30s") Duration timeout,
            @Min(64) @DefaultValue("4096") int maxOutputTokens) {}

    /**
     * @param maxInputChars 보내는 본문 최대 길이 (작은 모델이라 짧게)
     * @param timeout 응답 시간 제한
     * @param maxOutputTokens 출력 최대 토큰 ({@code num_predict})
     */
    public record Ollama(
            @Min(1) @DefaultValue("1500") int maxInputChars,
            @NotNull @DefaultValue("60s") Duration timeout,
            @Min(64) @DefaultValue("1024") int maxOutputTokens) {}

    /** 공급자별 최대 입력 길이. */
    public int maxInputChars(Provider provider) {
        return provider == Provider.GEMINI ? gemini.maxInputChars() : ollama.maxInputChars();
    }
}
