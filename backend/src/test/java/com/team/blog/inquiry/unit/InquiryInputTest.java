package com.team.blog.inquiry.unit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import com.team.blog.inquiry.application.InquiryInput;
import com.team.blog.inquiry.domain.InquiryCategory;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ValidationException;
import java.util.List;
import org.junit.jupiter.api.Test;

/** 문의 입력 형식 검사 (023). */
class InquiryInputTest {

    private static List<FieldError> errorsOf(Runnable call) {
        try {
            call.run();
        } catch (ValidationException e) {
            return e.errors();
        }
        throw new AssertionError("ValidationException이 나야 한다");
    }

    @Test
    void 내용은_앞뒤_공백을_빼고_저장한다() {
        InquiryInput input = InquiryInput.parse("BUG", "  글이 안 올라가요 \n", null, null);
        assertThat(input.category()).isEqualTo(InquiryCategory.BUG);
        assertThat(input.content()).isEqualTo("글이 안 올라가요");
        assertThat(input.targetHandle()).isNull();
        assertThat(input.imageId()).isNull();
    }

    @Test
    void 종류와_내용이_없으면_칸_오류를_모아서_돌려준다() {
        List<FieldError> errors = errorsOf(() -> InquiryInput.parse(null, "   ", null, null));
        assertThat(errors)
                .extracting(FieldError::field, FieldError::code)
                .containsExactly(tuple("category", "REQUIRED"), tuple("content", "REQUIRED"));
        assertThat(errors).extracting(FieldError::message).noneMatch(m -> m.endsWith("."));
    }

    @Test
    void 모르는_종류는_INVALID_VALUE() {
        assertThat(errorsOf(() -> InquiryInput.parse("SPAM", "내용", null, null)))
                .extracting(FieldError::field, FieldError::code)
                .containsExactly(tuple("category", "INVALID_VALUE"));
    }

    @Test
    void 내용은_2000자까지() {
        String max = "가".repeat(InquiryInput.CONTENT_MAX_CHARS);
        assertThat(InquiryInput.parse("OTHER", max, null, null).content()).isEqualTo(max);
        assertThat(errorsOf(() -> InquiryInput.parse("OTHER", max + "가", null, null)))
                .extracting(FieldError::code)
                .containsExactly("TOO_LONG");
    }

    @Test
    void 사용자_신고의_블로그_주소는_골뱅이와_주소_앞부분을_뗀다() {
        assertThat(InquiryInput.parse("USER_REPORT", "광고만 올려요", "@Kim_One", null).targetHandle())
                .isEqualTo("kim_one");
        assertThat(
                        InquiryInput.parse(
                                        "USER_REPORT",
                                        "광고만 올려요",
                                        "https://baselog.java21.net/@kim_one/posts/3",
                                        null)
                                .targetHandle())
                .isEqualTo("kim_one");
        assertThat(InquiryInput.parse("USER_REPORT", "내용", "  ", null).targetHandle()).isNull();
    }

    @Test
    void 사용자_신고가_아니면_블로그_주소는_버린다() {
        assertThat(InquiryInput.parse("BUG", "내용", "@kim_one", null).targetHandle()).isNull();
    }

    @Test
    void 블로그_주소_형식이_아니면_칸_오류() {
        assertThat(errorsOf(() -> InquiryInput.parse("USER_REPORT", "내용", "@김민서!", null)))
                .extracting(FieldError::field)
                .containsExactly("targetHandle");
    }

    @Test
    void 사진_번호는_1_이상_정수() {
        assertThat(InquiryInput.parse("BUG", "내용", null, 42).imageId()).isEqualTo(42L);
        assertThat(InquiryInput.parse("BUG", "내용", null, "42").imageId()).isEqualTo(42L);
        assertThat(errorsOf(() -> InquiryInput.parse("BUG", "내용", null, 0)))
                .extracting(FieldError::field)
                .containsExactly("imageId");
        assertThat(errorsOf(() -> InquiryInput.parse("BUG", "내용", null, "abc")))
                .extracting(FieldError::field)
                .containsExactly("imageId");
    }

    @Test
    void 답변은_필수이고_2000자까지() {
        assertThat(InquiryInput.parseAnswer(" 고쳤어요 ")).isEqualTo("고쳤어요");
        assertThatThrownBy(() -> InquiryInput.parseAnswer(null))
                .isInstanceOf(ValidationException.class);
        assertThat(errorsOf(() -> InquiryInput.parseAnswer("가".repeat(2001))))
                .extracting(FieldError::field, FieldError::code)
                .containsExactly(tuple("answer", "TOO_LONG"));
    }
}
