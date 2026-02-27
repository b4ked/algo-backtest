/**
 * Vercel serverless function — symbol search via Yahoo Finance.
 *
 * Runs on Vercel's infrastructure (auto-deploys from git push) so it is
 * never affected by whether the VPS backend has been restarted or updated.
 *
 * Yahoo Finance blocks unauthenticated API calls from datacenter IPs.
 * The fix: first fetch finance.yahoo.com to acquire the GUCS consent
 * cookie, then use that cookie for the search request — exactly what a
 * real browser does.
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/124.0.0.0 Safari/537.36';

async function getYFCookie() {
  const resp = await fetch('https://finance.yahoo.com', {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
  });
  // Node 18.14+ exposes getSetCookie(); older versions only have get()
  if (typeof resp.headers.getSetCookie === 'function') {
    return resp.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  }
  const raw = resp.headers.get('set-cookie') || '';
  return raw.split(',').map((c) => c.trim().split(';')[0]).join('; ');
}

export default async function handler(req, res) {
  const q = (req.query?.q || '').trim();
  if (!q) {
    res.status(200).json({ results: [] });
    return;
  }

  try {
    const cookie = await getYFCookie();

    const url = new URL('https://query1.finance.yahoo.com/v1/finance/search');
    url.searchParams.set('q', q);
    url.searchParams.set('quotesCount', '10');
    url.searchParams.set('newsCount', '0');
    url.searchParams.set('enableFuzzyQuery', 'true');

    const searchResp = await fetch(url.toString(), {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    });

    if (!searchResp.ok) {
      console.error('Yahoo Finance search returned', searchResp.status);
      res.status(200).json({ results: [] });
      return;
    }

    const data = await searchResp.json();
    const quotes = data.quotes || [];

    res.status(200).json({
      results: quotes
        .filter((i) => i.symbol)
        .map((i) => ({
          symbol: i.symbol,
          name: i.shortname || i.longname || '',
          exchange: i.exchDisp || i.exchange || '',
          type: i.quoteType || '',
        })),
    });
  } catch (err) {
    console.error('Symbol search error:', err.message);
    res.status(200).json({ results: [] });
  }
}
