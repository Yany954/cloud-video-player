import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { UploadSource } from './source';

export class PermissionDeniedError extends Error {
  constructor(readonly what: 'camera') {
    super(`${what} permission denied`);
  }
}

/**
 * How the phone prepares a video chosen from Photos before it is sent.
 *
 * A recording as it comes out of the camera can be around 100 Mbps (4K, 60 frames, HDR): slow
 * to upload and too heavy to stream. So the phone makes a lighter copy first, with its own
 * hardware encoder: HEVC at up to 4K, which keeps the resolution, the frame rate and the HDR
 * brightness at a fraction of the data. (The website gets less: Safari hands it an H.264
 * copy at 30 frames without HDR.)
 *
 * The native preset exists in expo-image-picker (`hevc_3840_2160 = 10`) but is missing from
 * its TypeScript enum, hence the number.
 */
const PHONE_EXPORT_PRESET = 10 as ImagePicker.VideoExportPreset;

/**
 * Videos chosen from the photo library. The system's own picker is used, which needs no
 * access to the library: the app only ever receives the videos the person picks.
 */
export async function chooseVideos(): Promise<UploadSource[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    // The recording as it is, which the preset below then makes lighter in one step.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    videoExportPreset: PHONE_EXPORT_PRESET,
    // A video kept only in iCloud is fetched by the picker before it is handed over.
    shouldDownloadFromNetwork: true,
  });
  return result.canceled ? [] : Promise.all(result.assets.map(toSource));
}

/** A new recording from the phone's camera. */
export async function recordVideo(): Promise<UploadSource[]> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDeniedError('camera');

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
    // No limit: concerts are long.
    videoMaxDuration: 0,
  });
  return result.canceled ? [] : Promise.all(result.assets.map(toSource));
}

async function toSource(asset: ImagePicker.ImagePickerAsset): Promise<UploadSource> {
  const fileName = asset.fileName ?? nameFromUri(asset.uri);
  return {
    uri: asset.uri,
    fileName,
    sizeBytes: asset.fileSize ?? 0,
    assetId: asset.assetId ?? null,
    durationSeconds: asset.duration != null ? Math.round(asset.duration / 1000) : null,
    thumbnailUri: await thumbnailOf(asset.uri),
  };
}

function nameFromUri(uri: string): string {
  const last = decodeURIComponent(uri.split('/').pop() ?? '');
  return last.includes('.') ? last : 'video.mov';
}

/** A convenience only: a video without a picture uploads all the same. */
async function thumbnailOf(uri: string): Promise<string | null> {
  try {
    // A second in: the very first frame is often black.
    return (await VideoThumbnails.getThumbnailAsync(uri, { time: 1000, quality: 0.6 })).uri;
  } catch {
    return null;
  }
}
