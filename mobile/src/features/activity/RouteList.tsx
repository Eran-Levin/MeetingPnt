import type { MeetingPoint } from '@meetingpnt/shared';
import { Linking, Text } from 'react-native';
import { Row, Section, StepMarker, color, text } from '../../ui';

/**
 * The whole itinerary, for anyone on the activity — the route isn't secret, and knowing the shape
 * of the day is useful. Three states so a glance answers "where am I going" without reading:
 * stops already behind us fade, the current one is picked out, the rest read as plan.
 */
export function RouteList({
  points,
  currentPointId,
}: {
  points: MeetingPoint[];
  currentPointId: string | null;
}) {
  if (points.length <= 1) return null;

  return (
    <Section label="The route">
      {points.map((point, index) => {
        const isCurrent = point.id === currentPointId;
        const visited = point.arrivedAt !== null && !isCurrent;
        return (
          <Row
            key={point.id}
            title={point.label || 'Meeting point'}
            subtitle={
              new Date(point.time).toLocaleString() +
              (isCurrent ? '  ·  you are heading here' : visited ? '  ·  done' : '')
            }
            leading={<StepMarker label={String(index + 1)} active={isCurrent} />}
            trailing={
              <Text style={[text.secondary, { color: color.accentText }]}>Directions</Text>
            }
            onPress={() => Linking.openURL(point.googleMapsUrl)}
            active={isCurrent}
            done={visited}
            last={index === points.length - 1}
          />
        );
      })}
    </Section>
  );
}
