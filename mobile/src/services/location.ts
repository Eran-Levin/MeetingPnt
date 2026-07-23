import type { GeoPoint } from '@meetingpnt/shared';
import * as Location from 'expo-location';

/** Captures a single high-accuracy location fix — no watch/subscription, per the privacy-first design. */
export async function getCurrentLocationSnapshot(): Promise<GeoPoint | null> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return null;

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return { lat: position.coords.latitude, lng: position.coords.longitude };
}
