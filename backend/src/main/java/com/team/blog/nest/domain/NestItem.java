package com.team.blog.nest.domain;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * 상점 물건 목록 (021 FR-030). 그림은 화면이 갖고 있다(민서 님 픽셀 그림) — 서버는 코드·종류·이름·값·칸만 안다. 값이 0인 물건(기본 숲·기본 둥지)은 사지
 * 않아도 가진 것으로 본다.
 */
public enum NestItem {
    BG_BASIC("bg-basic", NestItemKind.BACKGROUND, "기본 숲", 0),
    BG_MEADOW("bg-meadow", NestItemKind.BACKGROUND, "풀밭", 100),
    BG_SKY("bg-sky", NestItemKind.BACKGROUND, "맑은 하늘", 100),
    BG_SUNSET("bg-sunset", NestItemKind.BACKGROUND, "노을", 150),
    BG_CHERRY("bg-cherry", NestItemKind.BACKGROUND, "벚꽃", 200),
    BG_NIGHT("bg-night", NestItemKind.BACKGROUND, "밤하늘", 250),
    NEST_BASIC("nest-basic", NestItemKind.NEST, "기본 둥지", 0),
    NEST_LEAF("nest-leaf", NestItemKind.NEST, "나뭇잎 둥지", 100),
    NEST_FLOWER("nest-flower", NestItemKind.NEST, "꽃 둥지", 120),
    NEST_SNOW("nest-snow", NestItemKind.NEST, "눈 둥지", 150),
    NEST_MUSHROOM("nest-mushroom", NestItemKind.NEST, "버섯 둥지", 150),
    NEST_RIBBON("nest-ribbon", NestItemKind.NEST, "리본 둥지", 180),
    NEST_HOUSE("nest-house", NestItemKind.NEST, "새집 둥지", 200),
    NEST_FENCE("nest-fence", NestItemKind.NEST, "울타리 둥지", 200),
    NEST_STAR("nest-star", NestItemKind.NEST, "별 둥지", 300),
    PROP_BRANCH("prop-branch", NestItemKind.PROP, "나뭇가지", 40),
    PROP_LEAF("prop-leaf", NestItemKind.PROP, "나뭇잎", 30),
    PROP_FLOWER("prop-flower", NestItemKind.PROP, "꽃", 50),
    PROP_MUSHROOM("prop-mushroom", NestItemKind.PROP, "버섯", 60),
    PROP_STONE("prop-stone", NestItemKind.PROP, "돌", 30),
    PROP_POND("prop-pond", NestItemKind.PROP, "물웅덩이", 80),
    PROP_SUN("prop-sun", NestItemKind.PROP, "햇살", 70),
    PROP_CLOUD("prop-cloud", NestItemKind.PROP, "구름", 70),
    PROP_RAIN("prop-rain", NestItemKind.PROP, "비", 70),
    ACC_FLOWER_CROWN("acc-flower-crown", NestItemKind.ACCESSORY, "꽃관", 100, "HEAD"),
    ACC_RIBBON("acc-ribbon", NestItemKind.ACCESSORY, "나비 리본", 80, "HEAD"),
    ACC_CROWN("acc-crown", NestItemKind.ACCESSORY, "왕관", 300, "HEAD"),
    ACC_FLOWER_PIN("acc-flower-pin", NestItemKind.ACCESSORY, "꽃핀", 70),
    ACC_BUTTERFLY("acc-butterfly", NestItemKind.ACCESSORY, "나비", 60),
    ACC_HEART("acc-heart", NestItemKind.ACCESSORY, "하트", 50),
    ACC_STAR("acc-star", NestItemKind.ACCESSORY, "별", 80);

    public static final NestItem DEFAULT_BACKGROUND = BG_BASIC;
    public static final NestItem DEFAULT_NEST = NEST_BASIC;

    private final String code;
    private final NestItemKind kind;
    private final String displayName;
    private final int price;
    private final String slot;

    NestItem(String code, NestItemKind kind, String displayName, int price) {
        this(code, kind, displayName, price, null);
    }

    NestItem(String code, NestItemKind kind, String displayName, int price, String slot) {
        this.code = code;
        this.kind = kind;
        this.displayName = displayName;
        this.price = price;
        this.slot = slot;
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

    /** 새 장식이 차지하는 칸(지금은 머리 HEAD뿐). 칸마다 하나만 장착한다. 새 둘레를 나는 장식·소품은 {@code null}. */
    public String slot() {
        return slot;
    }

    /** 배경·둥지 말고 여러 개 장착하는 물건(소품·새 장식)인가. */
    public boolean decoration() {
        return kind == NestItemKind.PROP || kind == NestItemKind.ACCESSORY;
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
