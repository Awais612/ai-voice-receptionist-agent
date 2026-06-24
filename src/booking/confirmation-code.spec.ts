import { generateConfirmationCode } from './confirmation-code';

describe('generateConfirmationCode', () => {
  it('matches AC-#### format', () =>
    expect(generateConfirmationCode()).toMatch(/^AC-\d{4}$/));
  it('varies', () => {
    const s = new Set(
      Array.from({ length: 50 }, () => generateConfirmationCode()),
    );
    expect(s.size).toBeGreaterThan(1);
  });
});
