import getFirebaseError from '../src/utils/getFirebaseError';
import translations from '../src/translations';

describe('getFirebaseError', () => {
  test('returnerer den danske besked for en kendt fejlkode', () => {
    const error = { code: 'auth/network-request-failed' };
    expect(getFirebaseError(error, translations.da)).toBe(
      'Ingen internetforbindelse. Prøv igen.',
    );
  });


  test('returnerer den danske besked for en ukendt fejlkode', () => {
    const error = { code: 'auth/banan' };
    expect(getFirebaseError(error, translations.da)).toBe(
      'Noget gik galt. Prøv igen.',
    );
  });
  
  test('returnerer fallback når error-objektet er tomt', () => {
    const error = {};
    expect(getFirebaseError(error, translations.da)).toBe(
      'Noget gik galt. Prøv igen.',
    );
  });
  
  test('returnerer fallback når code er null', () => {
    const error = { code: null };
    expect(getFirebaseError(error, translations.da)).toBe(
      'Noget gik galt. Prøv igen.',
    );
  });

  test('returnerer fallback når error er null', () => {
    expect(getFirebaseError(null, translations.da)).toBe(
        'Noget gik galt. Prøv igen.',
    );
  });


});

