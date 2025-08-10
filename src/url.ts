export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    const proto = u.protocol.toLowerCase();
    const host = u.hostname.toLowerCase();
    const port = u.port && !defaultPort(proto, u.port) ? `:${u.port}` : '';
    let pathname = u.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }
    const searchParams = new URLSearchParams(u.searchParams as any);
    const sortedParams = [...searchParams.entries()].sort(([a], [b]) => a.localeCompare(b));
    const query = sortedParams.length > 0
      ? `?${sortedParams.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`
      : '';
    const hash = u.hash || '';
    return `${proto}//${host}${port}${pathname}${query}${hash}`;
  } catch {
    return '';
  }
}

function defaultPort(protocol: string, port: string): boolean {
  return (protocol === 'http:' && port === '80') || (protocol === 'https:' && port === '443');
}
