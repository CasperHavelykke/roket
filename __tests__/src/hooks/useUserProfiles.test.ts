// Hook-filen importerer firestore (native modul) — mockes så suiten kan
// importere den rene chunk-logik uden native afhængigheder
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { chunkUids, PROFILE_CHUNK_SIZE } from '../../../src/hooks/useUserProfiles';

describe('chunkUids', () => {
  test('tom liste giver ingen chunks', () => {
    expect(chunkUids([])).toEqual([]);
  });

  test('liste under grænsen giver én chunk', () => {
    expect(chunkUids(['a', 'b', 'c'])).toEqual([['a', 'b', 'c']]);
  });

  test('liste præcis på grænsen giver én chunk (grænseværdi)', () => {
    const uids = Array.from({ length: PROFILE_CHUNK_SIZE }, (_, i) => `u${i}`);
    expect(chunkUids(uids)).toHaveLength(1);
  });

  test('liste over grænsen deles op, sidste chunk får resten', () => {
    const uids = Array.from({ length: 23 }, (_, i) => `u${i}`);
    const chunks = chunkUids(uids);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(10);
    expect(chunks[1]).toHaveLength(10);
    expect(chunks[2]).toHaveLength(3);
    // Ingen uids tabes eller duplikeres
    expect(chunks.flat()).toEqual(uids);
  });
});
