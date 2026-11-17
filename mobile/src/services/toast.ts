import { Alert, Platform, ToastAndroid } from 'react-native';

/**
 * A brief confirmation of something that happened out of sight. Android has a toast built in;
 * iOS has nothing of the kind, so there it is an alert — heavier, but the message still arrives.
 */
export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.LONG);
  } else {
    Alert.alert(message);
  }
}
