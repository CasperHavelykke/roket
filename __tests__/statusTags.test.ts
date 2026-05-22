import { getStatusTag } from '../src/statusTags';

// `describe` grupperer beslægtede tests under én overskrift — rent kosmetisk
// i outputtet, men gør det nemt at se hvad der hører sammen.
describe('getStatusTag', () => {
  test('finder et kendt tag og returnerer hele objektet', () => {
    expect(getStatusTag('coffee')).toEqual({ id: 'coffee', emoji: '☕' });
  });

  test('virker for et andet kendt tag', () => {
    expect(getStatusTag('hike')).toEqual({ id: 'hike', emoji: '🥾' });
  });

  test('giver null for et id der ikke findes', () => {
    expect(getStatusTag('banan')).toBeNull();
  });

  test('giver null når id mangler (null / undefined / tom streng)', () => {
    expect(getStatusTag(null)).toBeNull();
    expect(getStatusTag(undefined)).toBeNull();
    expect(getStatusTag('')).toBeNull();
  });
});
