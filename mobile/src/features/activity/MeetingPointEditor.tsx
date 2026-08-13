import type { MeetingPoint } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Button,
  ButtonRow,
  Card,
  TextField,
  color,
  minTouchTarget,
  radius,
  space,
  text,
  toneTint,
} from '../../ui';

interface Props {
  mode: 'edit' | 'next';
  nextPlanned: MeetingPoint | undefined;
  label: string;
  onLabelChange: (value: string) => void;
  url: string;
  onUrlChange: (value: string) => void;
  time: Date | null;
  onTimeChange: (value: Date) => void;
  showPicker: boolean;
  onShowPicker: (value: boolean) => void;
  onUseCurrentLocation: () => void;
  onOpenMaps: () => void;
  onPasteLink: () => void;
  onSave: () => void;
  onCancel: () => void;
  submitting: boolean;
  error: string | null;
}

/**
 * Doubles as "fix this stop" and "move the group on". When the route was planned in advance the
 * next stop pre-fills, because what usually changes is the detail — the plan said the market at
 * 11, they got there at 11:40 by the other entrance.
 */
export function MeetingPointEditor({
  mode,
  nextPlanned,
  label,
  onLabelChange,
  url,
  onUrlChange,
  time,
  onTimeChange,
  showPicker,
  onShowPicker,
  onUseCurrentLocation,
  onOpenMaps,
  onPasteLink,
  onSave,
  onCancel,
  submitting,
  error,
}: Props) {
  return (
    <Card style={styles.card}>
      <Text style={text.heading}>
        {mode === 'edit'
          ? 'Edit meeting point'
          : nextPlanned
            ? 'Next stop on the plan'
            : 'Next meeting point'}
      </Text>
      {mode === 'next' && (
        <Text style={[text.secondary, styles.blurb]}>
          {nextPlanned
            ? 'Change anything that turned out differently, then confirm to move the group.'
            : "You're past the last planned stop — add where the group is going now."}
        </Text>
      )}

      <TextField label="Label (optional)" value={label} onChangeText={onLabelChange} />
      <TextField
        label="Google Maps URL"
        autoCapitalize="none"
        autoCorrect={false}
        value={url}
        onChangeText={onUrlChange}
      />

      <View style={styles.sources}>
        <Button label="Use my location" onPress={onUseCurrentLocation} variant="secondary" grow />
        <Button label="Open Maps" onPress={onOpenMaps} variant="secondary" grow />
        <Button label="Paste link" onPress={onPasteLink} variant="secondary" grow />
      </View>

      <Pressable style={styles.timeField} onPress={() => onShowPicker(true)}>
        <Text style={time ? text.body : text.muted}>
          {time ? time.toLocaleString() : 'Time (optional — defaults to now)'}
        </Text>
      </Pressable>
      {showPicker && (
        <DateTimePicker
          value={time ?? new Date()}
          mode="datetime"
          onChange={(_event, selected) => {
            onShowPicker(Platform.OS === 'ios');
            if (selected) onTimeChange(selected);
          }}
        />
      )}

      <ButtonRow>
        <Button
          label={submitting ? 'Saving…' : mode === 'edit' ? 'Save' : "We're here"}
          onPress={onSave}
          busy={submitting}
          grow
        />
        <Button label="Cancel" onPress={onCancel} variant="secondary" grow />
      </ButtonRow>

      {error && <Text style={styles.error}>{error}</Text>}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.md },
  blurb: { marginTop: space.xs, marginBottom: space.md },
  sources: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  timeField: {
    minHeight: minTouchTarget,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  error: { color: toneTint.danger.fg, marginTop: space.sm },
});
