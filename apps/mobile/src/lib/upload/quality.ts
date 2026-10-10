import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UploadQuality } from './pick';

const KEY = 'cvp.upload-quality';

/** Smaller unless the person chose to send originals on this phone. */
export async function readUploadQuality(): Promise<UploadQuality> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'original' ? 'original' : 'smaller';
  } catch {
    return 'smaller';
  }
}

export async function writeUploadQuality(quality: UploadQuality): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, quality);
  } catch {
    // The choice then lasts until the app is closed.
  }
}
