package com.team.blog.shared.web;

import com.team.blog.shared.error.NotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * React 화면 경로의 GET을 빌드 결과 {@code index.html}로 넘긴다 (React 빌드를 API와 같은 도메인에서 서빙).
 *
 * <ul>
 *   <li>대상: 확장자 없는 화면 경로 (예: {@code /settings}, {@code /signup/social}, {@code /@kim755030}).
 *   <li>제외: {@code /api/**}(없는 API는 404 공통 본문), {@code /oauth2/**}, {@code /login/oauth2/**},
 *       {@code /actuator/**}, 확장자 있는 정적 파일(없으면 404).
 *   <li>예외: 업데이트 소식 글 {@code /releases/v1.3.0}은 점이 있어도 화면이다(버전 번호 모양만).
 *   <li>005의 {@code PageShellController}({@code /@{handle}}, {@code /@{handle}/posts/{postId}})는 더
 *       구체적인 매핑이라 이 컨트롤러보다 먼저 선택된다(서버가 링크 미리보기 메타·404 상태를 넣는 화면). 첫 화면 {@code /}도 검색 엔진 메타를 넣으려고
 *       {@code PageShellController}가 맡는다.
 * </ul>
 */
@Controller
public class SpaForwardingController {

    static final String INDEX = "forward:/index.html";

    private static final List<String> EXCLUDED_PREFIXES =
            List.of("/api/", "/oauth2/", "/login/oauth2/", "/actuator/");

    private static final String SEGMENT = "[^.]*";
    private static final String FIRST = "^(?!(?:api|oauth2|actuator)$)[^.]*";
    private static final String VERSION = "v[0-9]+\\.[0-9]+\\.[0-9]+";

    @GetMapping({
        "/releases/{version:" + VERSION + "}",
        "/{a:" + FIRST + "}",
        "/{a:" + FIRST + "}/{b:" + SEGMENT + "}",
        "/{a:" + FIRST + "}/{b:" + SEGMENT + "}/{c:" + SEGMENT + "}",
        "/{a:" + FIRST + "}/{b:" + SEGMENT + "}/{c:" + SEGMENT + "}/{d:" + SEGMENT + "}",
        "/{a:" + FIRST + "}/{b:" + SEGMENT + "}/{c:" + SEGMENT + "}/{d:" + SEGMENT + "}/{e:"
                + SEGMENT + "}"
    })
    public String forward(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        for (String prefix : EXCLUDED_PREFIXES) {
            if (path.startsWith(prefix) || (path + "/").equals(prefix)) {
                throw new NotFoundException("not a screen path: " + path);
            }
        }
        return INDEX;
    }
}
