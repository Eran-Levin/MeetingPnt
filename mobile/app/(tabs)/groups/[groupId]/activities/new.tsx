import type { TransportMode } from '@meetingpnt/shared';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { activitiesApi } from '../../../../../src/api/activitiesApi';
import { apiErrorMessage, useLocale, useTranslation } from '../../../../../src/i18n';
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

export default function NewActivityScreen() {
  const { t } = useTranslation();
  const locale = useLocale();
  // 2023-01-01 was a Sunday, so day 0 lines up with the `daysOfWeek` the server expects.
  const weekdayLabels = Array.from({ length: 7 }, (_, day) =>
    new Date(2023, 0, 1 + day).toLocaleDateString(locale, { weekday: 'short' }),
  );
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
  const [singleLocation, setSingleLocation] = useState(false);
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
      setError(t('newActivity.pickDay'));
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
        allDay ? t('newActivity.endDateBeforeStart') : t('newActivity.endTimeBeforeStart'),
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
        singleLocation,
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
      setError(apiErrorMessage(err, t('newActivity.failed')));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen title={t('newActivity.title')} bottomInset={80}>
      <TextField
        label={t('newActivity.fieldTitle')}
        placeholder={t('newActivity.titlePlaceholder')}
        value={title}
        onChangeText={setTitle}
      />
      <TextField
        label={t('newActivity.description')}
        value={description}
        onChangeText={setDescription}
      />

      <Section label={t('newActivity.when')} first>
        <Toggle
          label={t('newActivity.spansDays')}
          hint={t('newActivity.spansDaysHint')}
          value={allDay}
          onValueChange={setAllDay}
        />

        <PickerField
          label={allDay ? t('newActivity.startDate') : t('newActivity.date')}
          value={startAt.toLocaleDateString(locale)}
          onPress={() => setPicker('date')}
        />

        {allDay ? (
          <PickerField
            label={t('newActivity.endDate')}
            value={endAt.toLocaleDateString(locale)}
            onPress={() => setPicker('endDate')}
          />
        ) : (
          <>
            <PickerField
              label={t('newActivity.startTime')}
              value={startAt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
              onPress={() => setPicker('startTime')}
            />
            <PickerField
              label={t('newActivity.endTime')}
              value={endAt.toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })}
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

      <Section label={t('newActivity.attendance')}>
        {/* Off is how a trip day works: people booked the trip, so they don't re-confirm each
            morning — but they can still decline the one day they're sitting out. */}
        <Toggle
          label={t('newActivity.approve')}
          hint={requiresRsvp ? t('newActivity.approveOn') : t('newActivity.approveOff')}
          value={requiresRsvp}
          onValueChange={setRequiresRsvp}
        />
      </Section>

      <Section label={t('newActivity.where')}>
        {/* One room, every week — there's no route, so the clients drop the itinerary rather than
            showing a one-item list. */}
        <Toggle
          label={t('newActivity.single')}
          hint={t('newActivity.singleHint')}
          value={singleLocation}
          onValueChange={setSingleLocation}
        />
      </Section>

      <Section label={t('newActivity.transport')}>
        <ChipRow>
          {TRANSPORT_MODES.map((mode) => (
            <Chip
              key={mode}
              label={t(`newActivity.${mode}`)}
              selected={transportMode === mode}
              onPress={() => setTransportMode(mode)}
            />
          ))}
        </ChipRow>
      </Section>

      <Section label={t('newActivity.repeat')}>
        <Toggle
          label={t('newActivity.repeatWeekly')}
          value={repeats}
          onValueChange={setRepeats}
        />

        {repeats && (
          <View style={styles.repeat}>
            <View style={styles.inlineRow}>
              <Text style={text.body}>{t('newActivity.every')}</Text>
              <TextField
                keyboardType="number-pad"
                value={intervalWeeks}
                onChangeText={setIntervalWeeks}
                containerStyle={styles.number}
              />
              <Text style={text.body}>{t('newActivity.weeks')}</Text>
            </View>

            <ChipRow>
              {weekdayLabels.map((label, day) => (
                <Chip
                  key={day}
                  label={label}
                  selected={daysOfWeek.includes(day)}
                  onPress={() => toggleDay(day)}
                />
              ))}
            </ChipRow>

            <View style={styles.inlineRow}>
              <Text style={text.body}>{t('newActivity.for')}</Text>
              <TextField
                keyboardType="number-pad"
                value={count}
                onChangeText={setCount}
                containerStyle={styles.number}
              />
              <Text style={text.body}>{t('newActivity.occurrences')}</Text>
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
        label={
          submitting
            ? t('newActivity.creating')
            : repeats
              ? t('newActivity.createSeries')
              : t('newActivity.createDraft')
        }
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
