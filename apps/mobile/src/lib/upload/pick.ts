import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { UploadSource } from './source';

export class PermissionDeniedError extends Error {
  constructor(readonly what: 'camera' | 'photos') {
    super(`${what} permission denied`);
  }
}

/**
 * What the phone hands over when a video is chosen from Photos.
 * - `smaller`: the phone first makes its "most compatible" version, as Safari does for the
 *   website: H.264 at a moderate data rate. About a quarter of the size of a 4K 60 fps
 *   original, quicker to upload, and it plays smoothly while streaming.
 * - `original`: the file exactly as recorded. Nothing is lost, but a 4K 60 fps recording is
 *   around 100 Mbps: slow to upload and too heavy to stream on most connections.
 */
export type UploadQuality = 'smaller' | 'original';

export async function chooseVideos(quality: UploadQuality): Promise<UploadSource[]> {
  if (quality === 'original') {
    // Reading the untouched file needs access to the library. Without asking first, iOS
    // shows its question after the videos are chosen, and a "no" loses the choice.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) throw new PermissionDeniedError('photos');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: true,
    selectionLimit: 0,
    orderedSelection: true,
    preferredAssetRepresentationMode:
      quality === 'original'
        ? ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current
        : ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    // No further export step of ours on top of what the phone hands over.
    videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
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
