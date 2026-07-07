import { launchImageLibrary, type ImagePickerResponse } from 'react-native-image-picker';
import pickImage, { pickImages } from '../../../src/utils/pickImage';

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
}));

const mockLaunchImageLibrary = launchImageLibrary as jest.MockedFunction<typeof launchImageLibrary>;

// Den rigtige launchImageLibrary leverer svaret BÅDE via callback og som
// Promise — mock-implementeringen skal matche hele signaturen, ellers
// afviser tsc den (callback er desuden optional, deraf ?.-kaldet).
const respondWith = (response: ImagePickerResponse): typeof launchImageLibrary =>
  (_options, callback) => {
    callback?.(response);
    return Promise.resolve(response);
  };

beforeEach(() => {
  mockLaunchImageLibrary.mockClear();
});

describe('pickImage', () => {
  test('returnerer null når bruger cancler', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({ didCancel: true, assets: [] }));

    const result = await pickImage();
    expect(result).toBeNull();
  });

  test('returnerer null ved errorCode', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({ didCancel: false, errorCode: 'permission' }));

    const result = await pickImage();
    expect(result).toBeNull();
  });

  test('returnerer null når billede ikke har URI', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({ assets: [{}] }));

    const result = await pickImage();
    expect(result).toBeNull();
  });

  test('returnerer URI når billedet er småt nok', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({
      didCancel: false,
      assets: [{ uri: 'file://image.jpg', fileSize: 500000 }],
    }));

    const result = await pickImage();
    expect(result).toBe('file://image.jpg');
  });

  test('retry med lavere quality når billedet er for stort', async () => {
    mockLaunchImageLibrary
      .mockImplementationOnce(respondWith({ assets: [{ uri: 'file://big.jpg', fileSize: 5_000_000 }] })) // for stort
      .mockImplementationOnce(respondWith({ assets: [{ uri: 'file://small.jpg', fileSize: 500_000 }] })); // ok

    const result = await pickImage();

    expect(result).toBe('file://small.jpg'); // retry lykkedes
    expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(2); // præcis ét retry
    const [firstCall, secondCall] = mockLaunchImageLibrary.mock.calls;
    expect(secondCall[0].quality).toBeLessThan(firstCall[0].quality!); // andet kald havde lavere quality
  });

  test('returnerer URI ved floor quality selvom billedet er for stort', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({
      assets: [{ uri: 'file://image.jpg', fileSize: 5_000_000 }], // 5 MB, altid for stor
    }));

    const result = await pickImage();

    expect(result).toBe('file://image.jpg'); // URI kom igennem
    expect(mockLaunchImageLibrary.mock.calls.length).toBeGreaterThan(1); // retry skete
    const lastCall = mockLaunchImageLibrary.mock.calls.at(-1)!;
    expect(lastCall[0].quality).toBeLessThanOrEqual(0.2); // rammer floor
  });
});

describe('pickImages', () => {
  test('returnerer null når bruger cancler', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({ didCancel: true, assets: [] }));

    const result = await pickImages(6);
    expect(result).toEqual([]);
  });

  test('returnerer URI når billedet er småt nok', async () => {
    mockLaunchImageLibrary.mockImplementation(respondWith({
      assets: [{ uri: 'file://image.jpg', fileSize: 500000 }],
    }));

    const result = await pickImages(6);
    expect(result).toEqual(['file://image.jpg']);
  });
});
