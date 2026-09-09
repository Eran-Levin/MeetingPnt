import type { LocationSnapshotWithUser, MeetingPoint, RsvpStatus } from '@meetingpnt/shared';
import { formatActivityWhen, isLeaderBroadcasting } from '@meetingpnt/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { activitiesApi } from '../../../../../../src/api/activitiesApi';
import { activityInvitationsApi } from '../../../../../../src/api/activityInvitationsApi';
import { attendanceApi } from '../../../../../../src/api/attendanceApi';
import { ApiError } from '../../../../../../src/api/client';
import { groupsApi } from '../../../../../../src/api/groupsApi';
import { locationsApi } from '../../../../../../src/api/locationsApi';
import { meetingPointsApi } from '../../../../../../src/api/meetingPointsApi';
import { rsvpsApi } from '../../../../../../src/api/rsvpsApi';
import { CurrentPointCard } from '../../../../../../src/features/activity/CurrentPointCard';
import { MeetingPointEditor } from '../../../../../../src/features/activity/MeetingPointEditor';
import { MemberPanel } from '../../../../../../src/features/activity/MemberPanel';
import { RollCallList } from '../../../../../../src/features/activity/RollCallList';
import { RouteList } from '../../../../../../src/features/activity/RouteList';
import { VisitorInvite } from '../../../../../../src/features/activity/VisitorInvite';
import { getCurrentLocationSnapshot, watchPosition } from '../../../../../../src/services/location';
import { useAuthStore } from '../../../../../../src/store/authStore';
import {
  Avatar,
  Badge,
  Button,
  ButtonRow,
  Card,
  Pill,
  Row,
  Screen,
  Section,
  color,
  space,
  text,
} from '../../../../../../src/ui';

