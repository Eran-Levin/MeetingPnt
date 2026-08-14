import type { MeetingPoint } from '@meetingpnt/shared';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button, ButtonRow, Card, space, text } from '../../ui';

interface Props {
  point: MeetingPoint | undefined;
  /** Falls back to explaining why there's nothing to head to yet. */
  plannedCount: number;
  isLeader: boolean;
  /** Members offer to share their ETA from here; leaders edit the stop instead. */
  onOnMyWay?: () => void;
  omwBusy?: boolean;
  onEdit?: () => void;
  message?: string | null;
}

/**
 * Where to go now, and nothing else. It leads the screen so a member glancing at their phone
 * mid-walk never has to work out which pin is theirs — the route underneath is context.
 */
export function CurrentPointCard({
  point,
  plannedCount,
  isLeader,
  onOnMyWay,
  omwBusy = false,
  onEdit,
  message,
}: Props) {
  if (!point) {
    return (
      <Card>
        <Text style={text.secondary}>
          {plannedCount > 0
            ? "The activity hasn't started — the route is below."
            : 'No meeting point set yet.'}
        </Text>
      </Card>
    );
  }

  return (
    <Card accent>
      <Text style={styles.label}>{point.label || 'Meeting point'}</Text>
      <Text style={[text.secondary, styles.time]}>{new Date(point.time).toLocaleString()}</Text>

      <ButtonRow>
        <Button label="Directions" onPress={() => Linking.openURL(point.googleMapsUrl)} grow />
        {isLeader && onEdit && <Button label="Edit" onPress={onEdit} variant="secondary" grow />}
        {!isLeader && onOnMyWay && (
          <Button
            label={omwBusy ? 'Sharing…' : 'On my way'}
            onPress={onOnMyWay}
            busy={omwBusy}
            variant="secondary"
            grow
          />
        )}
      </ButtonRow>

      {message && <Text style={[text.secondary, styles.message]}>{message}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 18, fontWeight: '600' },
  time: { marginTop: space.xs, marginBottom: space.md },
  message: { marginTop: space.sm },
});
