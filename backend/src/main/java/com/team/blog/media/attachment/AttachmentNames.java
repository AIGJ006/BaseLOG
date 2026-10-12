package com.team.blog.media.attachment;

import java.util.Locale;

/**
 * 원래 파일 이름 다듬기 (018 FR-006). 경로·제어 문자를 빼고 앞뒤 공백·점을 지운 뒤 255자(코드 포인트)로 자른다 — 자를 때는 확장자를 살린다. 저장소 키에는
 * 이름을 쓰지 않는다(무작위 키).
 */
public final class AttachmentNames {

    static final int MAX_LENGTH = 255;

    private AttachmentNames() {}

    /**
     * @return 다듬은 이름. 남는 글자가 없으면 빈 문자열
     */
    public static String clean(String original) {
        if (original == null) {
            return "";
        }
        String name = original;
        int slash = Math.max(name.lastIndexOf('/'), name.lastIndexOf('\\'));
        if (slash >= 0) {
            name = name.substring(slash + 1);
        }
        StringBuilder out = new StringBuilder(name.length());
        name.codePoints()
                .filter(
                        cp ->
                                !Character.isISOControl(cp)
                                        && Character.getType(cp) != Character.FORMAT)
                .forEach(out::appendCodePoint);
        name = out.toString().strip();
        while (name.startsWith(".")) {
            name = name.substring(1).strip();
        }
        while (name.endsWith(".")) {
            name = name.substring(0, name.length() - 1).strip();
        }
        if (name.codePointCount(0, name.length()) <= MAX_LENGTH) {
            return name;
        }
        String ext = extension(name);
        String suffix = ext.isEmpty() ? "" : "." + ext;
        if (suffix.length() > 20) {
            suffix = "";
        }
        int keep = MAX_LENGTH - suffix.codePointCount(0, suffix.length());
        String base = name.substring(0, name.length() - suffix.length());
        int end = base.offsetByCodePoints(0, Math.min(keep, base.codePointCount(0, base.length())));
        return base.substring(0, end).strip() + suffix;
    }

    /** 마지막 점 뒤 확장자 (소문자). 없으면 빈 문자열. */
    public static String extension(String name) {
        int dot = name.lastIndexOf('.');
        if (dot <= 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }
}
