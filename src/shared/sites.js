// URL matching against the work / distraction lists. Owner: Anish (Engine).
// A site entry is a hostname ("wikipedia.org"), optionally with a path
// ("docs.google.com/document"). "wikipedia.org" also matches "en.wikipedia.org".

export function normalizeSite(entry) {
  return String(entry || '')
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}

export function urlMatches(url, sites) {
  if (!url || !sites || !sites.length) return false;
  let u;
  try { u = new URL(url); } catch { return false; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname.toLowerCase();
  return sites.some((raw) => {
    const site = normalizeSite(raw);
    if (!site) return false;
    const slash = site.indexOf('/');
    const sHost = slash < 0 ? site : site.slice(0, slash);
    const sPath = slash < 0 ? '' : site.slice(slash);
    const hostOk = host === sHost || host.endsWith('.' + sHost);
    return hostOk && (!sPath || path.startsWith(sPath));
  });
}

export const isWorkUrl = (url, settings) => urlMatches(url, settings.workSites);
export const isDistractionUrl = (url, settings) => urlMatches(url, settings.distractionSites);
