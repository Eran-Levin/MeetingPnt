import type { TransportMode } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { activitiesApi } from '../../../../../src/api/activitiesApi';
import { ApiError } from '../../../../../src/api/client';

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
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
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
      setError(allDay ? 'The end date must not be before the start date.' : 'The end time must be after the start time.');
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
    <View style={styles.container}>
      <Text style={styles.title}>New activity</Text>
      <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
      <TextInput
        style={styles.input}
        placeholder="Description (optional)"
        value={description}
        onChangeText={setDescription}
      />

      <View style={styles.repeatRow}>
        <Text style={styles.label}>Spans whole days (multi-day trip)</Text>
        <Switch value={allDay} onValueChange={setAllDay} />
      </View>

      <TouchableOpacity style={styles.input} onPress={() => setPicker('date')}>
        <Text>
          {allDay ? 'Start date: ' : 'Date: '}
          {startAt.toLocaleDateString()}
        </Text>
      </TouchableOpacity>

      {allDay ? (
        <TouchableOpacity style={styles.input} onPress={() => setPicker('endDate')}>
          <Text>End date: {endAt.toLocaleDateString()}</Text>
        </TouchableOpacity>
      ) : (
        <>
          <TouchableOpacity style={styles.input} onPress={() => setPicker('startTime')}>
            <Text>
              Start time: {startAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.input} onPress={() => setPicker('endTime')}>
            <Text>
              End time: {endAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </TouchableOpacity>
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

      <View style={styles.repeatRow}>
        <Text style={styles.label}>Require RSVP confirmation</Text>
        <Switch value={requiresRsvp} onValueChange={setRequiresRsvp} />
      </View>

      <Text style={styles.label}>Mode of transport</Text>
      <View style={styles.modeRow}>
        {TRANSPORT_MODES.map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeChip, transportMode === mode && styles.modeChipSelected]}
            onPress={() => setTransportMode(mode)}
          >
            <Text style={transportMode === mode ? styles.modeTextSelected : styles.modeText}>
              {mode}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.repeatRow}>
        <Text style={styles.label}>Repeat weekly</Text>
        <Switch value={repeats} onValueChange={setRepeats} />
      </View>

      {repeats && (
        <View style={{ gap: 8 }}>
          <View style={styles.repeatRow}>
            <Text>Every</Text>
            <TextInput
              style={[styles.input, { width: 50 }]}
              keyboardType="number-pad"
              value={intervalWeeks}
              onChangeText={setIntervalWeeks}
            />
            <Text>week(s)</Text>
          </View>
          <View style={styles.modeRow}>
            {WEEKDAY_LABELS.map((label, day) => (
              <TouchableOpacity
                key={day}
                style={[styles.modeChip, daysOfWeek.includes(day) && styles.modeChipSelected]}
                onPress={() => toggleDay(day)}
              >
                <Text style={daysOfWeek.includes(day) ? styles.modeTextSelected : styles.modeText}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.repeatRow}>
            <Text>For</Text>
            <TextInput
              style={[styles.input, { width: 60 }]}
              keyboardType="number-pad"
              value={count}
              onChangeText={setCount}
            />
            <Text>occurrences</Text>
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>
          {submitting ? 'Creating…' : repeats ? 'Create series (drafts)' : 'Create draft'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: '600' },
  label: { fontWeight: '600', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 },
  modeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  modeChip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12 },
  modeChipSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  modeText: { color: '#333' },
  modeTextSelected: { color: 'white', fontWeight: '600' },
  repeatRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: 'crimson' },
});
