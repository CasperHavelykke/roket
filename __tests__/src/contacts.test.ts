// contacts.ts importerer firestore (native modul) — mock så den rene
// par-/status-logik kan testes uden native afhængigheder
jest.mock('@react-native-firebase/firestore', () => ({
  __esModule: true,
  default: jest.fn(),
}));

import { contactPairId, statusForRequest, ContactRequestDoc } from '../../src/contacts';

describe('contactPairId', () => {
  test('er symmetrisk — samme id uanset rækkefølge', () => {
    expect(contactPairId('bob', 'anna')).toBe(contactPairId('anna', 'bob'));
  });

  test('sorterer uids og joiner med underscore (matcher 1:1 chatId-formatet)', () => {
    expect(contactPairId('uidB', 'uidA')).toBe('uidA_uidB');
  });
});

describe('statusForRequest', () => {
  const me = 'me123';
  const other = 'other456';

  test('intet dokument giver none', () => {
    expect(statusForRequest(null, me)).toBe('none');
  });

  test('accepteret giver connected uanset retning', () => {
    const fromMe: ContactRequestDoc = { from: me, to: other, eventId: 'e1', status: 'accepted' };
    const toMe: ContactRequestDoc = { from: other, to: me, eventId: 'e1', status: 'accepted' };
    expect(statusForRequest(fromMe, me)).toBe('connected');
    expect(statusForRequest(toMe, me)).toBe('connected');
  });

  test('afventende fra mig giver pending_sent', () => {
    const data: ContactRequestDoc = { from: me, to: other, eventId: 'e1', status: 'pending' };
    expect(statusForRequest(data, me)).toBe('pending_sent');
  });

  test('afventende til mig giver pending_received', () => {
    const data: ContactRequestDoc = { from: other, to: me, eventId: 'e1', status: 'pending' };
    expect(statusForRequest(data, me)).toBe('pending_received');
  });
});
