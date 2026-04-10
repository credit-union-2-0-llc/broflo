/**
 * Broflo brand voice — all UI copy lives here.
 * No inline strings for user-facing text.
 *
 * Voice: Mildly cocky. Self-aware. Tongue-in-cheek.
 * Think "confident person who actually has their life together
 * and is secretly thoughtful."
 */

export const VOICE = {
  tagline: "You're busy. We remembered. She's impressed. You're welcome.",

  emptyStates: {
    giftHistory:
      "Nothing here yet. That's fine. Nobody's judging. (We're judging a little.)",
    people:
      "No one to shop for? Either you're perfect or in denial. Let's fix that.",
    events: "Your calendar is empty. Suspicious. Add someone worth remembering.",
    suggestions:
      "We're thinking. Give us a second. Good gifts take a moment.",
    neverAgain:
      "No banned gifts yet. Give it time. You'll learn.",
  },

  people: {
    addFirst: "Add your first person. We'll handle the rest.",
    addAnother: "Add another person worth impressing.",
    deleted: "Gone. We won't ask questions.",
    neverAgainAdded: "Noted. We'll never suggest that again.",
  },

  orderSuccess:
    "Done. They have no idea how easy that was. Keep it that way.",

  alerts: {
    thirtyDay: (name: string) =>
      `Heads up: ${name}'s birthday is in 30 days. Plenty of time. For now.`,
    sevenDay: (name: string) =>
      `${name}'s birthday is in 7 days. Time to stop procrastinating.`,
    missedEvent:
      "We tried to warn you. The Groveling Package awaits.",
  },

  levels: {
    rookieBro: "Rookie Bro",
    solidDude: "Solid Dude",
    giftWhisperer: "Gift Whisperer",
    theLegend: "The Legend",
    brofloElite: "Broflo Elite",
  },

  levelUp: (level: string) =>
    `Welcome to ${level}. People notice. They just won't say it.`,

  cancelWindow:
    "You've got 2 hours to cancel. After that, it's in the mail and you're a hero.",
} as const;
