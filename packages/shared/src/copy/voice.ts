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

  events: {
    created: "Noted. We'll make sure you're ready.",
    deleted: "Event removed. We'll stop reminding you.",
    updated: "Updated. We're on it.",
  },

  alerts: {
    thirtyDay: (name: string) =>
      `Heads up: ${name}'s birthday is in 30 days. Plenty of time. For now.`,
    sevenDay: (name: string) =>
      `${name}'s birthday is in 7 days. Time to stop procrastinating.`,
    oneDay: (name: string) =>
      `${name}'s event is TOMORROW. This is not a drill.`,
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

  nudges: {
    setBudget: (name: string) =>
      `Set a budget for ${name} to get more targeted suggestions.`,
    enrichDossier: (name: string) =>
      `Want better suggestions? Tell us more about ${name}.`,
  },

  suggestions: {
    topPick: "We'd pick this one.",
    empty:
      "We came up empty. Try updating their dossier or adjusting the budget.",
    lowCount:
      "We're running low on ideas. Consider updating their dossier or never-again list.",
    selected: (name: string) =>
      `Good choice. ${name} is going to love this.`,
    surpriseMe: "Let us pick. Trust us.",
    surpriseMeResult: (name: string) =>
      `We picked this for ${name}. You're welcome.`,
    surpriseMeUndo: "Fine. Be that way. Here are your options.",
    loading: [
      "We're thinking. Give us a second. Good gifts take a moment.",
      "Reading the dossier. Cross-referencing taste. Almost there.",
      "Considering options that aren't socks. Stand by.",
    ] as readonly string[],
  },

  upsell: {
    moreSuggestions:
      "Pro members get 5 suggestions with deeper personalization. See what you're missing.",
    reRoll:
      "Want more options? Upgrade to Pro for up to 3 re-rolls.",
    boldMode:
      "Bold mode is a Pro feature. Safe is great. But bold is better.",
    historyContext:
      "Pro members get smarter suggestions that learn from your gift history. Upgrade to unlock.",
  },

  errors: {
    eventsLoad: "Something went wrong loading your events. Try again.",
    generic: "Something went wrong. Try again.",
    aiTimeout:
      "The gift oracle is temporarily offline. Even we have bad days.",
    rateLimited:
      "Easy there. Even genius needs a break. Try again in a few minutes.",
    aiGeneric:
      "Something went wrong with our gift engine. Try again.",
  },

  cancelWindow:
    "You've got 2 hours to cancel. After that, it's in the mail and you're a hero.",
} as const;
