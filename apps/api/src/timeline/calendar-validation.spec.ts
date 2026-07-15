import {
  compareTimelineDates,
  DEFAULT_CALENDAR_CONFIG,
  isValidTimelineDate,
  isValidWorldDate,
  type CalendarConfig,
} from '@worldbinder/validation';

// A small fantasy calendar exercising both narrower (fewer months) and
// wider (a >31-day month) bounds than DEFAULT_CALENDAR_CONFIG, to prove
// validation is genuinely calendar-aware rather than hardcoded Gregorian.
const FANTASY_CALENDAR: CalendarConfig = {
  schemaVersion: 1,
  months: [
    { name: 'Frostwane', days: 40 },
    { name: 'Sunreach', days: 35 },
    { name: 'Harvestide', days: 30 },
  ],
};

describe('isValidTimelineDate', () => {
  it("requires neither month nor day at 'year' precision", () => {
    expect(isValidTimelineDate({}, 'year', DEFAULT_CALENDAR_CONFIG)).toBe(true);
    expect(
      isValidTimelineDate({ month: 1 }, 'year', DEFAULT_CALENDAR_CONFIG),
    ).toBe(false);
  });

  it("requires a month but not a day at 'month' precision", () => {
    expect(
      isValidTimelineDate({ month: 3 }, 'month', DEFAULT_CALENDAR_CONFIG),
    ).toBe(true);
    expect(isValidTimelineDate({}, 'month', DEFAULT_CALENDAR_CONFIG)).toBe(
      false,
    );
    expect(
      isValidTimelineDate(
        { month: 3, day: 10 },
        'month',
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBe(false);
  });

  it("rejects a month beyond the calendar's month count", () => {
    expect(
      isValidTimelineDate({ month: 13 }, 'month', DEFAULT_CALENDAR_CONFIG),
    ).toBe(false);
    expect(isValidTimelineDate({ month: 3 }, 'month', FANTASY_CALENDAR)).toBe(
      true,
    );
    expect(isValidTimelineDate({ month: 4 }, 'month', FANTASY_CALENDAR)).toBe(
      false,
    );
  });

  it("bounds day by that specific month's day count, not a fixed 31", () => {
    // February (28 days) in the default calendar.
    expect(
      isValidTimelineDate(
        { month: 2, day: 28 },
        'day',
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBe(true);
    expect(
      isValidTimelineDate(
        { month: 2, day: 29 },
        'day',
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBe(false);
    // A 40-day fantasy month rejects the Gregorian-shaped max of 31.
    expect(
      isValidTimelineDate({ month: 1, day: 40 }, 'day', FANTASY_CALENDAR),
    ).toBe(true);
    expect(
      isValidTimelineDate({ month: 1, day: 41 }, 'day', FANTASY_CALENDAR),
    ).toBe(false);
  });
});

describe('isValidWorldDate', () => {
  it('behaves like a day-precision TimelineDate check', () => {
    expect(isValidWorldDate({ month: 1, day: 40 }, FANTASY_CALENDAR)).toBe(
      true,
    );
    expect(isValidWorldDate({ month: 1, day: 41 }, FANTASY_CALENDAR)).toBe(
      false,
    );
  });
});

describe('compareTimelineDates', () => {
  it('orders by year first', () => {
    expect(
      compareTimelineDates(
        { year: 100 },
        { year: 101 },
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBeLessThan(0);
  });

  it('a year-only date resolves to the start of the year, tying with Jan 1st and sorting before anything later that year', () => {
    expect(
      compareTimelineDates(
        { year: 100 },
        { year: 100, month: 1, day: 1 },
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBe(0);
    expect(
      compareTimelineDates(
        { year: 100 },
        { year: 100, month: 6, day: 15 },
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBeLessThan(0);
  });

  it('orders by month/day within the same year, respecting variable month lengths', () => {
    expect(
      compareTimelineDates(
        { year: 5, month: 1, day: 40 },
        { year: 5, month: 2, day: 1 },
        FANTASY_CALENDAR,
      ),
    ).toBeLessThan(0);
  });

  it('treats equal dates as equal', () => {
    expect(
      compareTimelineDates(
        { year: 5, month: 2, day: 10 },
        { year: 5, month: 2, day: 10 },
        DEFAULT_CALENDAR_CONFIG,
      ),
    ).toBe(0);
  });
});
