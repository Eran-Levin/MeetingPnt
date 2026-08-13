import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, text, toneTint } from '../../ui';

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  error?: string | null;
  footer?: React.ReactNode;
}

/**
 * The three ways into the app share one shape. They scroll rather than centre rigidly: with a
 * keyboard up, five fields and a button don't fit a phone, and the register form was reachable
 * only by dismissing the keyboard between fields.
 */
export function AuthLayout({ title, subtitle, children, error, footer }: Props) {
  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[text.display, styles.title]}>{title}</Text>
        {subtitle && <Text style={[text.secondary, styles.subtitle]}>{subtitle}</Text>}

        {children}

        {error && (
          <View style={styles.error}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {footer && <View style={styles.footer}>{footer}</View>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: color.surfaceSunken },
  content: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: space.xs, marginBottom: space.xl },
  error: {
    backgroundColor: toneTint.danger.bg,
    borderRadius: radius.md,
    padding: space.md,
    marginTop: space.md,
  },
  errorText: { color: toneTint.danger.fg },
  footer: { marginTop: space.xl, alignItems: 'center' },
});
