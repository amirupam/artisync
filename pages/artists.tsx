import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { firebase } from "@/lib/firebaseClient";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

// ─── Data ────────────────────────────────────────────────────────────────────

const ART_FORMS = [
  "Musician","Singer","Dancer","Actor / Theatre","Comedian","Magician",
  "DJ","Anchor / Emcee","Visual Artist","Spoken Word / Poetry","Circus / Acrobat","Photographer",
];

const INDIA_STATES: Record<string, string[]> = {
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

const PRICE_OPTIONS = [
  { label: "Any price", value: "" },
  { label: "Under ₹5,000", value: "5000" },
  { label: "Under ₹10,000", value: "10000" },
  { label: "Under ₹25,000", value: "25000" },
  { label: "Under ₹50,000", value: "50000" },
];

// ─── Types ───────────────────────────────────────────────────────────────────

type ArtistDoc = {
  fullName?: string;
  profilePictureUrl?: string;
  coverBannerUrl?: string;
  artForm?: string;
  artSubForms?: string[];
  bio?: string;
  state?: string;
  city?: string;
  area?: string;
  priceRange?: string;
  experience?: string;
  languages?: string[];
  eventTypes?: string[];
};

type ArtistEntry = { id: string; data: ArtistDoc };

// ─── Search scoring ──────────────────────────────────────────────────────────

function scoreArtist(data: ArtistDoc, tokens: string[]): number {
  if (!tokens.length) return 1;
  let score = 0;
  for (const t of tokens) {
    if (data.artForm?.toLowerCase().includes(t)) score += 10;
    for (const s of data.artSubForms ?? []) if (s.toLowerCase().includes(t)) score += 8;
    for (const l of data.languages ?? []) if (l.toLowerCase().includes(t)) score += 6;
    if (data.fullName?.toLowerCase().includes(t)) score += 5;
    for (const e of data.eventTypes ?? []) if (e.toLowerCase().includes(t)) score += 4;
    if (data.city?.toLowerCase().includes(t)) score += 4;
    if (data.state?.toLowerCase().includes(t)) score += 3;
    if (data.area?.toLowerCase().includes(t)) score += 2;
    if (data.bio?.toLowerCase().includes(t)) score += 1;
  }
  return score;
}

// ─── ArtistCard ──────────────────────────────────────────────────────────────

function ArtistCard({ id, data }: { id: string; data: ArtistDoc }) {
  const locationParts = [data.city, data.state].filter(Boolean);
  return (
    <Link href={`/artist/${id}`} className="block group">
      <div className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-visible">
        {/* Cover */}
        <div className="relative h-28 rounded-t-2xl overflow-hidden bg-gradient-to-br from-violet-900 to-indigo-800">
          {data.coverBannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.coverBannerUrl}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          )}
          {data.profilePictureUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.profilePictureUrl}
              alt={data.fullName ?? ""}
              className="absolute bottom-0 left-4 translate-y-1/2 z-10 w-14 h-14 rounded-full border-[3px] border-white object-cover shadow-lg"
            />
          )}
        </div>
        {/* Info */}
        <div className={`px-4 pb-4 ${data.profilePictureUrl ? "pt-10" : "pt-3"}`}>
          {data.artForm && (
            <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">{data.artForm}</span>
          )}
          <h3 className="font-black text-gray-900 text-base leading-tight mt-0.5 truncate">
            {data.fullName || "Artist"}
          </h3>
          {data.artSubForms?.length ? (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{data.artSubForms.slice(0, 2).join(" · ")}</p>
          ) : null}
          <div className="flex items-center justify-between mt-2 gap-1">
            {locationParts.length ? (
              <span className="text-xs text-gray-400 flex items-center gap-1 min-w-0 truncate">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <span className="truncate">{locationParts.join(", ")}</span>
              </span>
            ) : <span />}
            {data.priceRange && (
              <span className="text-xs font-black text-violet-700 flex-shrink-0">₹{data.priceRange}</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ArtistsPage() {
  const router = useRouter();
  const [artists, setArtists] = useState<ArtistEntry[]>([]);
  const [loadingArtists, setLoadingArtists] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [search, setSearch] = useState("");
  const [filterArtForm, setFilterArtForm] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterMaxPrice, setFilterMaxPrice] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(firebase.auth, (u) => setIsLoggedIn(!!u));
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(firebase.db, "artists")).then((snap) => {
      const entries: ArtistEntry[] = [];
      snap.forEach((d) => entries.push({ id: d.id, data: d.data() as ArtistDoc }));
      setArtists(entries);
      setLoadingArtists(false);
    });
  }, []);

  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const displayed = artists
    .map((e) => ({ ...e, score: scoreArtist(e.data, tokens) }))
    .filter((e) => {
      if (tokens.length && e.score === 0) return false;
      if (filterArtForm && e.data.artForm !== filterArtForm) return false;
      if (filterState && e.data.state !== filterState) return false;
      if (filterCity && e.data.city !== filterCity) return false;
      if (filterMaxPrice) {
        const p = parseInt(e.data.priceRange ?? "0");
        if (isNaN(p) || p > parseInt(filterMaxPrice)) return false;
      }
      return true;
    })
    .sort((a, b) => b.score - a.score);

  const cities = filterState ? (INDIA_STATES[filterState] ?? []) : [];
  const hasFilters = !!(filterArtForm || filterState || filterCity || filterMaxPrice || search);

  function clearFilters() {
    setFilterArtForm("");
    setFilterState("");
    setFilterCity("");
    setFilterMaxPrice("");
    setSearch("");
  }

  return (
    <div className="min-h-screen bg-[#f7f3ee]">
      {/* ── Navbar ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/" className="flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_2.png" alt="ArtInYou" className="h-8 w-auto object-contain" />
          </Link>
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='Search "bengali rock singer", "wedding dance"...'
              className="w-full h-9 px-4 bg-gray-100 rounded-xl text-sm text-gray-900 placeholder-gray-400 border-0 focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </div>
          {isLoggedIn ? (
            <button
              onClick={() => firebase.auth.signOut().then(() => router.replace("/"))}
              className="flex-shrink-0 text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors"
            >
              Sign out
            </button>
          ) : (
            <Link
              href={{ pathname: "/signup", query: { role: "client" } }}
              className="flex-shrink-0 text-xs font-semibold px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-all whitespace-nowrap"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-violet-950 via-indigo-900 to-slate-900 px-4 py-14 text-center">
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-none">
          Discover Artists
        </h1>
        <p className="mt-3 text-violet-300 text-sm sm:text-base max-w-md mx-auto">
          Browse performers for weddings, events & more · search by style, language, or city
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="max-w-7xl mx-auto px-4 py-4 border-b border-gray-200">
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={filterArtForm}
            onChange={(e) => setFilterArtForm(e.target.value)}
            className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
          >
            <option value="">All art forms</option>
            {ART_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>

          <select
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setFilterCity(""); }}
            className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
          >
            <option value="">All states</option>
            {Object.keys(INDIA_STATES).sort().map((s) => <option key={s} value={s}>{s}</option>)}
          </select>

          {filterState && cities.length > 0 && (
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
            >
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          <select
            value={filterMaxPrice}
            onChange={(e) => setFilterMaxPrice(e.target.value)}
            className="h-9 px-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-400 cursor-pointer"
          >
            {PRICE_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="h-9 px-3 text-xs font-semibold text-gray-500 hover:text-gray-900 border border-gray-200 rounded-xl bg-white transition-all"
            >
              Clear all ×
            </button>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {loadingArtists
            ? "Loading artists..."
            : `${displayed.length} artist${displayed.length !== 1 ? "s" : ""} found`}
        </p>
      </div>

      {/* ── Grid ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 pb-16">
        {loadingArtists ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-2xl font-black text-gray-300">No artists found</p>
            <p className="text-gray-400 text-sm mt-2">Try a different search or clear some filters</p>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="mt-6 px-6 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-500 transition-all"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {displayed.map((e) => (
              <ArtistCard key={e.id} id={e.id} data={e.data} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
