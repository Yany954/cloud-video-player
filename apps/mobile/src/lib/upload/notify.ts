import * as Notifications from 'expo-notifications';

// Shown only when the app is not in front: inside the app the upload list says it already.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** Asks once, the first time a video is queued. A "no" is respected: uploads work the same. */
export async function askToNotify(): Promise<void> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted || !current.canAskAgain) return;
    await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true } });
  } catch {
    // Notifications are a convenience.
  }
}

/** A notification on this phone only; nothing is sent through a server. */
export async function notifyUploadsFinished(title: string, body: string): Promise<void> {
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch {
    // The list in the app still shows the result.
  }
}
