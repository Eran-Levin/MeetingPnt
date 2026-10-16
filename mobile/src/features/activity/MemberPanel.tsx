import { isolate, type LocationSnapshotWithUser, type RsvpStatus } from '@meetingpnt/shared';
import { Alert, Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
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
  /** Leaving mid-event: the member's own roll-call mark at the stop the group is at. */
  hasLeft: boolean;
  onLeave: () => void;
  leaveBusy: boolean;
  leaveMessage: string | null;
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
  hasLeft,
  onLeave,
  leaveBusy,
  leaveMessage,
  describeAge,
  mapsLinkFor,
}: Props) {
  const { t } = useTranslation();
  return (
    <>
      <Section label={t('memberPanel.areYouComing')}>
        <ButtonRow>
          <Button
            label={t('memberPanel.going')}
            onPress={() => onRsvp('approved')}
            variant={status === 'approved' ? 'primary' : 'secondary'}
            grow
          />
          <Button
            label={t('memberPanel.notGoing')}
            onPress={() => onRsvp('declined')}
            variant={status === 'declined' ? 'danger' : 'secondary'}
            grow
          />
        </ButtonRow>
        <TextField
          placeholder={t('memberPanel.notePlaceholder')}
          value={note}
          onChangeText={onNoteChange}
          style={styles.note}
        />
        {message && <Text style={text.secondary}>{message}</Text>}
      </Section>

      {running && status === 'approved' && (
        <Section label={t('memberPanel.yourLeader')}>
          {/* A live broadcast answers the question before it's asked, so it replaces the button
              rather than sitting next to it. */}
          {broadcasting ? (
            <Card>
              <Text style={text.bodyStrong}>
                {t('memberPanel.leaderSharing', {
                  name: isolate(liveLeaderLocation?.user?.name ?? t('memberPanel.yourLeader')),
                })}
              </Text>
              {liveLeaderLocation ? (
                <>
                  <Text style={[text.secondary, styles.age]}>
                    {t('memberPanel.updated', { age: describeAge(liveLeaderLocation.capturedAt) })}
                  </Text>
                  <Button
                    label={t('memberPanel.followInMaps')}
                    onPress={() => Linking.openURL(mapsLinkFor(liveLeaderLocation.location))}
                  />
                </>
              ) : (
                <Text style={[text.secondary, styles.age]}>{t('memberPanel.waiting')}</Text>
              )}
            </Card>
          ) : (
            <View>
              <Button
                label={askBusy ? t('memberPanel.asking') : t('memberPanel.whereIsLeader')}
                onPress={onAskLeader}
                busy={askBusy}
                variant="secondary"
              />
              {askMessage && <Text style={[text.secondary, styles.age]}>{askMessage}</Text>}
              {askedLeaderLocation && (
                <Button
                  label={t('memberPanel.openPosition', {
                    name: isolate(askedLeaderLocation.user?.name ?? t('memberPanel.yourLeader')),
                  })}
                  onPress={() => Linking.openURL(mapsLinkFor(askedLeaderLocation.location))}
                  variant="quiet"
                />
              )}
            </View>
          )}
        </Section>
      )}

      {/* Leaving is a decision on a screen people tap one-handed outdoors, so it asks once. */}
      {running && status === 'approved' && (
        <View style={styles.leave}>
          {hasLeft ? (
            <Text style={text.secondary}>{t('memberPanel.youLeft')}</Text>
          ) : (
            <View>
              <Button
                label={leaveBusy ? t('memberPanel.leaving') : t('memberPanel.leave')}
                variant="secondary"
                busy={leaveBusy}
                onPress={() =>
                  Alert.alert(t('memberPanel.leaveConfirm'), undefined, [
                    { text: t('memberPanel.leaveStay'), style: 'cancel' },
                    { text: t('memberPanel.leave'), style: 'destructive', onPress: onLeave },
                  ])
                }
              />
              {leaveMessage && <Text style={[text.secondary, styles.age]}>{leaveMessage}</Text>}
            </View>
          )}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  leave: { marginTop: space.lg },
  note: { marginTop: space.md },
  age: { marginTop: space.xs, marginBottom: space.sm, color: color.textSecondary },
});
