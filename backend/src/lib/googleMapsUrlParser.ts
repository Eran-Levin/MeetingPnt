interface ParsedCoordinates {
  lat: number;
  lng: number;
}

const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl'];

function extractFromUrlString(url: string): ParsedCoordinates | null {
  // Prefer the precise dropped-pin coords over the map's center point, when present.
  const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) {
    return { lat: Number(dataMatch[1]), lng: Number(dataMatch[2]) };
  }

  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  }

  try {
    const parsed = new URL(url);
    const q = parsed.searchParams.get('q') ?? parsed.searchParams.get('query');
    if (q) {
      const qMatch = q.match(/^(-?\d+\.\d+),(-?\d+\.\d+)$/);
      if (qMatch) {
        return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
      }
    }
  } catch {
    // Not a parseable URL — fall through to null.
  }

  return null;
}

/**
 * Extracts coordinates from a Google Maps URL. Shortened links (maps.app.goo.gl, goo.gl/maps)
 * are resolved by following their redirect first — restricted to those known hosts only, so we
 * never fetch an arbitrary leader-supplied URL server-side.
 */
export async function parseGoogleMapsUrl(url: string): Promise<ParsedCoordinates | null> {
  let target = url;

  try {
    const parsed = new URL(url);
    if (SHORT_LINK_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))) {
      const res = await fetch(url, { redirect: 'follow' });
      target = res.url || url;
    }
  } catch {
    return null;
  }

  return extractFromUrlString(target);
}
