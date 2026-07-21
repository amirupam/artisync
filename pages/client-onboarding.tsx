import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { stripOAuthHashIfPresent } from "@/lib/stripOAuthHash";

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

export default function ClientOnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ fullName: "", phone: "", state: "", city: "" });

  useEffect(() => {
    let cancelled = false;

    async function handleUser(u: { id: string } | null | undefined) {
      if (cancelled) return;
      if (!u) {
        router.replace({ pathname: "/signup", query: { role: "client" } });
        return;
      }
      stripOAuthHashIfPresent();
      setUserId(u.id);
      const { data } = await supabase.from("clients").select("id").eq("id", u.id).maybeSingle();
      if (cancelled) return;
      if (data) {
        router.replace("/artists");
        return;
      }
      setChecking(false);
    }

    supabase.auth.getSession().then(({ data: { session } }) => handleUser(session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      handleUser(session?.user);
    });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, [router]);

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === "state") setForm((f) => ({ ...f, state: value, city: "" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) { setError("Please enter your name"); return; }
    if (!userId) return;
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error: dbError } = await supabase.from("clients").insert({
        id: userId,
        full_name: form.fullName.trim(),
        phone: form.phone.trim(),
        state: form.state,
        city: form.city,
        email: user?.email ?? "",
      });
      if (dbError) throw dbError;
      const returnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : "/artists";
      router.replace(returnTo);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cities = form.state ? (INDIA_STATES[form.state] ?? []) : [];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <video autoPlay loop muted playsInline className="absolute inset-0 h-full w-full object-cover">
        <source src="/background-video.mp4" type="video/mp4" />
      </video>
      <div className="absolute inset-0 bg-black/50" />

      <header className="relative z-10 p-4">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo_2.png" alt="ArtInYou" className="h-24 w-24 object-contain" />
        </Link>
      </header>

      <div className="relative z-10 flex justify-center px-6 pb-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-8 shadow-2xl">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-black text-white">Almost there!</h1>
              <p className="text-sm text-white/60 mt-1">Tell us a bit about yourself so artists can reach you</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">Your name *</label>
                <input
                  type="text"
                  required
                  placeholder="Full name"
                  value={form.fullName}
                  onChange={(e) => set("fullName", e.target.value)}
                  className="w-full rounded-xl border-0 bg-white/20 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">Phone number</label>
                <input
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                  className="w-full rounded-xl border-0 bg-white/20 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">State</label>
                <select
                  value={form.state}
                  onChange={(e) => set("state", e.target.value)}
                  className="w-full rounded-xl border-0 bg-white/20 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                >
                  <option value="" className="bg-gray-900">Select state</option>
                  {Object.keys(INDIA_STATES).sort().map((s) => (
                    <option key={s} value={s} className="bg-gray-900">{s}</option>
                  ))}
                </select>
              </div>

              {cities.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest mb-1.5">City</label>
                  <select
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    className="w-full rounded-xl border-0 bg-white/20 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/50 text-sm"
                  >
                    <option value="" className="bg-gray-900">Select city</option>
                    {cities.map((c) => (
                      <option key={c} value={c} className="bg-gray-900">{c}</option>
                    ))}
                  </select>
                </div>
              )}

              {error && (
                <div className="rounded-lg bg-red-500/20 border border-red-500/30 p-3">
                  <p className="text-sm text-red-200">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-amber-400 px-4 py-3 font-black text-gray-900 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 text-sm"
              >
                {saving ? "Saving..." : "Find Artists →"}
              </button>

              <button
                type="button"
                onClick={() => {
                  const returnTo = typeof router.query.returnTo === "string" ? router.query.returnTo : "/artists";
                  router.replace(returnTo);
                }}
                className="w-full text-center text-sm text-white/60 hover:text-white/90 transition-colors"
              >
                Skip for now
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
