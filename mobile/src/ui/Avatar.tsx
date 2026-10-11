import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { color, fontWeight, radius } from './theme';

/** Two letters at most — "Ana María Ruiz" reads as AR, not AMR. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0]![0]!;
  const last = parts.length > 1 ? parts[parts.length - 1]![0]! : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  name: string;
  uri?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle & ImageStyle>;
}

/**
 * A face where there is one, initials where there isn't. Never an anonymous silhouette: a roster
 * of identical grey heads is worse at telling people apart than the names already were.
 */
export function Avatar({ name, uri, size = 36, style }: AvatarProps) {
  const shape = { width: size, height: size, borderRadius: radius.pill };
  // A photo that won't load (a bad address, a server asleep) falls back to initials; left alone it
  // is a blank grey circle, which is the one thing this component promises never to show.
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, shape, style]}
        onError={() => setFailed(true)}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View style={[styles.base, styles.fallback, shape, style]}>
      <Text style={[styles.initials, { fontSize: Math.round(size * 0.4) }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { backgroundColor: color.surfaceRaised },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontWeight: fontWeight.medium, color: color.textSecondary },
});
