// Én testfil pr. kildefil: alt der tester translations.ts bor her,
// opdelt i en describe-blok pr. funktion.
import translations from '../src/translations';

const da = translations.da;

describe('distanceMeters (da)', () => {
  test('returnerer tal + m', () => {
    expect(da.distanceMeters(30)).toBe('30 m');
  });
});

describe('chatActivityPrompt (da)', () => {
  test('coffee-tag giver kaffe-prompten med navnet indsat', () => {
    expect(da.chatActivityPrompt('Mette', 'coffee')).toBe(
      'Foreslå et godt sted at drikke kaffe med Mette',
    );
  });

  test('hike-tag giver vandretur-prompten', () => {
    expect(da.chatActivityPrompt('Anders', 'hike')).toBe(
      'Foreslå en vandretur med Anders',
    );
  });

  test('et ukendt tag falder tilbage til den generiske prompt', () => {
    expect(da.chatActivityPrompt('Mette', 'banan')).toBe(
      'Inviter Mette til en aktivitet',
    );
  });

  test('null som tag falder også tilbage', () => {
    expect(da.chatActivityPrompt('Mette', null)).toBe(
      'Inviter Mette til en aktivitet',
    );
  });

  test('navnet sættes korrekt ind uanset hvilket navn', () => {
    expect(da.chatActivityPrompt('Sofie', 'drinks')).toBe(
      'Foreslå en god bar med Sofie',
    );
  });
});

describe('chatActivityPrompt (en) — samme funktion, andet sprog', () => {
  test('coffee-tag giver den engelske prompt', () => {
    expect(translations.en.chatActivityPrompt('Mette', 'coffee')).toBe(
      'Suggest a good spot for coffee with Mette',
    );
  });

  test('ukendt tag falder tilbage på engelsk', () => {
    expect(translations.en.chatActivityPrompt('Mette', 'banan')).toBe(
      'Invite Mette to do something',
    );
  });
});
