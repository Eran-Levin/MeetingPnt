import type { MeetingPoint, RsvpStatus } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Calendar from 'expo-calendar';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { activitiesApi } from '../../../../../../src/api/activitiesApi';
import { activityInvitationsApi } from '../../../../../../src/api/activityInvitationsApi';
import { attendanceApi } from '../../../../../../src/api/attendanceApi';
import { locationsApi } from '../../../../../../src/api/locationsApi';
import { meetingPointsApi } from '../../../../../../src/api/meetingPointsApi';
import { rsvpsApi } from '../../../../../../src/api/rsvpsApi';
import { groupsApi } from '../../../../../../src/api/groupsApi';
import { getCurrentLocationSnapshot } from '../../../../../../src/services/location';
import { useAuthStore } from '../../../../../../src/store/authStore';

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

/** Mirrors the backend's OMW/ping ETA target: soonest time that hasn't passed yet. */
function getNextUpcoming(meetingPoints: MeetingPoint[]): MeetingPoint | undefined {
  const now = Date.now();
  const upcoming = meetingPoints
    .filter((m) => new Date(m.time).getTime() >= now)
    .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  if (upcoming[0]) return upcoming[0];
  return [...meetingPoints].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())[0];
}

export default function ActivityDetailScreen() {
  const { groupId, activityId } = useLocalSearchParams<{ groupId: string; activityId: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [omwMessage, setOmwMessage] = useState<string | null>(null);
  const [omwSubmitting, setOmwSubmitting] = useState(false);
  const [mpLabel, setMpLabel] = useState('');
  const [mpUrl, setMpUrl] = useState('');
  const [mpTime, setMpTime] = useState(new Date());
  const [showMpPicker, setShowMpPicker] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpSubmitting, setMpSubmitting] = useState(false);
  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorMessage, setVisitorMessage] = useState<string | null>(null);
  const [visitorSubmitting, setVisitorSubmitting] = useState(false);

  const activityQuery = useQuery({
    queryKey: ['activities', activityId],
    queryFn: () => activitiesApi.get(activityId),
  });
  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
  });
  const isLeader = groupQuery.data?.group.leaderId === user?.id;

  const myRsvpQuery = useQuery({
    queryKey: ['activities', activityId, 'rsvp', 'me'],
    queryFn: () => rsvpsApi.getMine(activityId),
    enabled: !isLeader,
  });
  useEffect(() => {
    if (myRsvpQuery.data?.rsvp) setMyStatus(myRsvpQuery.data.rsvp.status);
  }, [myRsvpQuery.data]);

  const rsvpsQuery = useQuery({
    queryKey: ['activities', activityId, 'rsvps'],
    queryFn: () => rsvpsApi.list(activityId),
    enabled: isLeader,
  });

  const guestsQuery = useQuery({
    queryKey: ['activities', activityId, 'guests'],
    queryFn: () => activityInvitationsApi.listGuests(activityId),
    enabled: isLeader,
  });

  const attendanceQuery = useQuery({
    queryKey: ['activities', activityId, 'attendance'],
    queryFn: () => attendanceApi.list(activityId),
    enabled: isLeader,
  });
  const attendanceByUser = new Map(
    attendanceQuery.data?.attendance.map((record) => [record.userId, record]) ?? [],
  );

  async function handleMarkAttendance(userId: string, status: 'present' | 'absent') {
    await attendanceApi.mark(activityId, userId, status);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'attendance'] });
  }

  const meetingPointsQuery = useQuery({
    queryKey: ['activities', activityId, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activityId),
  });
  const meetingPoints = meetingPointsQuery.data?.meetingPoints ?? [];
  const nextMeetingPoint = getNextUpcoming(meetingPoints);

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

  async function handleAddMeetingPoint() {
    if (!mpUrl.trim()) return;
    setMpError(null);
    setMpSubmitting(true);
    try {
      await meetingPointsApi.create(activityId, {
        label: mpLabel || undefined,
        googleMapsUrl: mpUrl,
        time: mpTime.toISOString(),
      });
      setMpLabel('');
      setMpUrl('');
      setMpTime(new Date());
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
    } catch {
      setMpError("Couldn't read that Maps link — try a full (non-shortened) URL.");
    } finally {
      setMpSubmitting(false);
    }
  }

  async function handleOnMyWay() {
    setOmwMessage(null);
    setOmwSubmitting(true);
    try {
      const location = await getCurrentLocationSnapshot();
      if (!location) {
        setOmwMessage('Location permission is required to share your ETA.');
        return;
      }
      const { snapshot } = await locationsApi.submitOmw(activityId, location);
      setOmwMessage(
        snapshot.etaSeconds != null
          ? `Shared! ETA: ${Math.round(snapshot.etaSeconds / 60)} min.`
          : "Shared your location, but couldn't calculate an ETA.",
      );
    } catch {
      setOmwMessage('Failed to share your location.');
    } finally {
      setOmwSubmitting(false);
    }
  }

  async function handleRequestLocation(userId: string) {
    await locationsApi.requestPing(activityId, userId);
  }

  async function handleInviteVisitor() {
    if (!visitorEmail.trim()) return;
    setVisitorMessage(null);
    setVisitorSubmitting(true);
    try {
      const result = await activityInvitationsApi.invite(activityId, { email: visitorEmail });
      setVisitorMessage(
        result.type === 'added' ? `${visitorEmail} added as a visitor.` : `Invitation sent to ${visitorEmail}.`,
      );
      setVisitorEmail('');
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'guests'] });
    } catch {
      setVisitorMessage('Failed to invite visitor.');
    } finally {
      setVisitorSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{activity?.title ?? '…'}</Text>
      {activity && (
        <>
          <Text style={styles.muted}>
            {new Date(activity.startAt).toLocaleString()}
            {activity.endAt ? ` → ${new Date(activity.endAt).toLocaleString()}` : ''} ·{' '}
            {activity.transportMode} · {activity.status}
            {!activity.requiresRsvp ? ' · no RSVP required' : ''}
          </Text>
          {activity.description && <Text style={styles.desc}>{activity.description}</Text>}

          <Text style={styles.sectionTitle}>Meeting points</Text>
          {meetingPoints.map((mp) => (
            <TouchableOpacity
              key={mp.id}
              style={styles.meetingPointRow}
              onPress={() => Linking.openURL(mp.googleMapsUrl)}
            >
              <View style={{ flex: 1 }}>
                <Text style={mp.id === nextMeetingPoint?.id ? styles.meetingPointNext : undefined}>
                  {mp.label || 'Meeting point'} — {new Date(mp.time).toLocaleString()}
                  {mp.id === nextMeetingPoint?.id ? ' (next)' : ''}
                </Text>
              </View>
              <Text style={styles.link}>Directions</Text>
            </TouchableOpacity>
          ))}
          {meetingPoints.length === 0 && <Text style={styles.muted}>No meeting points set yet.</Text>}

          {isLeader && (
            <View style={{ marginTop: 8 }}>
              <TextInput
                style={styles.input}
                placeholder="Label (optional)"
                value={mpLabel}
                onChangeText={setMpLabel}
              />
              <TextInput
                style={styles.input}
                placeholder="Google Maps URL"
                autoCapitalize="none"
                value={mpUrl}
                onChangeText={setMpUrl}
              />
              <TouchableOpacity style={styles.input} onPress={() => setShowMpPicker(true)}>
                <Text>{mpTime.toLocaleString()}</Text>
              </TouchableOpacity>
              {showMpPicker && (
                <DateTimePicker
                  value={mpTime}
                  mode="datetime"
                  onChange={(_event, selectedDate) => {
                    setShowMpPicker(Platform.OS === 'ios');
                    if (selectedDate) setMpTime(selectedDate);
                  }}
                />
              )}
              <TouchableOpacity style={styles.secondaryButton} onPress={handleAddMeetingPoint} disabled={mpSubmitting}>
                <Text style={styles.secondaryButtonText}>{mpSubmitting ? 'Adding…' : 'Add meeting point'}</Text>
              </TouchableOpacity>
              {mpError && <Text style={styles.error}>{mpError}</Text>}
            </View>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleAddToCalendar}>
            <Text style={styles.secondaryButtonText}>Add to Calendar</Text>
          </TouchableOpacity>
          {calendarMessage && <Text style={styles.muted}>{calendarMessage}</Text>}

          {isLeader && activity.status === 'draft' && (
            <TouchableOpacity style={styles.button} onPress={handlePublish}>
              <Text style={styles.buttonText}>Publish &amp; notify members</Text>
            </TouchableOpacity>
          )}

          {activity.status !== 'draft' && !isLeader && (
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

              {myStatus === 'approved' && (
                <View style={{ marginTop: 12 }}>
                  <TouchableOpacity style={styles.button} onPress={handleOnMyWay} disabled={omwSubmitting}>
                    <Text style={styles.buttonText}>{omwSubmitting ? 'Sharing…' : "I'm On My Way"}</Text>
                  </TouchableOpacity>
                  {omwMessage && <Text style={styles.muted}>{omwMessage}</Text>}
                </View>
              )}
            </View>
          )}
        </>
      )}

      {isLeader && rsvpsQuery.data && (
        <View style={styles.rsvpBox}>
          <Text style={styles.sectionTitle}>RSVP dashboard</Text>
          {rsvpsQuery.data.rsvps.map((rsvp) => (
            <View key={rsvp.id} style={styles.dashboardRow}>
              <View style={{ flex: 1 }}>
                <Text>{rsvp.user.name}</Text>
                <Text style={styles.muted}>
                  {rsvp.status}
                  {rsvp.note ? ` — ${rsvp.note}` : ''}
                </Text>
              </View>
              {rsvp.status === 'approved' && (
                <TouchableOpacity onPress={() => handleRequestLocation(rsvp.userId)}>
                  <Text style={styles.link}>Request location</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {rsvpsQuery.data.rsvps.length === 0 && <Text style={styles.muted}>No RSVPs yet.</Text>}
        </View>
      )}

      {isLeader && rsvpsQuery.data && (
        <View style={styles.rsvpBox}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <Text style={styles.muted}>Roll call for who actually showed up.</Text>
          {rsvpsQuery.data.rsvps
            .filter((rsvp) => rsvp.status === 'approved')
            .map((rsvp) => {
              const record = attendanceByUser.get(rsvp.userId);
              return (
                <View key={rsvp.id} style={styles.dashboardRow}>
                  <View style={{ flex: 1 }}>
                    <Text>{rsvp.user.name}</Text>
                    {record && <Text style={styles.muted}>{record.status}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleMarkAttendance(rsvp.userId, 'present')}>
                    <Text style={[styles.link, { marginRight: 12 }]}>Present</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleMarkAttendance(rsvp.userId, 'absent')}>
                    <Text style={styles.link}>Absent</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>
      )}

      {isLeader && (
        <View style={styles.rsvpBox}>
          <Text style={styles.sectionTitle}>Visitors</Text>
          <Text style={styles.muted}>People invited to just this activity, without joining the group.</Text>
          <View style={{ marginTop: 8 }}>
            <TextInput
              style={styles.input}
              placeholder="visitor@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={visitorEmail}
              onChangeText={setVisitorEmail}
            />
            <TouchableOpacity style={styles.secondaryButton} onPress={handleInviteVisitor} disabled={visitorSubmitting}>
              <Text style={styles.secondaryButtonText}>{visitorSubmitting ? 'Sending…' : 'Invite visitor'}</Text>
            </TouchableOpacity>
            {visitorMessage && <Text style={styles.muted}>{visitorMessage}</Text>}
          </View>
          {guestsQuery.data?.guests.map((guest) => (
            <View key={guest.id} style={styles.dashboardRow}>
              <Text>{guest.user.name} ({guest.user.email})</Text>
            </View>
          ))}
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
  error: { color: 'crimson', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 16 },
  buttonText: { color: 'white', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
  link: { color: '#2563eb', fontWeight: '600' },
  rsvpBox: { marginTop: 20 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' },
  rsvpApproved: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  rsvpDeclined: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  rsvpButtonText: { fontWeight: '600' },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  meetingPointRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  meetingPointNext: { fontWeight: '600', color: '#2563eb' },
});
