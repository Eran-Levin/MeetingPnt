import { deviceTimeZone } from '@meetingpnt/shared';
import { useMemo } from 'react';
import { useTranslation } from '../i18n/index.js';
import { Select } from './ui/Select.js';

function knownZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');
  } catch {
    return [];
  }
}

interface Props {
  /** The zone set at this level, or null to inherit. */
  value: string | null;
  onChange: (zone: string | null) => void;
  /**
   * What this level inherits when empty — the group's or the leader's zone. Omit for the leader's
   * own default, which has nothing above it and so always holds a zone.
   */
  inheritedZone?: string | null;
  inherits?: boolean;
  label?: string;
  hint?: string;
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * One zone picker for all three levels. An empty choice means "inherit", and says what it would
 * inherit, so a leader can see at a glance which zone an event will really run in.
 */
export function TimeZoneField({
  value,
  onChange,
  inheritedZone,
  inherits = true,
  label,
  hint,
  ariaLabel,
  className,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const zones = useMemo(() => {
    const list = knownZones();
    return value && !list.includes(value) ? [value, ...list] : list;
  }, [value]);

  return (
    <div className="flex flex-col gap-1">
      <Select
        label={label}
        value={value ?? ''}
        aria-label={ariaLabel}
        disabled={disabled}
        className={className}
        onChange={(e) => onChange(e.target.value || null)}
      >
        {inherits && (
          <option value="">
            {inheritedZone
              ? t('timeZone.inherit', { zone: inheritedZone })
              : t('timeZone.inheritDevice', { zone: deviceTimeZone() })}
          </option>
        )}
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zone}
          </option>
        ))}
      </Select>
      {hint && <p className="text-xs text-ink-secondary">{hint}</p>}
    </div>
  );
}
