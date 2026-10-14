package com.team.blog.support.ai;

import com.team.blog.spellcheck.application.SpellCheckInput;
import com.team.blog.spellcheck.application.SpellChecker;
import com.team.blog.spellcheck.application.SpellIssue;
import com.team.blog.spellcheck.application.SpellOutcome;
import com.team.blog.tag.application.suggest.Provider;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.core.Ordered;

/**
 * 시험용 가짜 맞춤법 검사 공급자 (022). {@link FakeSpellCheckConfiguration}이 공급자마다 하나씩 등록하고, 순서가 가장 앞서 라우터가 실제
 * Bean 대신 고른다. {@link #respond}로 다음 응답들을 정하고, 다 쓰면 기본 응답({@link #DEFAULT_ISSUES}).
 */
public class FakeSpellChecker implements SpellChecker, Ordered {

    public static final List<SpellIssue> DEFAULT_ISSUES =
            List.of(new SpellIssue("되요", "돼요", "'돼요'가 맞아요"));

    private final Provider provider;
    private final Deque<SpellOutcome> scripted = new ArrayDeque<>();
    private final List<SpellCheckInput> inputs = new CopyOnWriteArrayList<>();
    private volatile boolean configured = true;

    public FakeSpellChecker(Provider provider) {
        this.provider = provider;
    }

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Provider provider() {
        return provider;
    }

    @Override
    public boolean isConfigured() {
        return configured;
    }

    @Override
    public SpellOutcome check(SpellCheckInput input) {
        inputs.add(input);
        synchronized (scripted) {
            SpellOutcome next = scripted.poll();
            return next != null ? next : new SpellOutcome.Success(DEFAULT_ISSUES);
        }
    }

    public FakeSpellChecker respond(SpellOutcome... outcomes) {
        synchronized (scripted) {
            scripted.addAll(List.of(outcomes));
        }
        return this;
    }

    public FakeSpellChecker respondIssues(SpellIssue... issues) {
        return respond(new SpellOutcome.Success(List.of(issues)));
    }

    public FakeSpellChecker configured(boolean value) {
        this.configured = value;
        return this;
    }

    public int calls() {
        return inputs.size();
    }

    public SpellCheckInput lastInput() {
        return inputs.get(inputs.size() - 1);
    }

    public void reset() {
        synchronized (scripted) {
            scripted.clear();
        }
        inputs.clear();
        configured = true;
    }
}
