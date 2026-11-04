
/**
 * Centralized application enums.
 * Update this file when academic options change.
 */

export const BRANCH = Object.freeze({
  CSE: 'CSE',
  AIML: 'AIML',
  DS: 'DS',
});

export const YEAR = Object.freeze({
  FIRST: 1,
  SECOND: 2,
  THIRD: 3,
  FOURTH: 4,
});

export const SECTION = Object.freeze({
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
});

export const ACTIVITY_DURATION = Object.freeze({
  FIVE_MINUTES: 5,
  TEN_MINUTES: 10,
  FIFTEEN_MINUTES: 15,
  TWENTY_MINUTES: 20,
  TWENTY_FIVE_MINUTES: 25,
  THIRTY_MINUTES: 30,
  THIRTY_FIVE_MINUTES: 35,
  FORTY_MINUTES: 40,
  FORTY_FIVE_MINUTES: 45,
  FIFTY_MINUTES: 50,
  FIFTY_FIVE_MINUTES: 55,
  SIXTY_MINUTES: 60,
  SIXTY_FIVE_MINUTES: 65,
  SEVENTY_MINUTES: 70,
  SEVENTY_FIVE_MINUTES: 75,
  EIGHTY_MINUTES: 80,
  EIGHTY_FIVE_MINUTES: 85,
  NINETY_MINUTES: 90,
  NINETY_FIVE_MINUTES: 95,
  ONE_HUNDRED_MINUTES: 100,
  ONE_HUNDRED_FIVE_MINUTES: 105,
  ONE_HUNDRED_TEN_MINUTES: 110,
  ONE_HUNDRED_FIFTEEN_MINUTES: 115,
  ONE_HUNDRED_TWENTY_MINUTES: 120,
});

// Special value for dropdown filters only.
export const FILTER_ALL = 'ALL';

// Arrays generated automatically from enums.
export const BRANCHES = Object.values(BRANCH);
export const YEARS = Object.values(YEAR);
export const SECTIONS = Object.values(SECTION);
export const DURATIONS = Object.values(ACTIVITY_DURATION);
