import type { GeoPoint, TransportMode } from '@meetingpnt/shared';
import { env } from '../config/env.js';

interface DirectionsResult {
  etaSeconds: number;
}

const TRANSPORT_MODE_TO_TRAVEL_MODE: Record<TransportMode, string> = {
  driving: 'DRIVE',
  walking: 'WALK',
  bicycling: 'BICYCLE',
  transit: 'TRANSIT',
};

/** Uses the Routes API (computeRoutes) — the legacy Directions API is disabled on newer
 * Google Cloud projects in favor of this one. */
export async function getEta(
  origin: GeoPoint,
  destination: GeoPoint,
  transportMode: TransportMode,
): Promise<DirectionsResult | null> {
  if (!env.GOOGLE_MAPS_API_KEY) {
    console.warn('[googleMaps] GOOGLE_MAPS_API_KEY not set, skipping ETA calculation');
    return null;
  }

  const travelMode = TRANSPORT_MODE_TO_TRAVEL_MODE[transportMode];

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
      destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lng } } },
      travelMode,
      ...(travelMode === 'DRIVE'
        ? { routingPreference: 'TRAFFIC_AWARE', departureTime: new Date().toISOString() }
        : {}),
    }),
  });

  if (!res.ok) {
    console.error('[googleMaps] Routes API request failed', res.status, await res.text());
    return null;
  }

  const data = (await res.json()) as { routes?: Array<{ duration?: string }> };
  const durationStr = data.routes?.[0]?.duration; // e.g. "740s"
  if (!durationStr) {
    console.error('[googleMaps] Routes API returned no route');
    return null;
  }

  const etaSeconds = Number(durationStr.replace('s', ''));
  if (!Number.isFinite(etaSeconds)) {
    return null;
  }

  return { etaSeconds };
}
