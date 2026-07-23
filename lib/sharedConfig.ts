// Shared configuration values used across the artist profile wizard
// (create-profile.tsx), the enquiry form (EnquiryModal.tsx), the
// client-preferences wizard, and the artist-discovery page — one canonical
// vocabulary so category/event-type/language matching (lib/artistMatch.ts)
// compares like with like instead of silently failing on wording
// differences (e.g. "Anchor / Emcee" vs "Anchor or Emcee").
//
// ART_FORMS is the source of truth for artist categories: its keys are what
// an artist can select as their primary category (ARTIST_CATEGORIES below
// is just those keys, so a client filtering by category is always choosing
// from the same set an artist actually has), and each value is that
// category's list of specializations/sub-forms.
export const ART_FORMS: Record<string, string[]> = {
  Musician: ["Guitarist","Bassist","Drummer","Pianist / Keyboardist","Violinist","Flutist","Tabla Player","Sitar Player","Harmonium Player","Trumpet / Brass Player","Saxophone Player","Percussionist","Sarangi Player","Mandolin Player","Veena Player","Mridangam Player","Shehnai Player","Santoor Player"],
  Singer: ["Hindustani Classical Vocalist","Carnatic Classical Vocalist","Semi-Classical Singer","Ghazal Singer","Bollywood Singer","Pop Singer","Folk Singer","Devotional / Bhajan Singer","Jazz Singer","R&B / Soul Singer","Rock Singer","Sufi Singer","Qawwali Singer","Indie Singer-Songwriter"],
  Dancer: ["Bharatanatyam","Kathak","Odissi","Kuchipudi","Manipuri","Mohiniyattam","Sattriya","Classical Ballet","Contemporary","Hip Hop / B-boy","Salsa / Latin","Bollywood Dance","Folk Dance","Flamenco","Tap Dance","Jazz Dance","Freestyle"],
  "Actor / Theatre": ["Theatre Actor","Street Theatre","Mime Artist","Film Actor","TV / OTT Actor","Puppeteer","Physical Theatre"],
  Comedian: ["Stand-up Comedy","Sketch Comedy","Improv Comedy","Roast Comedy","Ventriloquism"],
  Magician: ["Stage Magician","Close-up Magician","Mentalist","Illusionist","Card Magician"],
  DJ: ["Bollywood DJ","EDM DJ","Hip Hop DJ","House DJ","Techno / Trance DJ","Retro / Old School DJ"],
  "Anchor / Emcee": ["Wedding Anchor","Corporate Emcee","Event Host","Radio Jockey","Motivational Speaker"],
  "Visual Artist": ["Painter","Sculptor","Digital Artist","Street / Mural Artist","Sketch Artist","Caricature Artist","Calligrapher","Folk / Warli Art"],
  "Spoken Word / Poetry": ["Spoken Word Artist","Poet","Storyteller / Kathakar","Slam Poet"],
  "Circus / Acrobat": ["Acrobat","Fire Artist","Juggler","Aerial Artist","Tightrope Walker","Contortionist"],
  Photographer: ["Wedding Photographer","Portrait Photographer","Event Photographer","Fine Art Photographer"],
};

export const ARTIST_CATEGORIES = Object.keys(ART_FORMS);

// Canonical event types — what an artist actually stores on their profile
// and what the enquiry form offers, so a client's stated event-type
// preference can match real artist data.
export const EVENT_TYPES = ["Wedding","Corporate Event","Birthday Party","Concert / Live Show","College Fest","Private Party","Festival","Cultural Program","Religious Event","Online / Virtual Event","Kids Event","Music Video / Album","Other"];

export const LANGUAGES = ["Hindi","English","Bengali","Tamil","Telugu","Marathi","Gujarati","Kannada","Malayalam","Punjabi","Odia","Urdu","Sanskrit","Bhojpuri","Rajasthani"];

export const BUDGET_RANGES = [
  { label: "Under ₹5,000", min: 0, max: 5000 },
  { label: "₹5,000–₹15,000", min: 5000, max: 15000 },
  { label: "₹15,000–₹30,000", min: 15000, max: 30000 },
  { label: "₹30,000–₹50,000", min: 30000, max: 50000 },
  { label: "₹50,000+", min: 50000, max: null },
];

export const PERFORMANCE_MODES = ["Online", "Offline", "Either"];
export const GROUP_TYPE_OPTIONS = ["Solo", "Group", "Either"];
export const EXPERIENCE_PREFERENCES = ["Any", "Beginner-friendly", "Experienced (3+ years)", "Highly experienced (6+ years)"];