/** How long ago a position was captured, in the words you'd use out loud. */
function describeAge(capturedAt: string): string {
  const minutes = Math.round((Date.now() - new Date(capturedAt).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes === 1) return 'a minute ago';
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  return hours === 1 ? 'an hour ago' : `${hours} hours ago`;
}

function mapsLinkFor(location: { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
}

export default function ActivityDetailScreen() {
  const { groupId, activityId } = useLocalSearchParams<{ groupId: string; activityId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const [note, setNote] = useState('');
  const [myStatus, setMyStatus] = useState<RsvpStatus | null>(null);
  const [rsvpMessage, setRsvpMessage] = useState<string | null>(null);
  const [omwMessage, setOmwMessage] = useState<string | null>(null);
  const [omwSubmitting, setOmwSubmitting] = useState(false);

  // "Where are you?" — the member's side of it.
  const [leaderLocation, setLeaderLocation] = useState<LocationSnapshotWithUser | null>(null);
  const [askMessage, setAskMessage] = useState<string | null>(null);
  const [askSubmitting, setAskSubmitting] = useState(false);

  // "Follow me" — the leader's side.
  const [broadcastUntil, setBroadcastUntil] = useState<string | null>(null);
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [broadcastBusy, setBroadcastBusy] = useState(false);

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
    // While an event is running, poll — otherwise a member sitting on this screen would never
    // learn the leader had started sharing their position, since nothing else refetches it.
    refetchInterval: (query) =>
      query.state.data?.activity.status === 'in_progress' ? 30_000 : false,
  });
  const groupQuery = useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => groupsApi.get(groupId),
  });
  const isLeader = groupQuery.data?.group.leaderId === user?.id;
  const activity = activityQuery.data?.activity;
  const running = activity?.status === 'in_progress';

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

  // The server's view of whether sharing is on, which survives closing the screen. Locally held
  // state only tracks it between renders.
  const broadcasting = isLeaderBroadcasting(broadcastUntil ?? activity?.leaderBroadcastUntil);

  // Members follow a live broadcast by polling. The server stores a fix at most every 30 seconds,
  // so there is nothing to gain from a socket here — and mobile has no socket client, which is a
  // dependency and a reconnect lifecycle not worth adding to read one moving pin.
  const leaderLocationQuery = useQuery({
    queryKey: ['activities', activityId, 'leader-location'],
    queryFn: () => locationsApi.getLeaderLocation(activityId),
    enabled: !isLeader && broadcasting,
    refetchInterval: 20_000,
  });
  const liveLeaderLocation = leaderLocationQuery.data?.location ?? null;

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

  /** A thread with one person. Car-sharing, "I'll wait by the gate" — things the whole group
   * doesn't need and the group chat buries. */
  function openDirectChat(userId: string) {
    router.push(`/dm/${userId}`);
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
    const copied = (await Clipboard.getStringAsync())?.trim();
    if (!copied) {
      setMpError('Nothing on the clipboard to paste.');
      return;
    }
    setMpError(null);
    setMpUrl(copied);
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

  // While the leader is broadcasting, feed the server fixes. Tied to `broadcasting` so it starts
  // and stops with the lease, and torn down on unmount — leaving the screen stops the watch, and
  // the lease then lapses on the server rather than sharing on invisibly.
  useEffect(() => {
    if (!isLeader || !broadcasting) return;
    let subscription: Awaited<ReturnType<typeof watchPosition>> = null;
    let cancelled = false;

    (async () => {
      subscription = await watchPosition((point) => {
        locationsApi.sendBroadcastFix(activityId, point).catch(() => {
          // A dropped fix is not worth interrupting the leader over: the next one is seconds away,
          // and if they stop for good the lease is what ends the broadcast.
        });
      });
      if (cancelled) {
        subscription?.remove();
        subscription = null;
      } else if (!subscription) {
        setBroadcastError('Location permission is required to share your position.');
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [isLeader, broadcasting, activityId]);

  async function handleToggleBroadcast() {
    setBroadcastError(null);
    setBroadcastBusy(true);
    try {
      if (broadcasting) {
        await locationsApi.stopBroadcast(activityId);
        setBroadcastUntil(null);
      } else {
        const { until } = await locationsApi.startBroadcast(activityId);
        setBroadcastUntil(until);
      }
      queryClient.invalidateQueries({ queryKey: ['activities', activityId] });
    } catch (err) {
      setBroadcastError(
        err instanceof ApiError ? err.message : "Couldn't change live sharing just now.",
      );
    } finally {
      setBroadcastBusy(false);
    }
  }

  async function handleAskLeader() {
    setAskMessage(null);
    setAskSubmitting(true);
    try {
      const result = await locationsApi.askLeader(activityId);
      setLeaderLocation(result.location);
      if (!result.location) {
        setAskMessage("Asked — you'll see their position here once they share it.");
      } else if (result.notified) {
        // A position exists but it's old enough that we disturbed the leader for a fresh one.
        setAskMessage(`Asked. Last known position was ${describeAge(result.location.capturedAt)}.`);
      } else {
        setAskMessage(`Shared ${describeAge(result.location.capturedAt)}.`);
      }
    } catch (err) {
      setAskMessage(
        err instanceof ApiError ? err.message : "Couldn't ask right now — try again in a moment.",
      );
    } finally {
      setAskSubmitting(false);
    }
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

  if (!activity) return <Screen title="…">{null}</Screen>;

  const attendees = attendeesQuery.data?.attendees ?? [];

  return (
    <Screen
      title={activity.title}
      subtitle={formatActivityWhen(activity.startAt, activity.endAt, activity.allDay)}
      bottomInset={56}
    >
      <View style={styles.status}>
        <Badge status={activity.status} />
        {/* Chat lives on the event now: for a member a conversation is nearly always about a
            specific one — where are you, I'm running late — and this is the screen they're on. */}
        <Pressable
          style={styles.chat}
          onPress={() => router.push(`/(tabs)/groups/${groupId}/chat`)}
        >
          <Text style={[text.body, { color: color.accentText }]}>Group chat</Text>
        </Pressable>
      </View>

      {activity.description && <Text style={[text.body, styles.desc]}>{activity.description}</Text>}

      {/* Running an event is these two decisions: move the group on, or finish. They sit at the
          top so a leader holding a phone one-handed can reach both. */}
      {isLeader && mpMode === null && (
        <View style={styles.controls}>
          {activity.status === 'published' && (
            <ButtonRow>
              <Button label="Start activity" onPress={handleStart} grow />
              <Button label="End activity" onPress={handleEnd} variant="secondary" grow />
            </ButtonRow>
          )}
          {running && (
            <>
              <ButtonRow>
                <Button label="Next meeting point" onPress={() => openEditor('next')} grow />
                <Button label="End activity" onPress={handleEnd} variant="secondary" grow />
              </ButtonRow>
              {nextPlanned && (
                <Text style={[text.secondary, styles.planned]}>
                  Next on the plan: {nextPlanned.label || 'a stop'}
                </Text>
              )}

              {/* "Follow me" — the flag a guide holds up. Separate from moving the group on: this
                  says where I am right now, not where everyone should end up. */}
              <Button
                label={
                  broadcastBusy
                    ? 'One moment…'
                    : broadcasting
                      ? 'Stop sharing my position'
                      : 'Share my live position'
                }
                onPress={handleToggleBroadcast}
                busy={broadcastBusy}
                variant={broadcasting ? 'primary' : 'secondary'}
                style={styles.broadcast}
              />
              {broadcasting && (
                <Text style={[text.secondary, styles.planned]}>
                  Your group can see where you are. Sharing stops if you leave this screen.
                </Text>
              )}
              {broadcastError && (
                <Text style={[text.secondary, styles.planned]}>{broadcastError}</Text>
              )}
            </>
          )}
        </View>
      )}

      {activity.status === 'completed' && (
        <Text style={[text.secondary, styles.planned]}>
          This activity has ended — location sharing is closed.
        </Text>
      )}

      {/* `onOnMyWay` isn't gated on the event running: a member sets off for the 06:30 meetup
          well before the leader taps start, and that's exactly when sharing an ETA matters. */}
      <Section label={currentPoint ? 'Where to go now' : 'Meeting point'}>
        <CurrentPointCard
          point={currentPoint}
          plannedCount={meetingPoints.length}
          isLeader={!!isLeader}
          onEdit={() => openEditor('edit')}
          onOnMyWay={myStatus === 'approved' ? handleOnMyWay : undefined}
          omwBusy={omwSubmitting}
          message={omwMessage}
        />
      </Section>

      {isLeader && mpMode !== null && (
        <MeetingPointEditor
          mode={mpMode}
          nextPlanned={nextPlanned}
          label={mpLabel}
          onLabelChange={setMpLabel}
          url={mpUrl}
          onUrlChange={setMpUrl}
          time={mpTime}
          onTimeChange={setMpTime}
          showPicker={showMpPicker}
          onShowPicker={setShowMpPicker}
          onUseCurrentLocation={useCurrentLocation}
          onOpenMaps={openGoogleMaps}
          onPasteLink={pasteLink}
          onSave={handleSaveMeetingPoint}
          onCancel={() => setMpMode(null)}
          submitting={mpSubmitting}
          error={mpError}
        />
      )}

      {isLeader && currentPoint && (
        <RollCallList
          entries={rollCall}
          narrowed={earlierPoints.length > 0}
          onMark={handleMarkAttendance}
          onLocate={handleRequestLocation}
          onRsvpFor={handleRsvpForMember}
          onMessage={openDirectChat}
        />
      )}

      {!isLeader && activity.status !== 'draft' && (
        <MemberPanel
          status={myStatus}
          note={note}
          onNoteChange={setNote}
          onRsvp={handleRsvp}
          message={rsvpMessage}
          running={running}
          broadcasting={broadcasting}
          liveLeaderLocation={liveLeaderLocation}
          askedLeaderLocation={leaderLocation}
          onAskLeader={handleAskLeader}
          askBusy={askSubmitting}
          askMessage={askMessage}
          describeAge={describeAge}
          mapsLinkFor={mapsLinkFor}
        />
      )}

      {/* Who else is coming. Names only — attendance is the leader's view. Tapping someone opens
          a thread with just them, which is where sorting a lift belongs: the group chat is for
          the whole group, and two people arranging a car aren't. */}
      {!isLeader && activity.status !== 'draft' && (
        <Section label={`Coming · ${attendees.length}`}>
          {attendees.length > 0 ? (
            attendees.map((attendee, index) => {
              const isMe = attendee.user.id === user?.id;
              return (
                <Row
                  key={attendee.user.id}
                  title={isMe ? `${attendee.user.name} (you)` : attendee.user.name}
                  subtitle={attendee.isVisitor ? 'Visitor' : undefined}
                  leading={<Avatar name={attendee.user.name} uri={attendee.user.avatarUrl} />}
                  trailing={isMe ? undefined : <Pill tone="neutral" label="Message" />}
                  onPress={isMe ? undefined : () => openDirectChat(attendee.user.id)}
                  last={index === attendees.length - 1}
                />
              );
            })
          ) : (
            <Card>
              <Text style={text.secondary}>Nobody has confirmed yet.</Text>
            </Card>
          )}
        </Section>
      )}

      {/* Inviting someone is planning, and planning is over once the group is out walking — by
          then the leader is marking a roll call, not signing people up. Also hidden when
          attendance isn't approved: on a trip day the roster is the manifest, not a list you
          top up, and the Web hides it on the same rule. */}
      {isLeader && activity.requiresRsvp && !running && activity.status !== 'completed' && (
        <VisitorInvite
          firstName={visitorFirstName}
          onFirstNameChange={setVisitorFirstName}
          lastName={visitorLastName}
          onLastNameChange={setVisitorLastName}
          phone={visitorPhone}
          onPhoneChange={setVisitorPhone}
          email={visitorEmail}
          onEmailChange={setVisitorEmail}
          onInvite={handleInviteVisitor}
          submitting={visitorSubmitting}
          message={visitorMessage}
        />
      )}

      <RouteList points={meetingPoints} currentPointId={activity.currentMeetingPointId} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  chat: { marginLeft: 'auto', paddingVertical: space.sm },
  desc: { marginBottom: space.md },
  controls: { marginTop: space.sm },
  planned: { marginTop: space.sm },
  broadcast: { marginTop: space.md },
});
