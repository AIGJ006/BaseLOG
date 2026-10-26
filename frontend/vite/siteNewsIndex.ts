import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';

/**
 * 검색 엔진 노출: 공지·업데이트 소식 글의 제목·날짜 목록을 빌드 결과 `site-news.json`으로 낸다.
 *
 * 글은 화면 묶음(JS)에만 들어 있어 서버가 읽을 수 없다. 서버 셸(`ScreenPageMeta`)이 이 파일을 읽어
 * `/notices/{id}`·`/releases/{id}` 첫 응답에 글마다 다른 `<title>`·canonical을 넣는다(구글 "표준이 없는 중복 페이지" 방지).
 * id는 화면 `noteId`와 같다(파일 이름에서 `.md`를 뺀 것).
 */
export interface SiteNewsEntry {
  id: string;
  title: string;
  date: string;
}

export interface SiteNewsIndex {
  notices: SiteNewsEntry[];
  releases: SiteNewsEntry[];
}

const HEAD = /^<!--\s*(\w+):\s*(.*?)\s*-->$/;

/** 머리 주석 `<!-- title: … -->`·`<!-- date: … -->`만 읽는다(본문이 시작되면 멈춤). 없으면 빈 글자 */
export function readEntry(fileName: string, source: string): SiteNewsEntry {
  const head: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    const match = HEAD.exec(trimmed);
    if (!match) break;
    head[match[1]] ??= match[2];
  }
  return { id: fileName.replace(/\.md$/, ''), title: head.title ?? '', date: head.date ?? '' };
}

function readFolder(folder: string): SiteNewsEntry[] {
  return readdirSync(folder)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => readEntry(name, readFileSync(join(folder, name), 'utf8')));
}

export function buildSiteNewsIndex(root: string): SiteNewsIndex {
  return {
    notices: readFolder(join(root, 'notices')),
    releases: readFolder(join(root, 'releases')),
  };
}

export function siteNewsIndex(root: string): Plugin {
  return {
    name: 'blog-site-news-index',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'site-news.json',
        source: JSON.stringify(buildSiteNewsIndex(root)),
      });
    },
  };
}