// Canonical state -> city list. Previously duplicated (with a much shorter,
// inconsistent city list) across create-profile.tsx, client-onboarding.tsx,
// and client-preferences.tsx — consolidated here so an artist's registered
// city is always selectable as a client search filter, and so city-landing
// pages (Phase 9) have one authoritative source of valid cities.
export const INDIA_STATES: Record<string, string[]> = {
  "Andhra Pradesh": ["Vijayawada","Visakhapatnam","Guntur","Nellore","Tirupati","Kurnool","Rajahmundry","Kakinada","Eluru","Ongole"],
  "Assam": ["Guwahati","Silchar","Dibrugarh","Jorhat","Tezpur","Tinsukia","Nagaon"],
  "Bihar": ["Patna","Gaya","Bhagalpur","Muzaffarpur","Purnia","Darbhanga","Arrah"],
  "Chhattisgarh": ["Raipur","Bhilai","Korba","Bilaspur","Durg","Rajnandgaon"],
  "Delhi": ["Central Delhi","East Delhi","New Delhi","North Delhi","North East Delhi","North West Delhi","Shahdara","South Delhi","South East Delhi","South West Delhi","West Delhi"],
  "Goa": ["Panaji","Margao","Vasco da Gama","Mapusa","Ponda"],
  "Gujarat": ["Ahmedabad","Surat","Vadodara","Rajkot","Bhavnagar","Jamnagar","Gandhinagar","Anand","Junagadh","Bharuch"],
  "Haryana": ["Gurugram","Faridabad","Rohtak","Hisar","Panipat","Karnal","Ambala","Yamunanagar","Sonipat","Bhiwani"],
  "Himachal Pradesh": ["Shimla","Manali","Dharamsala","Solan","Kullu","Mandi","Palampur"],
  "Jharkhand": ["Ranchi","Jamshedpur","Dhanbad","Bokaro","Hazaribag","Deoghar"],
  "Karnataka": ["Bengaluru","Mysuru","Hubballi","Mangaluru","Belagavi","Davanagere","Ballari","Tumkur","Shivamogga","Vijayapura"],
  "Kerala": ["Kochi","Thiruvananthapuram","Kozhikode","Thrissur","Kannur","Kollam","Palakkad","Alappuzha","Malappuram","Kottayam"],
  "Madhya Pradesh": ["Bhopal","Indore","Gwalior","Jabalpur","Ujjain","Ratlam","Sagar","Satna","Dewas","Rewa"],
  "Maharashtra": ["Mumbai","Pune","Nagpur","Nashik","Thane","Aurangabad","Solapur","Kolhapur","Navi Mumbai","Pimpri-Chinchwad","Amravati","Nanded"],
  "Manipur": ["Imphal","Thoubal","Bishnupur","Churachandpur"],
  "Meghalaya": ["Shillong","Tura","Jowai"],
  "Mizoram": ["Aizawl","Lunglei","Champhai"],
  "Nagaland": ["Dimapur","Kohima","Mokokchung"],
  "Odisha": ["Bhubaneswar","Cuttack","Rourkela","Puri","Sambalpur","Berhampur","Brahmapur"],
  "Punjab": ["Ludhiana","Amritsar","Jalandhar","Patiala","Chandigarh","Mohali","Bathinda","Hoshiarpur"],
  "Rajasthan": ["Jaipur","Jodhpur","Udaipur","Ajmer","Bikaner","Kota","Alwar","Bharatpur","Sikar","Pali"],
  "Sikkim": ["Gangtok","Namchi","Mangan"],
  "Tamil Nadu": ["Chennai","Coimbatore","Madurai","Tiruchirappalli","Salem","Tiruppur","Erode","Tirunelveli","Vellore","Thoothukudi"],
  "Telangana": ["Hyderabad","Warangal","Nizamabad","Karimnagar","Khammam","Secunderabad","Ramagundam","Nalgonda"],
  "Tripura": ["Agartala","Udaipur","Dharmanagar"],
  "Uttar Pradesh": ["Lucknow","Agra","Varanasi","Kanpur","Prayagraj","Meerut","Noida","Ghaziabad","Mathura","Bareilly","Jhansi","Aligarh","Moradabad","Gorakhpur"],
  "Uttarakhand": ["Dehradun","Haridwar","Roorkee","Rishikesh","Nainital","Haldwani","Rudrapur"],
  "West Bengal": ["Kolkata","Howrah","Asansol","Siliguri","Durgapur","Bardhaman","Malda","Kharagpur"],
  "Jammu & Kashmir": ["Srinagar","Jammu","Leh","Anantnag","Sopore"],
  "Arunachal Pradesh": ["Itanagar","Naharlagun","Pasighat"],
  "Andaman & Nicobar": ["Port Blair"],
  "Chandigarh": ["Chandigarh"],
  "Puducherry": ["Puducherry","Karaikal","Yanam"],
};

export const ALL_CITIES = Array.from(new Set(Object.values(INDIA_STATES).flat())).sort();
