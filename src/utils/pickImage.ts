import { launchImageLibrary, PhotoQuality } from 'react-native-image-picker';

const MAX_FILE_SIZE = 1024 * 1024; // 1 MB

/**
 * Åbn billedvælger med automatisk komprimering til maks 1 MB.
 * Prøver først med quality 0.8, derefter reducerer trinvist.
 */
export default function pickImage(): Promise<string | null> {
  return tryPick(0.8);
}

/**
 * Åbn billedvælger med multi-select (op til `limit` billeder).
 */
export function pickImages(limit: number): Promise<string[]> {
  return tryPickMulti(0.8, limit);
}

function tryPick(quality: number): Promise<string | null> {
  return new Promise(resolve => {
    launchImageLibrary(
      { mediaType: 'photo', quality: quality as PhotoQuality, maxWidth: 1080, maxHeight: 1080 },
      response => {
        if (response.didCancel || response.errorCode) {
          resolve(null);
          return;
        }

        const asset = response.assets?.[0];
        if (!asset?.uri) {
          resolve(null);
          return;
        }

        const fileSize = asset.fileSize ?? 0;

        if (fileSize > MAX_FILE_SIZE && quality > 0.2) {
          tryPick(Math.max(quality - 0.2, 0.1)).then(resolve);
          return;
        }

        resolve(asset.uri);
      },
    );
  });
}

function tryPickMulti(quality: number, limit: number): Promise<string[]> {
  return new Promise(resolve => {
    launchImageLibrary(
      { mediaType: 'photo', quality: quality as PhotoQuality, maxWidth: 1080, maxHeight: 1080, selectionLimit: limit },
      response => {
        if (response.didCancel || response.errorCode || !response.assets) {
          resolve([]);
          return;
        }

        const uris = response.assets
          .filter(a => !!a.uri)
          .map(a => a.uri!);

        // Hvis nogen er for store, re-picker vi med lavere quality
        const anyTooLarge = response.assets.some(a => (a.fileSize ?? 0) > MAX_FILE_SIZE);
        if (anyTooLarge && quality > 0.2) {
          tryPickMulti(Math.max(quality - 0.2, 0.1), limit).then(resolve);
          return;
        }

        resolve(uris);
      },
    );
  });
}
