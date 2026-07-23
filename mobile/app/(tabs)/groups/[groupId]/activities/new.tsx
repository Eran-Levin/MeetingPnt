import type { TransportMode } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { activitiesApi } from '../../../../../src/api/activitiesApi.js';
import { ApiError } from '../../../../../src/api/client.js';

const TRANSPORT_MODES: TransportMode[] = ['driving', 'walking', 'bicycling', 'transit'];

export default function NewActivityScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);
  const [transportMode, setTransportMode] = useState<TransportMode>('driving');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const { activity } = await activitiesApi.create(groupId, {
        title,
        description: description || undefined,
        startAt: startAt.toISOString(),
        transportMode,
      });
      router.replace(`/(tabs)/groups/${groupId}/activities/${activity.id}`);
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

      <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
        <Text>{startAt.toLocaleString()}</Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={startAt}
          mode="datetime"
          onChange={(_event, selectedDate) => {
            setShowPicker(Platform.OS === 'ios');
            if (selectedDate) setStartAt(selectedDate);
          }}
        />
      )}

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

      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Creating…' : 'Create draft'}</Text>
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
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: 'white', fontWeight: '600' },
  error: { color: 'crimson' },
});
