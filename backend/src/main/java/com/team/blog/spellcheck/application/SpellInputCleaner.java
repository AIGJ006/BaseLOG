package com.team.blog.spellcheck.application;

import java.text.Normalizer;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * 검사할 본문 정리 (022 spec R3). AI가 돌려준 틀린 말을 화면이 원래 본문에서 그대로 찾을 수 있게, 글자는 바꾸지 않고 검사할 필요가 없는 부분만 덜어 낸다.
 *
 * <ul>
 *   <li>코드 블록({@code ```}·{@code ~~~})과 인라인 코드, HTML 태그, 사진 문법은 통째로 버린다
 *   <li>링크는 글자만 남기고 주소를 버린다. 맨 주소({@code http…})도 버린다
 *   <li>줄은 그대로 두고, 빈 줄 여럿은 하나로 줄인다. NFC로 맞춘다
 * </ul>
 */
@Component
public class SpellInputCleaner {

    private static final Pattern FENCED =
            Pattern.compile("(?ms)^[ \\t]*(```|~~~)[^\\n]*\\n.*?(^[ \\t]*\\1[ \\t]*$|\\z)");
    private static final Pattern INLINE_CODE = Pattern.compile("`+[^`\\n]*`+");
    private static final Pattern IMAGE = Pattern.compile("!\\[[^\\]\\n]*\\]\\([^)\\n]*\\)");
    private static final Pattern LINK = Pattern.compile("\\[([^\\]\\n]*)\\]\\([^)\\n]*\\)");
    private static final Pattern URL = Pattern.compile("https?://\\S+");
    private static final Pattern HTML = Pattern.compile("<[^>\\n]+>");
    private static final Pattern BLANK_LINES = Pattern.compile("\\n[ \\t]*+(?:\\n[ \\t]*+)++");

    /** 정리된 본문 (앞뒤 공백 없음). */
    public String clean(String contentMd) {
        if (contentMd == null || contentMd.isBlank()) {
            return "";
        }
        String text = contentMd.replace("\r\n", "\n").replace('\r', '\n');
        text = FENCED.matcher(text).replaceAll("");
        text = INLINE_CODE.matcher(text).replaceAll(" ");
        text = IMAGE.matcher(text).replaceAll(" ");
        text = LINK.matcher(text).replaceAll("$1");
        text = URL.matcher(text).replaceAll(" ");
        text = HTML.matcher(text).replaceAll(" ");
        text = BLANK_LINES.matcher(text).replaceAll("\n\n");
        return Normalizer.normalize(text, Normalizer.Form.NFC).strip();
    }

    /**
     * 앞에서 {@code max} 코드 포인트까지 자른다. 자를 자리 앞쪽 절반 안에 줄바꿈이 있으면 거기서 자른다(문장 중간을 덜 자르게).
     *
     * @return 자른 글 (자를 필요가 없으면 그대로)
     */
    public static String truncate(String text, int max) {
        if (text.codePointCount(0, text.length()) <= max) {
            return text;
        }
        int end = text.offsetByCodePoints(0, max);
        int newline = text.lastIndexOf('\n', end);
        if (newline > end / 2) {
            end = newline;
        }
        return text.substring(0, end).strip();
    }

    /** 코드 포인트 수. */
    public static int length(String text) {
        return text.codePointCount(0, text.length());
    }
}
