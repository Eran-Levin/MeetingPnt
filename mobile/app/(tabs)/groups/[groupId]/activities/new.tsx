import type { TransportMode } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { activitiesApi } from '../../../../../src/api/activitiesApi';
import { ApiError } from '../../../../../src/api/client';
import {
  Button,
  Chip,
  ChipRow,
  Screen,
  Section,
  TextField,
  color,
  minTouchTarget,
  radius,
  space,
  text,
  toneTint,
} from '../../../../../src/ui';

const TRANSPORT_MODES: TransportMode[] = ['driving', 'walking', 'bicycling', 'transit'];
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NewActivityScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Timed activities are entered as one date plus two clock times; all-day ones as two dates.
  const [allDay, setAllDay] = useState(false);
  const [startAt, setStartAt] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [endAt, setEndAt] = useState(new Date(Date.now() + 2 * 60 * 60 * 1000));
  const [picker, setPicker] = useState<null | 'date' | 'startTime' | 'endTime' | 'endDate'>(null);
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [requiresRsvp, setRequiresRsvp] = useState(true);
  const [repeats, setRepeats] = useState(false);
  const [intervalWeeks, setIntervalWeeks] = useState('1');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([]);
  const [count, setCount] = useState('8');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort(),
    );
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    if (repeats && daysOfWeek.length === 0) {
      setError('Pick at least one day of the week to repeat on.');
      return;
    }
    // All-day activities cover whole days; timed ones share a date and differ only by clock time.
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (allDay) {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 0);
    } else {
      end.setFullYear(start.getFullYear(), start.getMonth(), start.getDate());
    }

    if (end <= start) {
      setError(
        allDay
          ? 'The end date must not be before the start date.'
          : 'The end time must be after the start time.',
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const result = await activitiesApi.create(groupId, {
        title,
        description: description || undefined,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        allDay,
        transportMode,
        requiresRsvp,
        recurrence: repeats
          ? {
              frequency: 'weekly',
              intervalWeeks: Number(intervalWeeks) || 1,
              daysOfWeek,
              endType: 'count',
              count: Number(count),
            }
          : undefined,
      });
      if ('activities' in result) {
        router.replace(`/(tabs)/groups/${groupId}`);
      } else {
        router.replace(`/(tabs)/groups/${groupId}/activities/${result.activity.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create activity');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title="New event" bottomInset={80}>
      <TextField
        label="Title"
        placeholder="Sunrise walk — Old Town"
        value={title}
        onChangeText={setTitle}
      />
      <TextField
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
      />

      <Section label="When" first>
        <Toggle
          label="Spans whole days"
          hint="A multi-day trip. Each day is its own event."
          value={allDay}
          onValueChange={setAllDay}
        />

        <PickerField
          label={allDay ? 'Start date' : 'Date'}
          value={startAt.toLocaleDateString()}
          onPress={() => setPicker('date')}
        />

        {allDay ? (
          <PickerField
            label="End date"
            value={endAt.toLocaleDateString()}
            onPress={() => setPicker('endDate')}
          />
        ) : (
          <>
            <PickerField
              label="Start time"
              value={startAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              onPress={() => setPicker('startTime')}
            />
            <PickerField
              label="End time"
              value={endAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              onPress={() => setPicker('endTime')}
            />
          </>
        )}

        {picker && (
          <DateTimePicker
            value={picker === 'endDate' || picker === 'endTime' ? endAt : startAt}
            mode={picker === 'startTime' || picker === 'endTime' ? 'time' : 'date'}
            onChange={(_event, selected) => {
              setPicker(Platform.OS === 'ios' ? picker : null);
              if (!selected) return;
              if (picker === 'endDate' || picker === 'endTime') setEndAt(selected);
              else setStartAt(selected);
            }}
          />
        )}
      </Section>

      <Section label="Attendance">
        {/* Off is how a trip day works: people booked the trip, so they don't re-confirm each
            morning — but they can still decline the one day they're sitting out. */}
        <Toggle
          label="Approve attendance"
          hint={
            requiresRsvp
              ? 'Members are asked to confirm they’re coming.'
              : 'Members count as coming as soon as this is published — they can still decline.'
          }
          value={requiresRsvp}
          onValueChange={setRequiresRsvp}
        />
      </Section>

      <Section label="Mode of transport">
        <ChipRow>
          {TRANSPORT_MODES.map((mode) => (
            <Chip
              key={mode}
              label={mode}
              selected={transportMode === mode}
              onPress={() => setTransportMode(mode)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section label="Repeat">
        <Toggle label="Repeat weekly" value={repeats} onValueChange={setRepeats} />

        {repeats && (
          <View style={styles.repeat}>
            <View style={styles.inlineRow}>
              <Text style={text.body}>Every</Text>
              <TextField
                keyboardType="number-pad"
                value={intervalWeeks}
                onChangeText={setIntervalWeeks}
                containerStyle={styles.number}
              />
              <Text style={text.body}>week(s)</Text>
            </View>

            <ChipRow>
              {WEEKDAY_LABELS.map((label, day) => (
                <Chip
                  key={day}
                  label={label}
                  selected={daysOfWeek.includes(day)}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </ChipRow>

            <View style={styles.inlineRow}>
              <Text style={text.body}>For</Text>
              <TextField
                keyboardType="number-pad"
                value={count}
                onChangeText={setCount}
                containerStyle={styles.number}
              />
              <Text style={text.body}>occurrences</Text>
            </View>
          </View>
        )}
      </Section>

      {error && (
        <View style={styles.error}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Button
        label={submitting ? 'Creating…' : repeats ? 'Create series (drafts)' : 'Create draft'}
        onPress={handleSubmit}
        busy={submitting}
        style={styles.submit}
      />
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={text.body}>{label}</Text>
        {hint && <Text style={text.secondary}>{hint}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
}

function PickerField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.pickerField} onPress={onPress}>
      <Text style={text.secondary}>{label}</Text>
      <Text style={text.body}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: minTouchTarget,
    marginBottom: space.md,
  },
  toggleText: { flex: 1 },
  pickerField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  repeat: { gap: space.md, marginTop: space.sm },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  number: { width: 72, marginBottom: 0 },
  error: {
    backgroundColor: toneTint.danger.bg,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.lg,
  },
  errorText: { color: toneTint.danger.fg },
  submit: { marginTop: space.lg },
});
