package com.team.blog.spellcheck.infra;

import com.team.blog.spellcheck.application.SpellIssue;
import com.team.blog.tag.application.suggest.FailureKind;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/** 두 공급자가 함께 쓰는 요청·응답 처리 (022 spec 공급자 §2). */
final class SpellResponses {

    /** 응답 본문을 이만큼만 읽는다. */
    private static final int MAX_BODY_BYTES = 256 * 1024;

    private SpellResponses() {}

    /** {@code {"issues": [{original, suggestion, reason}]}} 스키마 (Gemini는 대문자 타입 이름). */
    static ObjectNode issuesSchema(JsonMapper json, boolean geminiTypes, int maxIssues) {
        String object = geminiTypes ? "OBJECT" : "object";
        String string = geminiTypes ? "STRING" : "string";
        ObjectNode schema = json.createObjectNode();
        schema.put("type", object);
        ObjectNode issues = schema.putObject("properties").putObject("issues");
        issues.put("type", geminiTypes ? "ARRAY" : "array");
        issues.put("maxItems", maxIssues);
        ObjectNode item = issues.putObject("items");
        item.put("type", object);
        ObjectNode props = item.putObject("properties");
        props.putObject("original").put("type", string);
        props.putObject("suggestion").put("type", string);
        props.putObject("reason").put("type", string);
        item.putArray("required").add("original").add("suggestion");
        schema.putArray("required").add("issues");
        return schema;
    }

    /**
     * 모델이 돌려준 글자 {@code {"issues": [...]}}. 형식이 다르면 빈 값. 항목 안의 빈 값 거르기는 {@code SpellIssueFilter}가
     * 한다.
     */
    static Optional<List<SpellIssue>> parseIssues(JsonMapper json, String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        JsonNode root;
        try {
            root = json.readTree(text);
        } catch (JacksonException e) {
            return Optional.empty();
        }
        JsonNode issues = root == null ? null : root.get("issues");
        if (issues == null || !issues.isArray()) {
            return Optional.empty();
        }
        List<SpellIssue> out = new ArrayList<>();
        for (JsonNode issue : issues) {
            if (!issue.isObject()) {
                return Optional.empty();
            }
            out.add(
                    new SpellIssue(
                            issue.path("original").asString(""),
                            issue.path("suggestion").asString(""),
                            issue.path("reason").asString("")));
        }
        return Optional.of(out);
    }

    /** 본문 JSON (읽지 못하면 빈 값). */
    static Optional<JsonNode> readJson(JsonMapper json, String body) {
        if (body == null || body.isBlank()) {
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(json.readTree(body));
        } catch (JacksonException e) {
            return Optional.empty();
        }
    }

    static String readBody(InputStream in) throws IOException {
        if (in == null) {
            return "";
        }
        return new String(in.readNBytes(MAX_BODY_BYTES), StandardCharsets.UTF_8);
    }

    /** 연결 단계 예외의 종류. */
    static FailureKind failureOf(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SocketTimeoutException || t instanceof HttpTimeoutException) {
                return FailureKind.TIMEOUT;
            }
            if (t instanceof ConnectException
                    || t instanceof UnknownHostException
                    || t instanceof NoRouteToHostException) {
                return FailureKind.CONNECT;
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return FailureKind.SERVER_ERROR;
    }
}
