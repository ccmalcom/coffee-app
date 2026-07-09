// Named tunable constants for the taste profile. Single home — never inline.

// Cold-start gate: below this many rated coffees, no real profile is built and
// /profile shows a directive-based "not personalized yet" state. Matches the
// parent spec's Discovery cold-start threshold of 5 rated coffees.
export const MIN_RATED_COFFEES_FOR_PROFILE = 5

// A coffee rated at or above this (out of 5) is a "liked" reference driving
// positive affinity. 1–2★ contribute mild negative affinity; 3★ is neutral.
export const POSITIVE_RATING_THRESHOLD = 4

// Stamped into the stored profile jsonb so future shape changes are detectable.
export const PROFILE_VERSION = 1
