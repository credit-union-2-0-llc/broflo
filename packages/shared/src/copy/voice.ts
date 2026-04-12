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
    recentGifts:
      "No gifts recorded yet. Once you start giving, we'll track everything here.",
  },

  people: {
    addFirst: "Add your first person. We'll handle the rest.",
    addAnother: "Add another person worth impressing.",
    deleted: "Gone. We won't ask questions.",
    neverAgainAdded: "Noted. We'll never suggest that again.",
  },

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
    yearView:
      "Year-over-year view is a Pro feature.",
    exportHistory:
      "Export is a Pro feature.",
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

  gifts: {
    recorded: "Gift logged. Your memory is officially outsourced.",
    nailedIt: "That's how it's done.",
    feedbackThanks: "Noted. This makes us smarter next time.",
    neverAgainConfirm: "Banished forever. Good call.",
  },

  feedback: {
    recorded: "Noted. We'll remember that for next time.",
    nailedIt: "Nailed it. Broflo Score updated.",
    neverAgainPrompt:
      "Want to make sure we never suggest this again?",
  },

  cancelWindow:
    "You've got 2 hours to cancel. After that, it's in the mail and you're a hero.",

  orderSuccess:
    "Done. They have no idea how easy that was. Keep it that way.",

  orderCancel: "Order cancelled. No charge. Try a different gift?",

  orderCancelConfirm: "Cancel this order? The gift won't be delivered.",

  orderCancelKeep: "Keep It",

  orderCancelConfirmAction: "Yes, Cancel",

  orderPlacing: "Placing your order...",

  orderPreviewCta: "Confirm & Order",

  orderFailed: "Something went wrong placing your order. Try again.",

  tracking: {
    emptyState: "No orders yet. Find someone a gift and we'll handle the rest.",
    inFlight: "Your gifts are on the move.",
    delivered: "Delivered. Another win for you.",
    trackingAvailable: "Here's your tracking. We'd say 'just relax' but you're already doing that.",
    noTracking: "No tracking yet — we're on it.",
    cancelled: "Cancelled. No charge. Try another?",
    failed: "Something went wrong on the retailer's end. We've got your back — no charge.",
    allClear: "All clear — no orders in transit.",
  },

  autopilot: {
    emptyState:
      "No autopilot rules yet. Set one up and we'll handle gifts while you sleep.",
    enabled: "Autopilot is live. Sit back.",
    disabled: "Autopilot paused. We'll wait until you're ready.",
    consentLabel: (cap: string) =>
      `I authorize Broflo to automatically place orders up to ${cap}/month on my behalf.`,
    budgetWarning:
      "You're getting close to your monthly cap. We'll pause autopilot before going over.",
    orderPlaced: (name: string) =>
      `Autopilot placed an order for ${name}. You're welcome.`,
    needsApproval: (name: string) =>
      `We found a gift for ${name} but weren't confident enough. Your call.`,
    tierGate:
      "Autopilot is a Pro feature. Upgrade and let us do the work.",
  },

  agent: {
    searching: [
      "Searching for the perfect match...",
      "Considering options that aren't socks. Stand by.",
      "Browsing like a human. Thinking like a machine.",
      "Cross-referencing their taste with what's in stock.",
      "Give us a second. Good finds take a moment.",
    ] as readonly string[],
    executing: [
      "Broflo is handling it. Relax.",
      "We're placing the order. Hands off.",
      "Working on it. This is what you pay us for.",
      "Almost there. Patience is a virtue you don't need.",
      "Adding to cart. Entering address. The boring stuff.",
    ] as readonly string[],
    found: "This looks right.",
    foundLowConfidence: "Best we could find. Take a look.",
    orderPlaced: "Placed by Broflo. You didn't lift a finger.",
    captcha: (retailer: string) =>
      `${retailer} wants to make sure we're human. (We're not.) Here's a link to finish this yourself.`,
    outOfStock: "Sold out. Happens to the best of us.",
    siteBlocked: (retailer: string) =>
      `${retailer} isn't cooperating today. Some days are like that.`,
    timeout: "This is taking longer than it should. We have standards.",
    priceMismatch: "Heads up -- the price is different from what we estimated.",
    priceLower: "Good news -- it's cheaper than we thought.",
    explainerTitle: "How Broflo Orders Work",
    explainerBody:
      "Some retailers don't have an API, so Broflo uses a browser agent to place the order for you.",
    explainerSteps: [
      "We search the retailer's site for your gift",
      "You review and confirm before we buy",
      "We place the order using your shipping info",
      "Same 2-hour cancel window as any Broflo order",
    ] as readonly string[],
    explainerPaymentNote:
      "Your payment info is never stored by the retailer -- Broflo handles payment separately.",
    explainerCta: "Got It, Find My Gift",
    explainerDismiss: "Don't show this again",
    orderManually: (retailer: string) => `Order on ${retailer}`,
    tryDifferent: "Find Something Else",
    tryAgain: "Try Again",
    continueAtPrice: (price: string) => `Continue at ${price}`,
    agentBadge: "Placed by Broflo Agent",
    agentWorking: "Broflo is placing this order...",
    verifiedDelivery: "Verified by Broflo",
    sessionLogToggle: "View Agent Session Log",
    viewScreenshots: "View All Screenshots",
    creditIssued: (amount: string) =>
      `That didn't work. We've credited ${amount} to your next month as an apology.`,
    creditBannerCta: "View Credit",
  },

  billing: {
    upgradePrompt:
      "You've hit the Free limit. Three people is a lot... for a free tier. Upgrade and we'll remember everyone.",
    upgradeCta: "Unlock the full Broflo",
    proTagline: "For people who actually have people.",
    eliteTagline: "For the person who has everything. Except time.",
    freeTagline: "Dip your toes in. We won't judge. (Much.)",
    checkoutSuccess:
      "Welcome to the inner circle. Your gift game just leveled up.",
    checkoutCanceled:
      "Changed your mind? No hard feelings. The free tier misses you already.",
    portalButton: "Manage Billing",
    currentPlan: "Current Plan",
    paymentFailed:
      "Your payment didn't go through. We've paused your Pro perks until it's sorted.",
    subscriptionCanceled:
      "You've been downgraded to Free. We'll be here when you want to come back.",
    noPlan: "You're on the free tier. Upgrade to unlock everything.",
  },
} as const;
