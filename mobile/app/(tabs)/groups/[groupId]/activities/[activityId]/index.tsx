import type { MeetingPoint, RsvpStatus } from '@meetingpnt/shared';
import { formatActivityWhen } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
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
import { ApiError } from '../../../../../../src/api/client';
import { activityInvitationsApi } from '../../../../../../src/api/activityInvitationsApi';
import { attendanceApi } from '../../../../../../src/api/attendanceApi';
import { locationsApi } from '../../../../../../src/api/locationsApi';
import { meetingPointsApi } from '../../../../../../src/api/meetingPointsApi';
import { rsvpsApi } from '../../../../../../src/api/rsvpsApi';
import { groupsApi } from '../../../../../../src/api/groupsApi';
import { getCurrentLocationSnapshot } from '../../../../../../src/services/location';
import { useAuthStore } from '../../../../../../src/store/authStore';

export default function ActivityDetailScreen() {
  const { groupId, activityId } = useLocalSearchParams<{ groupId: string; activityId: string }>();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);
  const [omwMessage, setOmwMessage] = useState<string | null>(null);
  const [omwSubmitting, setOmwSubmitting] = useState(false);

  // Meeting point editor — doubles as "change the current one" and "move the group on".
  const [mpMode, setMpMode] = useState<null | 'edit' | 'next'>(null);
  const [mpLabel, setMpLabel] = useState('');
  const [mpUrl, setMpUrl] = useState('');
  const [mpTime, setMpTime] = useState<Date | null>(null);
  const [showMpPicker, setShowMpPicker] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpSubmitting, setMpSubmitting] = useState(false);

  const [visitorEmail, setVisitorEmail] = useState('');
  const [visitorFirstName, setVisitorFirstName] = useState('');
  const [visitorLastName, setVisitorLastName] = useState('');
  const [visitorPhone, setVisitorPhone] = useState('');
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
  const activity = activityQuery.data?.activity;

  const meetingPointsQuery = useQuery({
    queryKey: ['activities', activityId, 'meeting-points'],
    queryFn: () => meetingPointsApi.list(activityId),
  });
  const meetingPoints = meetingPointsQuery.data?.meetingPoints ?? [];
  // Where the group is, straight from the activity. Not "the newest point" — the leader may have
  // planned the whole route on the Web, in which case the newest point is the last stop of the day.
  const currentPoint: MeetingPoint | undefined = meetingPoints.find(
    (mp) => mp.id === activity?.currentMeetingPointId,
  );
  const earlierPoints = meetingPoints.filter(
    (mp) => mp.arrivedAt !== null && mp.id !== currentPoint?.id,
  );
  // The stop "Next meeting point" will pre-fill from, if the leader planned one.
  const nextPlanned: MeetingPoint | undefined = meetingPoints.find((mp) => mp.arrivedAt === null);

  const rollCallQuery = useQuery({
    queryKey: ['meeting-points', currentPoint?.id, 'roll-call'],
    queryFn: () => attendanceApi.rollCall(currentPoint!.id),
    enabled: isLeader && !!currentPoint,
  });
  const rollCall = rollCallQuery.data?.entries ?? [];

  const myRsvpQuery = useQuery({
    queryKey: ['activities', activityId, 'rsvp', 'me'],
    queryFn: () => rsvpsApi.getMine(activityId),
    enabled: !isLeader,
  });

  // Members see who else is coming — names only, never the leader's roll call.
  const attendeesQuery = useQuery({
    queryKey: ['activities', activityId, 'attendees'],
    queryFn: () => rsvpsApi.attendees(activityId),
    enabled: !isLeader,
  });
  useEffect(() => {
    if (myRsvpQuery.data?.rsvp) setMyStatus(myRsvpQuery.data.rsvp.status);
  }, [myRsvpQuery.data]);

  function refreshRollCall() {
    queryClient.invalidateQueries({ queryKey: ['meeting-points', currentPoint?.id, 'roll-call'] });
  }

  async function handleRsvp(status: RsvpStatus) {
    setRsvpMessage(null);
    const { rsvp } = await rsvpsApi.upsert(activityId, {
      status: status as 'approved' | 'declined',
      note: note || undefined,
    });
    setMyStatus(rsvp.status);
    setRsvpMessage(`You're marked as ${rsvp.status}.`);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'attendees'] });
    queryClient.invalidateQueries({ queryKey: ['activities', 'mine'] });
  }

  async function handleStart() {
    await activitiesApi.start(activityId);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
  }

  async function handleEnd() {
    await activitiesApi.end(activityId);
    queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
  }

  async function handleMarkAttendance(userId: string, status: 'present' | 'absent') {
    if (!currentPoint) return;
    await attendanceApi.mark(currentPoint.id, userId, status);
    refreshRollCall();
  }

  /** Answering on a member's behalf — they told the leader in person or by phone. */
  async function handleRsvpForMember(userId: string, status: 'approved' | 'declined') {
    await rsvpsApi.setForUser(activityId, userId, { status });
    refreshRollCall();
    queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'rsvps'] });
  }

  /**
   * 'edit' changes the stop the group is standing at. 'next' moves them on: pre-filled from the
   * planned stop when the leader mapped the route out in advance, blank when they're improvising
   * past the end of the plan. Either way the leader can change anything before confirming —
   * the plan said the market at 11, they actually got there at 11:40 by the other entrance.
   */
  function openEditor(mode: 'edit' | 'next') {
    const source = mode === 'edit' ? currentPoint : nextPlanned;
    if (source) {
      setMpLabel(source.label ?? '');
      setMpUrl(source.googleMapsUrl);
      setMpTime(mode === 'edit' ? new Date(source.time) : null); // arriving now
    } else {
      setMpLabel('');
      setMpUrl('');
      setMpTime(null); // no time means "now"
    }
    setMpError(null);
    setMpMode(mode);
  }

  /** The leader is usually standing at the new meeting point, so their own GPS is the fastest way in. */
  async function useCurrentLocation() {
    setMpError(null);
    const location = await getCurrentLocationSnapshot();
    if (!location) {
      setMpError('Location permission is required to use your current position.');
      return;
    }
    setMpUrl(`https://www.google.com/maps/@${location.lat.toFixed(6)},${location.lng.toFixed(6)},17z`);
  }

  /** Opens Maps so they can search for somewhere they aren't standing, then paste the link back. */
  async function openGoogleMaps() {
    const query = mpLabel.trim();
    await Linking.openURL(
      query
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
        : 'https://www.google.com/maps',
    );
  }

  async function pasteLink() {
    const text = (await Clipboard.getStringAsync())?.trim();
    if (!text) {
      setMpError('Nothing on the clipboard to paste.');
      return;
    }
    setMpError(null);
    setMpUrl(text);
  }

  async function handleSaveMeetingPoint() {
    if (!mpUrl.trim()) return;
    setMpError(null);
    setMpSubmitting(true);
    try {
      const dto = {
        label: mpLabel || undefined,
        googleMapsUrl: mpUrl,
        time: mpTime ? mpTime.toISOString() : undefined,
      };
      // Advancing is a single call: the server applies these edits to the planned stop (or
      // creates one if the plan has run out) and moves the group's position in the same step.
      if (mpMode === 'edit' && currentPoint) await meetingPointsApi.update(currentPoint.id, dto);
      else await meetingPointsApi.advance(activityId, dto);

      setMpMode(null);
      queryClient.invalidateQueries({ queryKey: ['activities', activityId, 'meeting-points'] });
      queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
    } catch (err) {
      setMpError(
        err instanceof ApiError
          ? err.message
          : "Couldn't read that Maps link — try a full (non-shortened) URL.",
      );
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
    if (!visitorEmail.trim() || !visitorFirstName.trim() || !visitorLastName.trim()) return;
    setVisitorMessage(null);
    setVisitorSubmitting(true);
    try {
      const result = await activityInvitationsApi.invite(activityId, {
        email: visitorEmail,
        firstName: visitorFirstName,
        lastName: visitorLastName,
        ...(visitorPhone.trim() ? { phone: visitorPhone.trim() } : {}),
      });
      const who = `${visitorFirstName} ${visitorLastName}`.trim();
      setVisitorMessage(result.type === 'added' ? `${who} added.` : `Invitation sent to ${who}.`);
      setVisitorEmail('');
      setVisitorFirstName('');
      setVisitorLastName('');
      setVisitorPhone('');
      refreshRollCall();
    } catch {
      setVisitorMessage('Failed to invite visitor.');
    } finally {
      setVisitorSubmitting(false);
    }
  }

  const markedCount = rollCall.filter((e) => e.attendance !== null).length;
  const presentCount = rollCall.filter((e) => e.attendance === 'present').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>{activity?.title ?? '…'}</Text>
      {activity && (
        <>
          <Text style={styles.muted}>
            {formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)} ·{' '}
            {activity.status}
          </Text>
          {activity.description && <Text style={styles.desc}>{activity.description}</Text>}

          {isLeader && activity.status === 'published' && (
            <TouchableOpacity style={styles.button} onPress={handleStart}>
              <Text style={styles.buttonText}>Start event</Text>
            </TouchableOpacity>
          )}

          {/* Running an event is these two decisions: move the group on, or finish. They sit
              together at the top so a leader holding a phone one-handed can reach both. */}
          {isLeader && activity.status === 'in_progress' && mpMode === null && (
            <View style={styles.eventControls}>
              <TouchableOpacity
                style={[styles.button, styles.eventControlButton]}
                onPress={() => openEditor('next')}
              >
                <Text style={styles.buttonText}>Next meeting point</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.eventControlButton]}
                onPress={handleEnd}
              >
                <Text style={styles.secondaryButtonText}>End event</Text>
              </TouchableOpacity>
            </View>
          )}
          {isLeader && activity.status === 'in_progress' && mpMode === null && nextPlanned && (
            <Text style={styles.muted}>Next on the plan: {nextPlanned.label || 'a stop'}</Text>
          )}

          {isLeader && activity.status === 'published' && (
            <TouchableOpacity style={styles.secondaryButton} onPress={handleEnd}>
              <Text style={styles.secondaryButtonText}>End event</Text>
            </TouchableOpacity>
          )}
          {activity.status === 'completed' && (
            <Text style={styles.muted}>This event has ended — location sharing is closed.</Text>
          )}

          {/* Where to go leads, so nobody has to work out which pin is theirs. The rest of the
              route sits underneath for context — what time we set off, when we'll be back. */}
          <Text style={styles.sectionTitle}>
            {currentPoint ? 'Where to go now' : 'Meeting point'}
          </Text>
          {currentPoint ? (
            <View style={styles.currentPoint}>
              <Text style={styles.currentPointLabel}>{currentPoint.label || 'Meeting point'}</Text>
              <Text style={styles.muted}>{new Date(currentPoint.time).toLocaleString()}</Text>
              <View style={styles.pointActions}>
                <TouchableOpacity onPress={() => Linking.openURL(currentPoint.googleMapsUrl)}>
                  <Text style={styles.link}>Directions</Text>
                </TouchableOpacity>
                {isLeader && (
                  <TouchableOpacity onPress={() => openEditor('edit')}>
                    <Text style={styles.link}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <Text style={styles.muted}>
              {meetingPoints.length > 0
                ? "The event hasn't started — the route is below."
                : 'No meeting point set yet.'}
            </Text>
          )}

          {isLeader && mpMode !== null && (
            <View style={styles.editor}>
              <Text style={styles.editorTitle}>
                {mpMode === 'edit'
                  ? 'Edit meeting point'
                  : nextPlanned
                    ? 'Next stop on the plan'
                    : 'Next meeting point'}
              </Text>
              {mpMode === 'next' && (
                <Text style={styles.muted}>
                  {nextPlanned
                    ? 'Change anything that turned out differently, then confirm to move the group.'
                    : "You're past the last planned stop — add where the group is going now."}
                </Text>
              )}
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
                autoCorrect={false}
                value={mpUrl}
                onChangeText={setMpUrl}
              />
              <View style={styles.pickerRow}>
                <TouchableOpacity onPress={useCurrentLocation}>
                  <Text style={styles.tap}>Use my location</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={openGoogleMaps}>
                  <Text style={styles.tap}>Open Google Maps</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={pasteLink}>
                  <Text style={styles.tap}>Paste link</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.input} onPress={() => setShowMpPicker(true)}>
                <Text>{mpTime ? mpTime.toLocaleString() : 'Time (optional — defaults to now)'}</Text>
              </TouchableOpacity>
              {showMpPicker && (
                <DateTimePicker
                  value={mpTime ?? new Date()}
                  mode="datetime"
                  onChange={(_event, selected) => {
                    setShowMpPicker(Platform.OS === 'ios');
                    if (selected) setMpTime(selected);
                  }}
                />
              )}
              <View style={styles.editorActions}>
                <TouchableOpacity
                  style={styles.button}
                  onPress={handleSaveMeetingPoint}
                  disabled={mpSubmitting}
                >
                  <Text style={styles.buttonText}>
                    {mpSubmitting ? 'Saving…' : mpMode === 'edit' ? 'Save' : "We're here"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMpMode(null)}>
                  <Text style={styles.link}>Cancel</Text>
                </TouchableOpacity>
              </View>
              {mpError && <Text style={styles.error}>{mpError}</Text>}
            </View>
          )}

          {/* ---- who's here: RSVP and attendance in one list ---- */}
          {isLeader && currentPoint && (
            <>
              <Text style={styles.sectionTitle}>
                Who&rsquo;s here{'  '}
                <Text style={styles.muted}>
                  {presentCount} present · {markedCount}/{rollCall.length} checked
                </Text>
              </Text>
              {earlierPoints.length > 0 && (
                <Text style={styles.hint}>
                  Showing whoever made the previous stop. People who declined aren&rsquo;t listed.
                </Text>
              )}

              {rollCall.map((entry) => (
                <View key={entry.user.id} style={styles.personRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>
                      {entry.user.name}
                      {entry.isVisitor ? '  ·  visitor' : ''}
                    </Text>
                    <Text style={styles.muted}>
                      {entry.rsvpStatus === 'approved' ? 'Coming' : 'No reply yet'}
                      {entry.attendance ? ` · ${entry.attendance}` : ''}
                    </Text>
                  </View>
                  <View style={styles.personActions}>
                    <TouchableOpacity onPress={() => handleMarkAttendance(entry.user.id, 'present')}>
                      <Text
                        style={[styles.tap, entry.attendance === 'present' && styles.tapActive]}
                      >
                        Here
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMarkAttendance(entry.user.id, 'absent')}>
                      <Text style={[styles.tap, entry.attendance === 'absent' && styles.tapDanger]}>
                        Missing
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleRequestLocation(entry.user.id)}>
                      <Text style={styles.tap}>Locate</Text>
                    </TouchableOpacity>
                    {/* Answer for them if they replied by phone rather than in the app. */}
                    {entry.rsvpStatus !== 'approved' && (
                      <TouchableOpacity
                        onPress={() => handleRsvpForMember(entry.user.id, 'approved')}
                      >
                        <Text style={styles.tap}>Confirm</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => handleRsvpForMember(entry.user.id, 'declined')}>
                      <Text style={styles.tapMuted}>Won&rsquo;t arrive</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {rollCall.length === 0 && (
                <Text style={styles.muted}>Nobody expected at this meeting point.</Text>
              )}
            </>
          )}

          {/* ---- member's own view ---- */}
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

          {/* Who else is coming. Names only — attendance is the leader's view. */}
          {!isLeader && activity.status !== 'draft' && (
            <View style={styles.rsvpBox}>
              <Text style={styles.sectionTitle}>
                Coming{' '}
                <Text style={styles.muted}>({attendeesQuery.data?.attendees.length ?? 0})</Text>
              </Text>
              {attendeesQuery.data?.attendees.map((attendee) => (
                <Text key={attendee.user.id} style={styles.attendeeName}>
                  {attendee.user.name}
                  {attendee.isVisitor ? '  ·  visitor' : ''}
                </Text>
              ))}
              {(attendeesQuery.data?.attendees.length ?? 0) === 0 && (
                <Text style={styles.muted}>Nobody has confirmed yet.</Text>
              )}
            </View>
          )}
        </>
      )}

      {/* Inviting someone is planning, and planning is over once the group is out walking — by
          then the leader is marking a roll call, not signing people up. Also hidden when
          attendance isn't approved: on a trip day the roster is the manifest, not a list you
          top up, and the Web hides it on the same rule. */}
      {isLeader &&
        activity?.requiresRsvp &&
        activity.status !== 'in_progress' &&
        activity.status !== 'completed' && (
        <View style={styles.rsvpBox}>
          <Text style={styles.sectionTitle}>Add a visitor</Text>
          <TextInput
            style={styles.input}
            placeholder="First name"
            value={visitorFirstName}
            onChangeText={setVisitorFirstName}
          />
          <TextInput
            style={styles.input}
            placeholder="Last name"
            value={visitorLastName}
            onChangeText={setVisitorLastName}
          />
          <TextInput
            style={styles.input}
            placeholder="Phone (optional)"
            keyboardType="phone-pad"
            value={visitorPhone}
            onChangeText={setVisitorPhone}
          />
          <TextInput
            style={styles.input}
            placeholder="visitor@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={visitorEmail}
            onChangeText={setVisitorEmail}
          />
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleInviteVisitor}
            disabled={visitorSubmitting}
          >
            <Text style={styles.secondaryButtonText}>
              {visitorSubmitting ? 'Sending…' : 'Invite visitor'}
            </Text>
          </TouchableOpacity>
          {visitorMessage && <Text style={styles.muted}>{visitorMessage}</Text>}
        </View>
      )}

      {/* The whole route, for anyone on the activity. Three states so a glance answers "where am
          I going" without reading: stops already behind us fade back, the current one is picked
          out, and what's still ahead reads as plan. */}
      {meetingPoints.length > 1 && (
        <View style={styles.rsvpBox}>
          <Text style={styles.sectionTitle}>The route</Text>
          {meetingPoints.map((mp, index) => {
            const isCurrent = mp.id === currentPoint?.id;
            const visited = mp.arrivedAt !== null && !isCurrent;
            return (
              <TouchableOpacity
                key={mp.id}
                style={[styles.routeRow, isCurrent && styles.routeRowCurrent]}
                onPress={() => Linking.openURL(mp.googleMapsUrl)}
              >
                <View style={[styles.routeIndex, isCurrent && styles.routeIndexCurrent]}>
                  <Text style={[styles.routeIndexText, isCurrent && styles.routeIndexTextCurrent]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[visited && styles.routeTextVisited, isCurrent && styles.routeTextCurrent]}>
                    {mp.label || 'Meeting point'}
                  </Text>
                  <Text style={[styles.muted, visited && styles.routeTextVisited]}>
                    {new Date(mp.time).toLocaleString()}
                    {isCurrent ? '  ·  you are heading here' : visited ? '  ·  done' : ''}
                  </Text>
                </View>
                <Text style={styles.link}>Directions</Text>
              </TouchableOpacity>
            );
          })}
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
  hint: { color: '#888', fontSize: 12, marginBottom: 8 },
  error: { color: 'crimson', marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 24, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10, marginBottom: 8 },
  button: { backgroundColor: '#2563eb', padding: 14, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  buttonText: { color: 'white', fontWeight: '600' },
  secondaryButton: { borderWidth: 1, borderColor: '#2563eb', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  secondaryButtonText: { color: '#2563eb', fontWeight: '600' },
  link: { color: '#2563eb', fontWeight: '600' },
  currentPoint: { borderWidth: 2, borderColor: '#2563eb', backgroundColor: '#eff6ff', borderRadius: 10, padding: 14 },
  currentPointLabel: { fontSize: 16, fontWeight: '600' },
  pointActions: { flexDirection: 'row', gap: 20, marginTop: 10 },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  routeRowCurrent: { backgroundColor: '#eff6ff', borderRadius: 8, paddingHorizontal: 8 },
  routeIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeIndexCurrent: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  routeIndexText: { fontSize: 12, color: '#6b7280' },
  routeIndexTextCurrent: { color: 'white', fontWeight: '600' },
  routeTextCurrent: { fontWeight: '600' },
  routeTextVisited: { color: '#9ca3af' },
  eventControls: { flexDirection: 'row', gap: 8 },
  eventControlButton: { flex: 1 },
  editor: { borderWidth: 1, borderColor: '#eee', borderRadius: 10, padding: 12, marginTop: 12 },
  editorTitle: { fontWeight: '600', marginBottom: 8 },
  editorActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 12 },
  personRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  personName: { fontWeight: '600' },
  attendeeName: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#eee' },
  personActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 8 },
  tap: { color: '#2563eb', fontWeight: '600' },
  tapActive: { color: '#16a34a' },
  tapDanger: { color: '#dc2626' },
  tapMuted: { color: '#94a3b8' },
  rsvpBox: { marginTop: 20 },
  rsvpRow: { flexDirection: 'row', gap: 8 },
  rsvpButton: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center' },
  rsvpApproved: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  rsvpDeclined: { backgroundColor: '#dc2626', borderColor: '#dc2626' },
  rsvpButtonText: { fontWeight: '600' },
  dashboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
