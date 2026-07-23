import { TransportMode } from '../enums/index.js';

const TRANSPORT_MODE_TO_GOOGLE_MODE: Record<TransportMode, string> = {
  [TransportMode.Driving]: 'driving',
  [TransportMode.Walking]: 'walking',
  [TransportMode.Bicycling]: 'bicycling',
  [TransportMode.Transit]: 'transit',
};

export function transportModeToGoogleMode(mode: TransportMode): string {
  return TRANSPORT_MODE_TO_GOOGLE_MODE[mode];
}

export function isBeforeStartTime(startAt: string, now: Date = new Date()): boolean {
  return now.getTime() < new Date(startAt).getTime();
}
