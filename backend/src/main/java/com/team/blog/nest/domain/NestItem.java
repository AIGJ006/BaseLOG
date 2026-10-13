package com.team.blog.nest.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * 상점 물건 목록 (021 FR-030). 그림은 화면이 코드로 그린다 — 서버는 코드·종류·이름·값만 안다. 값이 0인 물건(기본 배경·테두리 없음)은 사지 않아도 가진
 * 것으로 본다.
 */
public enum NestItem {
    BG_BASIC("bg-basic", NestItemKind.BACKGROUND, "기본 숲", 0),
    BG_MEADOW("bg-meadow", NestItemKind.BACKGROUND, "풀밭", 100),
    BG_SKY("bg-sky", NestItemKind.BACKGROUND, "맑은 하늘", 100),
    BG_SUNSET("bg-sunset", NestItemKind.BACKGROUND, "노을", 150),
    BG_CHERRY("bg-cherry", NestItemKind.BACKGROUND, "벚꽃", 200),
    BG_NIGHT("bg-night", NestItemKind.BACKGROUND, "밤하늘", 250),
    BORDER_NONE("border-none", NestItemKind.BORDER, "테두리 없음", 0),
    BORDER_TWIG("border-twig", NestItemKind.BORDER, "나뭇가지 테두리", 80),
    BORDER_GOLD("border-gold", NestItemKind.BORDER, "금빛 테두리", 300),
    DECO_LEAF("deco-leaf", NestItemKind.DECORATION, "나뭇잎", 50),
    DECO_FEATHER("deco-feather", NestItemKind.DECORATION, "깃털", 60),
    DECO_FLOWER("deco-flower", NestItemKind.DECORATION, "꽃", 70),
    DECO_EGG("deco-egg", NestItemKind.DECORATION, "알", 80),
    DECO_STAR("deco-star", NestItemKind.DECORATION, "별", 120);

    public static final NestItem DEFAULT_BACKGROUND = BG_BASIC;
    public static final NestItem DEFAULT_BORDER = BORDER_NONE;

    private final String code;
    private final NestItemKind kind;
    private final String displayName;
    private final int price;

    NestItem(String code, NestItemKind kind, String displayName, int price) {
        this.code = code;
        this.kind = kind;
        this.displayName = displayName;
        this.price = price;
    }

    public String code() {
        return code;
    }

    public NestItemKind kind() {
        return kind;
    }

    public String displayName() {
        return displayName;
    }

    public int price() {
        return price;
    }

    public boolean free() {
        return price == 0;
    }

    public static Optional<NestItem> fromCode(String code) {
        return Arrays.stream(values()).filter(i -> i.code.equals(code)).findFirst();
    }

    public static List<NestItem> ofKind(NestItemKind kind) {
        return Arrays.stream(values()).filter(i -> i.kind == kind).toList();
    }
}
