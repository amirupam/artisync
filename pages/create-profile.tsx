import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { firebase } from "@/lib/firebaseClient";
import { doc, serverTimestamp, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// ─── Data ───────────────────────────────────────────────────────────────────

const ART_FORMS: Record<string, string[]> = {
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

const EVENT_TYPES = ["Wedding","Corporate Event","Birthday Party","Concert / Live Show","College Fest","Private Party","Festival","Cultural Program","Religious Event","Online / Virtual Event","Kids Event","Music Video / Album"];
const LANGUAGES = ["Hindi","English","Bengali","Tamil","Telugu","Marathi","Gujarati","Kannada","Malayalam","Punjabi","Odia","Urdu","Sanskrit","Bhojpuri","Rajasthani"];
const EXPERIENCE_OPTIONS = ["Less than 1 year","1–2 years","3–5 years","6–10 years","More than 10 years"];

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function MultiChip({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button key={opt} type="button"
          onClick={() => onChange(selected.includes(opt) ? selected.filter((x) => x !== opt) : [...selected, opt])}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
            selected.includes(opt) ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-300 hover:border-gray-600"
          }`}>
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ArtistProfile = {
  fullName: string;
  profilePicture: File | null;
  profilePictureUrl: string;
  coverBanner: File | null;
  coverBannerUrl: string;
  artForm: string;
  artSubForms: string[];
  bio: string;
  state: string;
  city: string;
  area: string;
  country: string;
  youtubeVideos: string[];
  youtubeVideoCaptions: string[];
  phone: string;
  email: string;
  instagram: string;
  facebook: string;
  youtube: string;
  experience: string;
  languages: string[];
  eventTypes: string[];
  priceRange: string;
  performanceImageUrls: string[];
  performanceImageCaptions: string[];
  createdAt: unknown;
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreateProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [newPerformanceFiles, setNewPerformanceFiles] = useState<File[]>([]);
  const [performancePreviews, setPerformancePreviews] = useState<string[]>([]);
  const [newPerformanceCaptions, setNewPerformanceCaptions] = useState<string[]>([]);
  const perfInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ArtistProfile>({
    fullName: "", profilePicture: null, profilePictureUrl: "",
    coverBanner: null, coverBannerUrl: "",
    artForm: "", artSubForms: [], bio: "",
    state: "", city: "", area: "", country: "India",
    youtubeVideos: [""],
    youtubeVideoCaptions: [""],
    phone: "", email: "", instagram: "", facebook: "", youtube: "",
    experience: "", languages: [], eventTypes: [], priceRange: "",
    performanceImageUrls: [], performanceImageCaptions: [], createdAt: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(firebase.auth, async (u) => {
      if (!u) { router.replace({ pathname: "/signup", query: { role: "artist" } }); return; }
      setUserId(u.uid);
      setForm((p) => ({ ...p, email: u.email ?? p.email }));
      try {
        const snap = await getDoc(doc(firebase.db, "artists", u.uid));
        if (snap.exists()) {
          const d = snap.data();
          setForm((p) => ({
            ...p,
            fullName: d.fullName ?? "", profilePictureUrl: d.profilePictureUrl ?? "",
            coverBannerUrl: d.coverBannerUrl ?? "", artForm: d.artForm ?? "",
            artSubForms: d.artSubForms ?? [], bio: d.bio ?? "",
            state: d.state ?? "", city: d.city ?? "", area: d.area ?? "",
            country: d.country ?? "India",
            youtubeVideos: d.youtubeVideos?.length ? d.youtubeVideos : d.youtubeVideo ? [d.youtubeVideo] : [""],
            youtubeVideoCaptions: (() => {
              const vids: string[] = d.youtubeVideos?.length ? d.youtubeVideos : d.youtubeVideo ? [d.youtubeVideo] : [""];
              const caps: string[] = d.youtubeVideoCaptions ?? [];
              return vids.map((_: string, i: number) => caps[i] ?? "");
            })(),
            phone: d.phone ?? "", email: d.email ?? p.email,
            instagram: d.instagram ?? "", facebook: d.facebook ?? "", youtube: d.youtube ?? "",
            experience: d.experience ?? "", languages: d.languages ?? [],
            eventTypes: d.eventTypes ?? [], priceRange: d.priceRange ?? "",
            performanceImageUrls: d.performanceImageUrls ?? [],
            performanceImageCaptions: d.performanceImageCaptions ?? [],
          }));
          setProfileSaved(true);
        }
      } catch {}
    });
    return () => unsub();
  }, [router]);

  function update<K extends keyof ArtistProfile>(key: K, value: ArtistProfile[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadFile(file: File, path: string): Promise<string> {
    const snap = await uploadBytes(ref(firebase.storage, path), file);
    return getDownloadURL(snap.ref);
  }

  function handlePerfImagesAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = 12 - form.performanceImageUrls.length - newPerformanceFiles.length;
    const toAdd = files.slice(0, remaining);
    setNewPerformanceFiles((p) => [...p, ...toAdd]);
    setPerformancePreviews((p) => [...p, ...toAdd.map((f) => URL.createObjectURL(f))]);
    setNewPerformanceCaptions((p) => [...p, ...toAdd.map(() => "")]);
    e.target.value = "";
  }

  function removeExistingImage(idx: number) {
    update("performanceImageUrls", form.performanceImageUrls.filter((_, i) => i !== idx));
    update("performanceImageCaptions", form.performanceImageCaptions.filter((_, i) => i !== idx));
  }

  function removeNewImage(idx: number) {
    URL.revokeObjectURL(performancePreviews[idx]);
    setNewPerformanceFiles((p) => p.filter((_, i) => i !== idx));
    setPerformancePreviews((p) => p.filter((_, i) => i !== idx));
    setNewPerformanceCaptions((p) => p.filter((_, i) => i !== idx));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setLoading(true); setError(null); setSaveSuccess(false);
    try {
      let profilePictureUrl = form.profilePictureUrl;
      let coverBannerUrl = form.coverBannerUrl;
      if (form.profilePicture) profilePictureUrl = await uploadFile(form.profilePicture, `artists/${userId}/profile_${Date.now()}.${form.profilePicture.name.split(".").pop()}`);
      if (form.coverBanner) coverBannerUrl = await uploadFile(form.coverBanner, `artists/${userId}/banner_${Date.now()}.${form.coverBanner.name.split(".").pop()}`);

      const newImageUrls = await Promise.all(
        newPerformanceFiles.map((f, i) => uploadFile(f, `artists/${userId}/perf_${Date.now()}_${i}.${f.name.split(".").pop()}`))
      );
      const allPerformanceUrls = [...form.performanceImageUrls, ...newImageUrls];
      const allPerformanceCaptions = [...form.performanceImageCaptions, ...newPerformanceCaptions];

      // Filter captions to match valid (non-empty) youtube videos
      const filteredVideos = form.youtubeVideos.filter((v) => v.trim());
      const filteredVideoCaptions = form.youtubeVideos
        .map((v, i) => ({ keep: !!v.trim(), cap: form.youtubeVideoCaptions[i] ?? "" }))
        .filter((x) => x.keep)
        .map((x) => x.cap);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {
        fullName: form.fullName, profilePictureUrl, coverBannerUrl,
        artForm: form.artForm, artSubForms: form.artSubForms, bio: form.bio,
        state: form.state, city: form.city, area: form.area, country: form.country,
        youtubeVideos: filteredVideos,
        youtubeVideoCaptions: filteredVideoCaptions,
        phone: form.phone, email: form.email,
        instagram: form.instagram, facebook: form.facebook, youtube: form.youtube,
        experience: form.experience, languages: form.languages,
        eventTypes: form.eventTypes, priceRange: form.priceRange,
        performanceImageUrls: allPerformanceUrls,
        performanceImageCaptions: allPerformanceCaptions,
        updatedAt: serverTimestamp(),
      };
      if (!profileSaved) data.createdAt = serverTimestamp();
      await setDoc(doc(firebase.db, "artists", userId), data);

      update("performanceImageUrls", allPerformanceUrls);
      update("performanceImageCaptions", allPerformanceCaptions);
      setNewPerformanceFiles([]); setPerformancePreviews([]); setNewPerformanceCaptions([]);
      setProfileSaved(true); setSaveSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setLoading(false);
    }
  }

  const subForms = ART_FORMS[form.artForm] ?? [];
  const stateCities = form.state ? (INDIA_STATES[form.state] ?? []) : [];
  const allPerformancePreviews = [...form.performanceImageUrls, ...performancePreviews];
  const totalImages = allPerformancePreviews.length;

  return (
    <div className="min-h-screen bg-[#f8f8f6]">
      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 bg-white/90 backdrop-blur-md border-b border-gray-100 z-50 h-14">
        <div className="h-full px-5 flex items-center justify-between">
          <img src="/logo_2.png" alt="ArtInYou" className="h-9 w-auto object-contain" />
          <button onClick={() => router.push("/profile-preview")} disabled={!profileSaved}
            className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${profileSaved ? "bg-gray-900 text-white hover:bg-gray-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
            Preview Profile
          </button>
        </div>
      </nav>

      <form onSubmit={submit} className="pt-14">

        {/* ── Cover photo — full width ── */}
        <div className="relative h-56 sm:h-72 lg:h-80 bg-gradient-to-br from-slate-700 to-slate-900 overflow-hidden">
          {(form.coverBanner || form.coverBannerUrl) && (
            <img src={form.coverBanner ? URL.createObjectURL(form.coverBanner) : form.coverBannerUrl}
              alt="Cover" className="w-full h-full object-cover" />
          )}
          {!form.coverBanner && !form.coverBannerUrl && (
            <div className="absolute inset-0 flex items-end p-6">
              <p className="text-white/40 text-sm">Click to add a cover photo that shows your performance or artistry</p>
            </div>
          )}
          <input type="file" accept="image/*" id="cover-input" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) update("coverBanner", f); }} />
          <label htmlFor="cover-input"
            className="absolute top-4 right-4 bg-black/40 hover:bg-black/60 text-white text-xs px-3 py-2 rounded-full cursor-pointer backdrop-blur-sm transition-all border border-white/10">
            {form.coverBanner || form.coverBannerUrl ? "Change cover" : "+ Add cover photo"}
          </label>
        </div>

        {/* ── Profile picture ── */}
        <div className="relative px-6 lg:px-10">
          <div className="absolute -top-14 left-6 lg:left-10">
            <div className="w-28 h-28 rounded-2xl border-4 border-white bg-gray-100 overflow-hidden shadow-xl">
              {(form.profilePicture || form.profilePictureUrl) ? (
                <img src={form.profilePicture ? URL.createObjectURL(form.profilePicture) : form.profilePictureUrl}
                  alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" id="pic-input" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) update("profilePicture", f); }} />
            <label htmlFor="pic-input"
              className="absolute -bottom-1 -right-1 w-7 h-7 bg-gray-900 text-white rounded-full flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors shadow">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </label>
          </div>
        </div>

        {/* ── Form content ── */}
        <div className="mt-20 px-6 lg:px-10 pb-24 space-y-12 max-w-4xl">

          {/* Name */}
          <input type="text" required placeholder="Your full name"
            value={form.fullName} onChange={(e) => update("fullName", e.target.value)}
            className="w-full text-3xl sm:text-4xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder-gray-300" />

          {/* ── Art Form ── */}
          <section>
            <SectionLabel>Art Form</SectionLabel>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {Object.keys(ART_FORMS).map((af) => (
                <button key={af} type="button"
                  onClick={() => { update("artForm", af); update("artSubForms", []); }}
                  className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-medium border text-center transition-all leading-tight ${
                    form.artForm === af ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:border-gray-500"
                  }`}>
                  {af}
                </button>
              ))}
            </div>
            {subForms.length > 0 && (
              <div className="mt-5">
                <p className="text-sm text-gray-500 mb-3">Select your specialisation(s)</p>
                <MultiChip options={subForms} selected={form.artSubForms} onChange={(v) => update("artSubForms", v)} />
              </div>
            )}
          </section>

          {/* ── Bio ── */}
          <section>
            <SectionLabel>About You</SectionLabel>
            <textarea placeholder="Describe your style, experience and what makes you unique as an artist…"
              value={form.bio} onChange={(e) => update("bio", e.target.value)} rows={4}
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent resize-none transition-all" />
          </section>

          {/* ── Performance Photos ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel className="mb-0">Performance Photos</SectionLabel>
              <span className="text-xs text-gray-400">{totalImages}/12</span>
            </div>
            <input ref={perfInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePerfImagesAdd} />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {/* Existing saved images */}
              {form.performanceImageUrls.map((url, i) => (
                <div key={`saved-${i}`} className="flex flex-col gap-1.5 group">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removeExistingImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <input type="text" placeholder="Caption (optional)"
                    value={form.performanceImageCaptions[i] ?? ""}
                    onChange={(e) => {
                      const caps = [...form.performanceImageCaptions];
                      caps[i] = e.target.value;
                      update("performanceImageCaptions", caps);
                    }}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              ))}
              {/* New unsaved images */}
              {performancePreviews.map((src, i) => (
                <div key={`new-${i}`} className="flex flex-col gap-1.5 group">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-blue-500/10 flex items-end justify-center pb-1">
                      <span className="text-[10px] text-white bg-blue-500/70 px-1.5 py-0.5 rounded">unsaved</span>
                    </div>
                    <button type="button" onClick={() => removeNewImage(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <input type="text" placeholder="Caption (optional)"
                    value={newPerformanceCaptions[i] ?? ""}
                    onChange={(e) => {
                      const caps = [...newPerformanceCaptions];
                      caps[i] = e.target.value;
                      setNewPerformanceCaptions(caps);
                    }}
                    className="w-full text-xs bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                </div>
              ))}
              {/* Add button */}
              {totalImages < 12 && (
                <button type="button" onClick={() => perfInputRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-600 transition-all bg-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="text-[10px]">Add</span>
                </button>
              )}
            </div>
          </section>

          {/* ── Performance Details ── */}
          <section>
            <SectionLabel>Performance Details</SectionLabel>
            <div className="space-y-6">
              <div>
                <Label>Events you perform at</Label>
                <MultiChip options={EVENT_TYPES} selected={form.eventTypes} onChange={(v) => update("eventTypes", v)} />
              </div>
              <div>
                <Label>Languages you perform in</Label>
                <MultiChip options={LANGUAGES} selected={form.languages} onChange={(v) => update("languages", v)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>Years of experience</Label>
                  <select value={form.experience} onChange={(e) => update("experience", e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                    <option value="">Select</option>
                    {EXPERIENCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <Label>Starting price (₹)</Label>
                  <input type="text" placeholder="e.g. 5,000 or 5,000–15,000"
                    value={form.priceRange} onChange={(e) => update("priceRange", e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent" />
                </div>
              </div>
            </div>
          </section>

          {/* ── YouTube Videos ── */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <SectionLabel className="mb-0">Your Videos</SectionLabel>
              {form.youtubeVideos.length < 6 && (
                <button type="button" onClick={() => {
                  update("youtubeVideos", [...form.youtubeVideos, ""]);
                  update("youtubeVideoCaptions", [...form.youtubeVideoCaptions, ""]);
                }} className="text-sm text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add video
                </button>
              )}
            </div>

            {/* Video thumbnails row (quick visual overview) */}
            {form.youtubeVideos.some(getYouTubeId) && (
              <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
                {form.youtubeVideos.map((url, i) => {
                  const vid = getYouTubeId(url);
                  if (!vid) return null;
                  return (
                    <div key={i} className="flex-shrink-0 w-28 h-16 rounded-lg overflow-hidden relative bg-black">
                      <img src={`https://img.youtube.com/vi/${vid}/mqdefault.jpg`} alt="" className="w-full h-full object-cover opacity-90" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                          <svg className="w-3 h-3 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                      <span className="absolute bottom-1 left-1 text-[9px] text-white bg-black/50 px-1 rounded">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3">
              {form.youtubeVideos.map((url, i) => {
                const vid = getYouTubeId(url);
                return (
                  <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                      </svg>
                      <input type="url" placeholder={`Video ${i + 1} — paste YouTube link`} value={url}
                        onChange={(e) => { const v = [...form.youtubeVideos]; v[i] = e.target.value; update("youtubeVideos", v); }}
                        className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-transparent border-none outline-none" />
                      {vid && <span className="text-xs text-green-500 font-medium flex-shrink-0">✓ valid</span>}
                      {!vid && url && <span className="text-xs text-red-400 flex-shrink-0">invalid</span>}
                      {form.youtubeVideos.length > 1 && (
                        <button type="button" onClick={() => {
                          update("youtubeVideos", form.youtubeVideos.filter((_, j) => j !== i));
                          update("youtubeVideoCaptions", form.youtubeVideoCaptions.filter((_, j) => j !== i));
                        }} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="px-4 pb-3 border-t border-gray-100 pt-2">
                      <input type="text" placeholder="Caption for this video (optional)"
                        value={form.youtubeVideoCaptions[i] ?? ""}
                        onChange={(e) => { const v = [...form.youtubeVideoCaptions]; v[i] = e.target.value; update("youtubeVideoCaptions", v); }}
                        className="w-full text-xs bg-gray-50 border border-gray-100 rounded-lg px-3 py-1.5 text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-400" />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Location ── */}
          <section>
            <SectionLabel>Location</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* State */}
              <div>
                <Label>State</Label>
                <select value={form.state}
                  onChange={(e) => { update("state", e.target.value); update("city", ""); }}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                  <option value="">Select state</option>
                  {Object.keys(INDIA_STATES).sort().map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* City */}
              <div>
                <Label>City</Label>
                {stateCities.length > 0 ? (
                  <select value={form.city} onChange={(e) => update("city", e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent">
                    <option value="">Select city</option>
                    {stateCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input type="text" placeholder="Enter your city" value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent" />
                )}
              </div>
              {/* Locality */}
              <div className="sm:col-span-2">
                <Label>Locality / Area <span className="text-gray-400 font-normal">(optional)</span></Label>
                <input type="text" placeholder="e.g. Bandra, Koramangala, Salt Lake…"
                  value={form.area} onChange={(e) => update("area", e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent" />
              </div>
            </div>
          </section>

          {/* ── Contact & Social ── */}
          <section>
            <SectionLabel>Contact & Social</SectionLabel>
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input type="tel" placeholder="Phone number" required value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent" />
                <input type="email" placeholder="Email address" required value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent" />
              </div>
              {[
                { placeholder: "Instagram profile URL", value: form.instagram, key: "instagram" as const },
                { placeholder: "Facebook profile URL", value: form.facebook, key: "facebook" as const },
                { placeholder: "YouTube channel URL", value: form.youtube, key: "youtube" as const },
              ].map(({ placeholder, value, key }) => (
                <input key={key} type="url" placeholder={placeholder} value={value}
                  onChange={(e) => update(key, e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-800 focus:border-transparent" />
              ))}
            </div>
          </section>

          {/* Status */}
          {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
          {saveSuccess && <p className="text-sm text-green-600 bg-green-50 border border-green-100 rounded-xl px-4 py-3">Profile saved! Click &quot;Preview Profile&quot; in the top bar to see how it looks.</p>}

          {/* Save */}
          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={loading}
              className="px-8 py-3 bg-gray-900 text-white rounded-xl font-medium text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {loading ? "Saving…" : profileSaved ? "Update Profile" : "Save Profile"}
            </button>
            {profileSaved && (
              <button type="button" onClick={() => router.push("/profile-preview")}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                View preview →
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ─── Tiny layout helpers ──────────────────────────────────────────────────────

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 ${className}`}>{children}</h2>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-sm font-medium text-gray-700 mb-2">{children}</p>;
}
