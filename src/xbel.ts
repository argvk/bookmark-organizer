import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  trimValues: true,
});

export interface ParsedBookmark {
  title: string;
  url: string;
  path: string; // slash-joined folder path
}

type XbelNode = any; // fast-xml-parser returns untyped structures; narrow where used

function readTitle(node: XbelNode): string {
  if (node == null) return '';
  const t = node.title as unknown;
  if (t == null) return '';
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return (t[0] as string | undefined) ?? '';
  return String(t);
}

function coerceArray<T>(maybeArr: T | T[] | undefined | null): T[] {
  if (maybeArr == null) return [];
  return Array.isArray(maybeArr) ? maybeArr : [maybeArr];
}

export function parseXbelToBookmarks(xmlString: string): { bookmarks: ParsedBookmark[]; allFolderPaths: string[] } {
  const root = parser.parse(xmlString) as { xbel?: XbelNode } | XbelNode;
  const xbel: XbelNode = (root as any)?.xbel ?? root;
  const bookmarks: ParsedBookmark[] = [];
  const allFolderPaths: string[] = [];

  function traverseFolder(node: XbelNode, pathSegments: string[]): void {
    const currentTitle = readTitle(node);
    const currentPath = currentTitle ? [...pathSegments, currentTitle] : [...pathSegments];
    if (currentPath.length > 0) {
      allFolderPaths.push(currentPath.join('/'));
    }

    for (const bm of coerceArray<any>(node.bookmark)) {
      const url = bm['@_href'] || bm['@_href'.toLowerCase()];
      if (!url) continue;
      const title = readTitle(bm) || url;
      bookmarks.push({ title, url, path: currentPath.join('/') });
    }

    for (const folder of coerceArray<any>(node.folder)) {
      traverseFolder(folder, currentPath);
    }
  }

  // root-level bookmarks (rare) and folders
  for (const bm of coerceArray<any>(xbel.bookmark)) {
    const url = bm['@_href'];
    if (!url) continue;
    const title = readTitle(bm) || url;
    bookmarks.push({ title, url, path: '' });
  }
  for (const folder of coerceArray<any>(xbel.folder)) {
    traverseFolder(folder, []);
  }

  return { bookmarks, allFolderPaths };
}

export function collectFolderNames(paths: string[]): Set<string> {
  const names = new Set<string>();
  for (const p of paths) {
    const segs = p.split('/').filter(Boolean);
    for (const s of segs) names.add(s);
  }
  return names;
}


