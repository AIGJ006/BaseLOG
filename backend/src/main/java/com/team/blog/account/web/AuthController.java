package com.team.blog.account.web;

import com.team.blog.account.application.EmailVerificationService;
import com.team.blog.account.application.LoginOutcome;
import com.team.blog.account.application.LoginService;
import com.team.blog.account.application.PasswordResetService;
import com.team.blog.account.application.SignedUpMember;
import com.team.blog.account.application.SignupCodeService;
import com.team.blog.account.application.SignupService;
import com.team.blog.account.infra.security.SessionLogin;
import com.team.blog.account.web.dto.EmailSignupRequest;
import com.team.blog.account.web.dto.MessageOnly;
import com.team.blog.account.web.dto.PasswordResetConfirmRequest;
import com.team.blog.account.web.dto.PasswordResetRequest;
import com.team.blog.account.web.dto.SignupCodeRequest;
import com.team.blog.account.web.dto.SignupCodeVerifyRequest;
import com.team.blog.account.web.dto.SignupResult;
import com.team.blog.account.web.dto.TokenRequest;
import com.team.blog.account.web.dto.VerificationResult;
import com.team.blog.shared.error.ApiException;
import com.team.blog.shared.error.CommonReasonCode;
import com.team.blog.shared.security.CurrentUser;
import com.team.blog.shared.security.LoginRequired;
import com.team.blog.shared.web.ClientIp;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * 인증 API (contracts/openapi.yaml). 로그인·로그아웃({@code POST /api/auth/login}·{@code /logout})은 Spring
 * Security가 처리한다({@code AccountSecurityCustomizer}).
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final SignupService signupService;
    private final EmailVerificationService emailVerificationService;
    private final LoginService loginService;
    private final SessionLogin sessionLogin;
    private final PasswordResetService passwordResetService;
    private final SignupCodeService signupCodeService;

    public AuthController(
            SignupService signupService,
            EmailVerificationService emailVerificationService,
            LoginService loginService,
            SessionLogin sessionLogin,
            PasswordResetService passwordResetService,
            SignupCodeService signupCodeService) {
        this.signupService = signupService;
        this.emailVerificationService = emailVerificationService;
        this.loginService = loginService;
        this.sessionLogin = sessionLogin;
        this.passwordResetService = passwordResetService;
        this.signupCodeService = signupCodeService;
    }

    /**
     * CSRF 토큰 쿠키 발급 ({@code issueCsrfToken}). 앱 첫 진입 때 호출하며 재동의 전·탈퇴 유예 중에도 허용된다. 쿠키는 공통
     * SecurityConfig의 CSRF 필터가 싣는다.
     */
    @GetMapping("/csrf")
    public ResponseEntity<Void> issueCsrfToken() {
        return ResponseEntity.noContent().build();
    }

    /** 가입 인증 코드 받기 → 202. 같은 이메일 1분 1번·하루 10번, 같은 IP 1시간 20번. 이메일 가입이면 이미 가입된 이메일은 400 칸 오류. */
    @PostMapping("/signup-code")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void sendSignupCode(@RequestBody SignupCodeRequest body, HttpServletRequest request) {
        if (body == null) {
            throw new ApiException(CommonReasonCode.MALFORMED_REQUEST);
        }
        signupCodeService.send(body.email(), body.forEmailSignup(), ClientIp.of(request));
    }

    /** 가입 인증 코드 확인 → 200 {@code {verified: true}}. 틀리거나 만료면 400 {@code code} 칸 오류. */
    @PostMapping("/signup-code/verify")
    public VerificationResult verifySignupCode(@RequestBody SignupCodeVerifyRequest body) {
        if (body == null) {
            throw new ApiException(CommonReasonCode.MALFORMED_REQUEST);
        }
        signupCodeService.verify(body.email(), body.code());
        return new VerificationResult(true);
    }

    /**
     * 이메일 가입 ({@code signupWithEmail}) → 201. 가입 인증 코드로 확인한 이메일만 받는다. 성공하면 세션 ID를 새로 발급하고 바로 로그인
     * 상태가 된다(인증된 계정).
     */
    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public SignupResult signup(
            @RequestBody EmailSignupRequest body,
            HttpServletRequest request,
            HttpServletResponse response) {
        SignedUpMember member = signupService.signupWithEmail(body.toCommand());
        LoginOutcome outcome = loginService.onSuccess(member.memberId());
        sessionLogin.login(
                member.memberId(),
                member.role().name(),
                member.provider(),
                outcome,
                request,
                response);
        return new SignupResult(member.handle(), member.nickname(), member.emailVerified());
    }

    /** 인증 메일 다시 보내기 ({@code resendVerificationMail}) → 202. 1분 1번·하루 10번. */
    @PostMapping("/email-verification")
    @LoginRequired
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void resendVerification(@CurrentUser Long memberId) {
        emailVerificationService.resend(memberId);
    }

    /**
     * 인증 링크 확인 ({@code confirmEmailVerification}). 메일 보안 검사기가 링크를 미리 열어도 토큰이 소모되지 않게 화면이 POST로 보낸다.
     * 로그인 여부와 무관.
     */
    @PostMapping("/email-verification/confirm")
    public VerificationResult confirmVerification(@RequestBody TokenRequest body) {
        if (body == null) {
            throw new ApiException(CommonReasonCode.MALFORMED_REQUEST);
        }
        emailVerificationService.confirm(body.token());
        return new VerificationResult(true);
    }

    /** 비밀번호 찾기 ({@code requestPasswordReset}) → 202, 가입 여부와 무관하게 같은 문구. 조회·발송은 비동기(FR-042·043). */
    @PostMapping("/password-reset")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public MessageOnly requestPasswordReset(
            @RequestBody PasswordResetRequest body, HttpServletRequest request) {
        if (body == null) {
            throw new ApiException(CommonReasonCode.MALFORMED_REQUEST);
        }
        passwordResetService.request(body.email(), ClientIp.of(request));
        return new MessageOnly(PASSWORD_RESET_ACCEPTED);
    }

    /** 재설정 링크로 새 비밀번호 저장 ({@code confirmPasswordReset}) → 204, 모든 세션 삭제(FR-044). */
    @PostMapping("/password-reset/confirm")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void confirmPasswordReset(@RequestBody PasswordResetConfirmRequest body) {
        if (body == null) {
            throw new ApiException(CommonReasonCode.MALFORMED_REQUEST);
        }
        passwordResetService.confirm(body.token(), body.newPassword(), body.newPasswordConfirm());
    }

    static final String PASSWORD_RESET_ACCEPTED = "가입된 이메일이면 안내 메일을 보냈어요";
}
