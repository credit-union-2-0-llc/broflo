export interface Persona {
  name: string;
  relationship: string;
  pronouns: string;
  birthday?: string;
  anniversary?: string;
  budgetMin?: number;
  budgetMax?: number;
  hobbies?: string;
  musicTaste?: string;
  favoriteBrands?: string;
  foodPreferences?: string;
  clothingSizeTop?: string;
  clothingSizeBottom?: string;
  shoeSize?: string;
  allergens?: string[];
  dietaryRestrictions?: string[];
  wishlistUrls?: string;
  notes?: string;
  shippingAddress1?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingZip?: string;
  photoCategory?: string;
  style: "difficult" | "picky" | "normal" | "mom" | "adventure" | "professional" | "traditional" | "teen" | "safe" | "premium";
}

// 8 men, 2 women — covering difficult, picky, normal, mom, adventure, professional, traditional, teen, safe, premium styles

export const PERSONAS: Record<string, Persona> = {
  dad: {
    name: "Robert Drake",
    relationship: "parent",
    pronouns: "he/him",
    birthday: "1962-08-14",
    budgetMin: 50,
    budgetMax: 150,
    hobbies: "Woodworking, fishing, watching football",
    musicTaste: "Classic rock, Eagles, Fleetwood Mac",
    favoriteBrands: "Carhartt, Stanley, DeWalt",
    foodPreferences: "Steak, BBQ, craft beer",
    clothingSizeTop: "XL",
    clothingSizeBottom: "36",
    shoeSize: "11",
    notes: "Has everything. Says he doesn't want anything. Impossible to shop for. Has a full workshop in the garage. Drinks bourbon on weekends. Watches every Oregon Ducks game.",
    shippingAddress1: "742 Siskiyou Blvd",
    shippingCity: "Ashland",
    shippingState: "OR",
    shippingZip: "97520",
    photoCategory: "garage",
    style: "difficult",
  },

  brotherJake: {
    name: "Jake Drake",
    relationship: "sibling",
    pronouns: "he/him",
    birthday: "1994-03-22",
    budgetMin: 75,
    budgetMax: 200,
    hobbies: "Vinyl collecting, coffee roasting, mechanical keyboards",
    musicTaste: "Indie rock, Radiohead, Khruangbin, obscure jazz",
    favoriteBrands: "Analog Wonder, Fellow, Keychron, Chemex",
    foodPreferences: "Single-origin pour-over only, no chain restaurants",
    clothingSizeTop: "M",
    clothingSizeBottom: "32",
    shoeSize: "10",
    allergens: ["gluten"],
    notes: "Extremely particular about everything. Will return gifts he doesn't like. Only drinks single-origin coffee. Has strong opinions about fonts. Will notice if something is mass-produced.",
    shippingAddress1: "1420 NW Flanders St",
    shippingCity: "Portland",
    shippingState: "OR",
    shippingZip: "97209",
    photoCategory: "desk",
    style: "picky",
  },

  bestFriendMike: {
    name: "Mike Tanaka",
    relationship: "friend",
    pronouns: "he/him",
    birthday: "1990-06-10",
    budgetMin: 40,
    budgetMax: 120,
    hobbies: "Rock climbing, backpacking, mountain biking, trail running",
    musicTaste: "Reggae, Jack Johnson, campfire guitar",
    favoriteBrands: "Patagonia, REI, Black Diamond, Osprey",
    foodPreferences: "Trail mix, jerky, anything campfire-cooked",
    clothingSizeTop: "L",
    shoeSize: "11.5",
    dietaryRestrictions: ["vegetarian"],
    notes: "Prefers experiences over things. Has hiked every major trail in Oregon. Planning a PCT thru-hike next year. Doesn't want more stuff cluttering his van.",
    shippingAddress1: "88 Lithia Way",
    shippingCity: "Ashland",
    shippingState: "OR",
    shippingZip: "97520",
    photoCategory: "garage",
    style: "adventure",
  },

  mom: {
    name: "Linda Drake",
    relationship: "parent",
    pronouns: "she/her",
    birthday: "1964-12-03",
    anniversary: "1986-06-21",
    budgetMin: 50,
    budgetMax: 175,
    hobbies: "Gardening, baking, book club, watercolor painting",
    musicTaste: "Joni Mitchell, Carole King, Norah Jones",
    favoriteBrands: "Le Creuset, Anthropologie, Terrain",
    foodPreferences: "Loves French pastries, herbal tea, farmers market everything",
    clothingSizeTop: "M",
    shoeSize: "8",
    notes: "Sentimental about handwritten notes. Cries at thoughtful gifts. Has a massive herb garden. Hosts Sunday dinners. Loves anything that says 'I was thinking of you.'",
    wishlistUrls: "https://www.anthropologie.com/wishlist/abc123",
    shippingAddress1: "742 Siskiyou Blvd",
    shippingCity: "Ashland",
    shippingState: "OR",
    shippingZip: "97520",
    photoCategory: "kitchen",
    style: "mom",
  },

  bossTom: {
    name: "Tom Wexler",
    relationship: "coworker",
    pronouns: "he/him",
    birthday: "1975-11-08",
    budgetMin: 30,
    budgetMax: 75,
    hobbies: "Golf, wine collecting, reading business books",
    musicTaste: "Jazz, Miles Davis",
    favoriteBrands: "Titleist, Moleskine",
    foodPreferences: "Scotch, dark chocolate, aged cheese",
    notes: "VP of Engineering. Keep it professional but thoughtful. No gag gifts. Appreciates quality over flash. Has a corner office with golf memorabilia.",
    shippingAddress1: "500 Terry Francine St",
    shippingCity: "San Francisco",
    shippingState: "CA",
    shippingZip: "94158",
    photoCategory: "desk",
    style: "professional",
  },

  grandpaEarl: {
    name: "Earl Mitchell",
    relationship: "other",
    pronouns: "he/him",
    birthday: "1942-04-17",
    budgetMin: 25,
    budgetMax: 80,
    hobbies: "Chess, fly fishing, reading westerns, whittling",
    musicTaste: "Johnny Cash, Merle Haggard, Hank Williams",
    favoriteBrands: "L.L.Bean, Pendleton",
    foodPreferences: "Black coffee, apple pie, smoked salmon",
    notes: "Doesn't want anything electronic. Still writes letters by hand. Has the same flannel from 1985. Values craftsmanship and things made in the USA.",
    shippingAddress1: "320 Oak St",
    shippingCity: "Medford",
    shippingState: "OR",
    shippingZip: "97501",
    photoCategory: "bookshelf",
    style: "traditional",
  },

  nephewTyler: {
    name: "Tyler Reeves",
    relationship: "other",
    pronouns: "he/him",
    birthday: "2009-09-28",
    budgetMin: 30,
    budgetMax: 100,
    hobbies: "Gaming (Fortnite, Minecraft), skateboarding, collecting sneakers",
    musicTaste: "Travis Scott, Bad Bunny, Playboi Carti",
    favoriteBrands: "Nike, Supreme, PlayStation, Razer",
    foodPreferences: "Pizza, boba tea, Hot Cheetos",
    clothingSizeTop: "S",
    shoeSize: "9",
    notes: "16 years old. Wants whatever is trending on TikTok. Changes interests every 3 months. Currently obsessed with custom mechanical keyboards and anime.",
    shippingAddress1: "1100 E Main St",
    shippingCity: "Medford",
    shippingState: "OR",
    shippingZip: "97504",
    photoCategory: "gaming_music",
    style: "teen",
  },

  fatherInLawRichard: {
    name: "Richard Huang",
    relationship: "other",
    pronouns: "he/him",
    birthday: "1958-02-14",
    budgetMin: 40,
    budgetMax: 100,
    hobbies: "Model trains, gardening",
    foodPreferences: "Chinese tea, dim sum",
    notes: "Don't know him super well. Retired engineer. Quiet guy. Seems to like anything practical. Safe choices preferred.",
    shippingAddress1: "4500 SE Belmont St",
    shippingCity: "Portland",
    shippingState: "OR",
    shippingZip: "97215",
    photoCategory: "desk",
    style: "safe",
  },

  wifeSarah: {
    name: "Sarah Kim-Drake",
    relationship: "partner",
    pronouns: "she/her",
    birthday: "1991-07-19",
    anniversary: "2018-10-06",
    budgetMin: 100,
    budgetMax: 500,
    hobbies: "Interior design, yoga, pottery, wine tasting, travel",
    musicTaste: "Bon Iver, Phoebe Bridgers, Japanese Breakfast, lo-fi beats",
    favoriteBrands: "Aesop, Le Labo, Mejuri, Celine, Diptyque",
    foodPreferences: "Omakase, natural wine, artisan cheese, croissants",
    clothingSizeTop: "S",
    clothingSizeBottom: "26",
    shoeSize: "7",
    allergens: ["shellfish"],
    notes: "Very discerning taste. Researches everything before buying. Prefers quality over quantity. Loves experiences — pottery classes, spa days, cooking courses. Has a curated bookshelf organized by color. Will know if you got something generic.",
    wishlistUrls: "https://www.mejuri.com/wishlist/sarah2026",
    shippingAddress1: "742 Siskiyou Blvd",
    shippingCity: "Ashland",
    shippingState: "OR",
    shippingZip: "97520",
    photoCategory: "bookshelf",
    style: "premium",
  },

  buddyChris: {
    name: "Chris Donovan",
    relationship: "friend",
    pronouns: "he/him",
    birthday: "1990-01-15",
    budgetMin: 25,
    budgetMax: 75,
    hobbies: "Fantasy football, grilling, watching Marvel movies",
    musicTaste: "Classic rock, pop punk, 2000s hip hop",
    favoriteBrands: "Yeti, Weber, Nike",
    foodPreferences: "Wings, burgers, IPAs",
    clothingSizeTop: "L",
    shoeSize: "11",
    notes: "Easy-going. Likes anything related to grilling, sports, or beer. Not picky at all. Classic bro gift recipient.",
    shippingAddress1: "225 Pioneer St",
    shippingCity: "Ashland",
    shippingState: "OR",
    shippingZip: "97520",
    photoCategory: "bar_cart",
    style: "normal",
  },
};

// Use makeTestUser(label) from helpers/auth.ts for per-describe unique users
