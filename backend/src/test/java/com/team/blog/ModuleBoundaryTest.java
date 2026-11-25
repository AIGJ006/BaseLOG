package com.team.blog;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaClass;
import com.tngtech.archunit.core.domain.JavaClasses;
import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import jakarta.persistence.Entity;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestFactory;
import org.springframework.data.repository.Repository;

/**
 * 모듈 경계 규칙 (루트 {@code package-info}, constitution II)을 코드로 지킨다. 모듈은 {@code com.team.blog} 바로 아래 패키지
 * 하나다.
 *
 * <ul>
 *   <li>다른 모듈의 {@code infra}(저장소·외부 연동)·{@code web}(컨트롤러·필터)·{@code config}를 쓰지 않는다. 다른 모듈이 쓸 것은 그
 *       모듈의 {@code application}(공개 Service·{@code port}·{@code spi})이나 {@code domain}의 값
 *       타입(열거형·예외)으로 연다.
 *   <li>다른 모듈의 JPA 엔티티·Spring Data 저장소를 직접 쓰지 않는다.
 *   <li>{@code shared}는 기능 모듈의 {@code domain} 값 타입(공개 범위·역할 같은 열거형)만 안다. 그 밖에 필요한 것은 shared에 포트를 두고
 *       기능 모듈이 구현한다.
 * </ul>
 */
class ModuleBoundaryTest {

    private static final String ROOT = "com.team.blog";
    private static JavaClasses classes;
    private static Set<String> modules;

    @BeforeAll
    static void importClasses() {
        classes =
                new ClassFileImporter()
                        .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
                        .importPackages(ROOT);
        modules = new TreeSet<>();
        for (JavaClass c : classes) {
            String rest = c.getPackageName().substring(ROOT.length());
            if (rest.startsWith(".")) {
                String module = rest.substring(1).split("\\.")[0];
                if (!module.equals("shared")) {
                    modules.add(module);
                }
            }
        }
    }

    @Test
    void 기능_모듈을_찾는다() {
        org.assertj.core.api.Assertions.assertThat(modules)
                .contains("account", "post", "interaction", "discovery", "nest");
    }

    @TestFactory
    List<DynamicTest> 다른_모듈의_infra_web_config를_쓰지_않는다() {
        return modules.stream()
                .map(
                        m ->
                                DynamicTest.dynamicTest(
                                        m,
                                        () ->
                                                noClasses()
                                                        .that()
                                                        .resideOutsideOfPackage(pkg(m) + "..")
                                                        .should()
                                                        .dependOnClassesThat()
                                                        .resideInAnyPackage(
                                                                pkg(m) + ".infra..",
                                                                pkg(m) + ".web..",
                                                                pkg(m) + ".config..")
                                                        .because(
                                                                "다른 모듈은 "
                                                                        + m
                                                                        + "의 application·domain 값 타입만 쓴다")
                                                        .check(classes)))
                .toList();
    }

    @TestFactory
    List<DynamicTest> 다른_모듈의_엔티티_저장소를_쓰지_않는다() {
        return modules.stream()
                .map(
                        m ->
                                DynamicTest.dynamicTest(
                                        m,
                                        () ->
                                                noClasses()
                                                        .that()
                                                        .resideOutsideOfPackage(pkg(m) + "..")
                                                        .should()
                                                        .dependOnClassesThat(
                                                                entityOrRepositoryIn(m))
                                                        .check(classes)))
                .toList();
    }

    @Test
    void shared는_기능_모듈의_domain_값_타입만_안다() {
        noClasses()
                .that()
                .resideInAPackage(ROOT + ".shared..")
                .should()
                .dependOnClassesThat(
                        DescribedPredicate.describe(
                                "기능 모듈의 domain 밖 클래스",
                                c ->
                                        modules.stream()
                                                .anyMatch(
                                                        m ->
                                                                c.getPackageName()
                                                                                .startsWith(
                                                                                        pkg(m)
                                                                                                + ".")
                                                                        && !c.getPackageName()
                                                                                .startsWith(
                                                                                        pkg(m)
                                                                                                + ".domain"))))
                .because("shared는 포트(예: MemberAccessLookup)를 두고 기능 모듈이 구현한다")
                .check(classes);
    }

    private static String pkg(String module) {
        return ROOT + "." + module;
    }

    private static DescribedPredicate<JavaClass> entityOrRepositoryIn(String module) {
        return DescribedPredicate.describe(
                module + "의 JPA 엔티티·Spring Data 저장소",
                c ->
                        c.getPackageName().startsWith(pkg(module) + ".")
                                && (c.isAnnotatedWith(Entity.class)
                                        || c.isAssignableTo(Repository.class)));
    }
}
