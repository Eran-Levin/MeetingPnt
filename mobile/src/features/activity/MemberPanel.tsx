import type { LocationSnapshotWithUser, RsvpStatus } from '@meetingpnt/shared';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { Button, ButtonRow, Card, Section, TextField, color, space, text } from '../../ui';

interface Props {
  status: RsvpStatus | null;
  note: string;
  onNoteChange: (value: string) => void;
  onRsvp: (status: RsvpStatus) => void;
  message: string | null;
  /** Only while the event runs: the leader either broadcasts, or can be asked. */
  running: boolean;
  broadcasting: boolean;
  liveLeaderLocation: LocationSnapshotWithUser | null;
  askedLeaderLocation: LocationSnapshotWithUser | null;
  onAskLeader: () => void;
  askBusy: boolean;
  askMessage: string | null;
  describeAge: (capturedAt: string) => string;
  mapsLinkFor: (location: { lat: number; lng: number }) => string;
}

/** The member's own business on this event: am I coming, and where's the leader. */
export function MemberPanel({
  status,
  note,
  onNoteChange,
  onRsvp,
  message,
  running,
  broadcasting,
  liveLeaderLocation,
  askedLeaderLocation,
  onAskLeader,
  askBusy,
  askMessage,
  describeAge,
  mapsLinkFor,
}: Props) {
  return (
    <>
      <Section label="Are you coming?">
        <ButtonRow>
          <Button
            label="Going"
            onPress={() => onRsvp('approved')}
            variant={status === 'approved' ? 'primary' : 'secondary'}
            grow
          />
          <Button
            label="Not going"
            onPress={() => onRsvp('declined')}
            variant={status === 'declined' ? 'danger' : 'secondary'}
            grow
          />
        </ButtonRow>
        <TextField
          placeholder="Add a note — running 15 mins late…"
          value={note}
          onChangeText={onNoteChange}
          style={styles.note}
        />
        {message && <Text style={text.secondary}>{message}</Text>}
      </Section>

      {running && status === 'approved' && (
        <Section label="Your leader">
          {/* A live broadcast answers the question before it's asked, so it replaces the button
              rather than sitting next to it. */}
          {broadcasting ? (
            <Card>
              <Text style={text.bodyStrong}>
                {liveLeaderLocation?.user?.name ?? 'Your leader'} is sharing their position
              </Text>
              {liveLeaderLocation ? (
                <>
                  <Text style={[text.secondary, styles.age]}>
                    Updated {describeAge(liveLeaderLocation.capturedAt)}.
                  </Text>
                  <Button
                    label="Follow them in Maps"
                    onPress={() => Linking.openURL(mapsLinkFor(liveLeaderLocation.location))}
                  />
                </>
              ) : (
                <Text style={[text.secondary, styles.age]}>Waiting for their first position…</Text>
              )}
            </Card>
          ) : (
            <View>
              <Button
                label={askBusy ? 'Asking…' : "Where's the leader?"}
                onPress={onAskLeader}
                busy={askBusy}
                variant="secondary"
              />
              {askMessage && <Text style={[text.secondary, styles.age]}>{askMessage}</Text>}
              {askedLeaderLocation && (
                <Button
                  label={`Open ${askedLeaderLocation.user?.name ?? 'the leader'}'s position in Maps`}
                  onPress={() => Linking.openURL(mapsLinkFor(askedLeaderLocation.location))}
                  variant="quiet"
                />
              )}
            </View>
          )}
        </Section>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  note: { marginTop: space.md },
  age: { marginTop: space.xs, marginBottom: space.sm, color: color.textSecondary },
});
