import type { RsvpStatus } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { activitiesApi } from '../../../../../../src/api/activitiesApi.js';
import { rsvpsApi } from '../../../../../../src/api/rsvpsApi.js';
import { groupsApi } from '../../../../../../src/api/groupsApi.js';
import { useAuthStore } from '../../../../../../src/store/authStore.js';

async function addToDeviceCalendar(title: string, startAt: string, description?: string | null) {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return false;

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  let calendarId = calendars.find((c) => c.allowsModifications)?.id;

  if (!calendarId) {
    const source =
      Platform.OS === 'ios'
        ? (await Calendar.getDefaultCalendarAsync()).source
        : { isLocalAccount: true, name: 'MeetingPnt', type: 'LOCAL' };
    calendarId = await Calendar.createCalendarAsync({
      title: 'MeetingPnt',
      color: '#2563eb',
      entityType: Calendar.EntityTypes.EVENT,
      source,
      name: 'meetingpnt',
      ownerAccount: 'meetingpnt',
      accessLevel: Calendar.CalendarAccessLevel.OWNER,
    });
  }

  const start = new Date(startAt);
  await Calendar.createEventAsync(calendarId, {
    title,
    startDate: start,
    endDate: new Date(start.getTime() + 60 * 60 * 1000),
    notes: description ?? undefined,
  });
  return true;
}

export default function ActivityDetailScreen() {
  const { groupId, activityId } = useLocalSearchParams<{ groupId: string; activityId: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);

  const activityQuery = useQuery({
    queryKey: ['activities', activityId],
    queryFn: () => activitiesApi.get(activityId),
  });
  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
  });
  const isLeader = groupQuery.data?.group.leaderId === user?.id;

  const rsvpsQuery = useQuery({
    queryKey: ['activities', activityId, 'rsvps'],
    queryFn: () => rsvpsApi.list(activityId),
    enabled: isLeader,
  });

  const activity = activityQuery.data?.activity;

  async function handleRsvp(status: RsvpStatus) {
    setRsvpMessage(null);
    const { rsvp } = await rsvpsApi.upsert(activityId, {
      status: status as 'approved' | 'declined',
      note: note || undefined,
    });
    setMyStatus(rsvp.status);
    setRsvpMessage(`You're marked as ${rsvp.status}.`);
  }

  async function handlePublish() {
    await activitiesApi.publish(activityId);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
  }

  async function handleAddToCalendar() {
    if (!activity) return;
    const ok = await addToDeviceCalendar(activity.title, activity.startAt, activity.description);
    setCalendarMessage(ok ? 'Added to your calendar.' : 'Calendar permission denied.');
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{activity?.title ?? '…'}</Text>
      {activity && (
        <>
          <Text style={styles.muted}>
            {new Date(activity.startAt).toLocaleString()} · {activity.transportMode} · {activity.status}
          </Text>
          {activity.description && <Text style={styles.desc}>{activity.description}</Text>}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddToCalendar}>
            <Text style={styles.secondaryButtonText}>Add to Calendar</Text>
          </TouchableOpacity>
          {calendarMessage && <Text style={styles.muted}>{calendarMessage}</Text>}

          {isLeader && activity.status === 'draft' && (
            <TouchableOpacity style={styles.button} onPress={handlePublish}>
              <Text style={styles.buttonText}>Publish &amp; notify members</Text>
            </TouchableOpacity>
          )}

          {activity.status !== 'draft' && (
            <View style={styles.rsvpBox}>
              <Text style={styles.sectionTitle}>Your RSVP</Text>
              <TextInput
                style={styles.input}
                placeholder="Optional note (e.g. running 15 mins late)"
                value={note}
                onChangeText={setNote}
              />
              <View style={styles.rsvpRow}>
                <TouchableOpacity
                  style={[styles.rsvpButton, myStatus === 'approved' && styles.rsvpApproved]}
                  onPress={() => handleRsvp('approved')}
                >
                  <Text style={styles.rsvpButtonText}>Going</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.rsvpButton, myStatus === 'declined' && styles.rsvpDeclined]}
                  onPress={() => handleRsvp('declined')}
                >
                  <Text style={styles.rsvpButtonText}>Not going</Text>
                </TouchableOpacity>
              </View>
              {rsvpMessage && <Text style={styles.muted}>{rsvpMessage}</Text>}
            </View>
          )}
        </>
      )}

      {isLeader && rsvpsQuery.data && (
        <View style={styles.rsvpBox}>
          <Text style={styles.sectionTitle}>RSVP dashboard</Text>
          {rsvpsQuery.data.rsvps.map((rsvp) => (
            <View key={rsvp.id} style={styles.dashboardRow}>
              <Text>{rsvp.user.name}</Text>
              <Text style={styles.muted}>
                {rsvp.status}
                {rsvp.note ? ` — ${rsvp.note}` : ''}
              </Text>
            </View>
          ))}
          {rsvpsQuery.data.rsvps.length === 0 && <Text style={styles.muted}>No RSVPs yet.</Text>}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '600' },
  desc: { marginTop: 8 },
  muted: { color: '#888', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { color: 'white', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
  rsvpBox: { marginTop: 20 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' },
  rsvpApproved: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  rsvpDeclined: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  rsvpButtonText: { fontWeight: '600' },
  dashboardRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
