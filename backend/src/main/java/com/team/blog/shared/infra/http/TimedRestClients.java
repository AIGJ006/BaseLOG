package com.team.blog.shared.infra.http;

import java.time.Duration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * 외부 AI 공급자(013 태그 추천·022 맞춤법 검사)용 {@link RestClient}. 공급자마다 연결·응답 시간 제한을 따로 두고, 공용 {@code
 * RestClient.Builder}(관측·로그 설정이 붙을 수 있음)를 쓰지 않고 새로 만든다 — 요청·응답 본문은 어떤 로그에도 남기지 않는다.
 */
public final class TimedRestClients {

    private TimedRestClients() {}

    /** 기준 주소·시간 제한을 둔 새 클라이언트 (시험도 이것으로 만든다). */
    public static RestClient create(String baseUrl, Duration connectTimeout, Duration timeout) {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(connectTimeout);
        factory.setReadTimeout(timeout);
        return RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }
}
