import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { color, fontSize, minTouchTarget, radius, space, text } from './theme';

interface Props extends TextInputProps {
  label?: string;
  /** The wrapper, not the input — use it to size or de-space a field inside a row. */
  containerStyle?: StyleProp<ViewStyle>;
}

export function TextField({ label, style, containerStyle, ...props }: Props) {
  return (
    <View style={[styles.field, containerStyle]}>
      {label && <Text style={[text.caption, styles.label]}>{label}</Text>}
      <TextInput
        placeholderTextColor={color.textMuted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: space.md },
  label: { marginBottom: space.xs },
  input: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: color.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    fontSize: fontSize.body,
    color: color.text,
    backgroundColor: color.surface,
  },
});
