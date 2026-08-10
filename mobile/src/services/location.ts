import type { GeoPoint } from '@meetingpnt/shared';
import * as Location from 'expo-location';

/** Captures a single high-accuracy location fix — the default, per the privacy-first design. */
export async function getCurrentLocationSnapshot(): Promise<GeoPoint | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}

/**
 * Follows the leader's position while they're sharing it ("follow me").
 *
 * The one subscription in the app, and deliberately **foreground only**. The location permission
 * this app asks for promises the user their position is never read in the background, and honouring
 * that is worth more than covering the pocketed-phone case: background location on Android needs a
 * separate permission, a persistent foreground-service notification, and a Play Store
 * justification. Sharing therefore pauses when the leader leaves the app, and the server-side lease
 * lets it lapse rather than hanging open.
 *
 * The server throttles what it stores, so reporting a little more eagerly than that costs nothing
 * but a discarded request.
 */
export async function watchPosition(
  onFix: (point: GeoPoint) => void,
): Promise<Location.LocationSubscription | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 15_000,
      distanceInterval: 25,
    },
    (position) => onFix({ lat: position.coords.latitude, lng: position.coords.longitude }),
  );
}
