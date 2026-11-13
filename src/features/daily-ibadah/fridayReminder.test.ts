import { fridayReminderCopy } from './fridayReminder';

describe('fridayReminderCopy', () => {
  it('returns de copy', () => {
    const c = fridayReminderCopy('de');
    expect(c.title).toMatch(/Kahf/);
    expect(c.body.length).toBeGreaterThan(10);
  });

  it('falls back to en', () => {
    const c = fridayReminderCopy('xx');
    expect(c.title).toMatch(/Kahf/);
  });
});
