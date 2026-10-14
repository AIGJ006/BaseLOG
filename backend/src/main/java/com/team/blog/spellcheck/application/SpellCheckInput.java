package com.team.blog.spellcheck.application;

/**
 * 공급자에 보내는 입력.
 *
 * @param text 정리하고 자른 본문
 * @param maxIssues 돌려받을 최대 고칠 곳 수
 */
public record SpellCheckInput(String text, int maxIssues) {}
