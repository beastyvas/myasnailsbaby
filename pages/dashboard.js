// pages/dashboard.js
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import dynamic from "next/dynamic";
import "react-calendar/dist/Calendar.css";
import { DEFAULT_PERCENT, MAX_PERCENT, MIN_PERCENT, clampPercent, discountedCents } from "@/utils/reactivation";
import { normalizePhone } from "@/utils/sms";
import { BOOKABLE_SERVICES, DEPOSIT_CENTS, formatPrice, serviceLabel } from "@/utils/pricing";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });

const inputCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 placeholder-stone-400 bg-white text-sm";
const selectCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 bg-white text-sm";
const labelCls = "block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2";
const btnPrimary = "bg-rose-800 hover:bg-rose-900 text-white px-6 py-3 font-medium text-sm tracking-wide transition disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed";
const btnSecondary = "border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-5 py-2.5 font-medium text-sm transition";

/**
 * Service choices for Mya's own forms — same list and order as the booking
 * page, from the one source in utils/pricing.js, plus "N/A" for a block-off
 * with no service attached.
 *
 * `current` is kept as an option when it isn't in the list. Bookings exist
 * under names Mya no longer sells ("Hard Gel", "Builder Gel Manicure"), and
 * without this, opening one for editing would show a blank service and
 * quietly overwrite it on save.
 */
function serviceOptions(current) {
  const base = ["N/A", ...BOOKABLE_SERVICES.map((s) => s.value)];
  return current && !base.includes(current) ? [...base, current] : base;
}

/** "2h ago" — relative beats a timestamp here, since the only question Mya
 *  has is whether this is still happening. */
function timeAgo(iso) {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function SectionHeading({ children }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-0.5 h-6 bg-rose-800 flex-shrink-0" />
      <h2 className="text-lg font-bold text-stone-900" style={{ fontFamily: "Georgia, serif" }}>{children}</h2>
    </div>
  );
}

// ── Edit Booking Form ──────────────────────────────────────────
function EditBookingForm({ booking, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    name: booking.name || "",
    instagram: booking.instagram || "",
    phone: booking.phone || "",
    service: booking.service || "",
    art_level: booking.art_level || "",
    length: booking.length || "",
    soakoff: booking.soakoff || "",
    pedicure: booking.pedicure || "no",
    pedicure_type: booking.pedicure_type || "",
    date: booking.date || "",
    start_time: booking.start_time || "",
    duration: booking.duration || 1,
    notes: booking.notes || "",
    returning: booking.returning || "no",
    referral: booking.referral || "",
    paid: booking.paid || false,
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const [hour, minute] = formData.start_time.split(":");
    const endHour = parseInt(hour) + parseInt(formData.duration);
    const end_time = `${endHour.toString().padStart(2, "0")}:${minute || "00"}`;
    onSave({ ...formData, end_time });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Name", key: "name", type: "text", required: true },
          { label: "Instagram", key: "instagram", type: "text" },
          { label: "Phone", key: "phone", type: "tel" },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <input type={type} required={required} value={formData[key]}
              onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
              className={inputCls} />
          </div>
        ))}

        <div>
          <label className={labelCls}>Service</label>
          <select value={formData.service} onChange={(e) => setFormData({ ...formData, service: e.target.value })} className={selectCls}>
            {serviceOptions(formData.service).map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Art Level</label>
          <select value={formData.art_level} onChange={(e) => setFormData({ ...formData, art_level: e.target.value })} className={selectCls}>
            {["","Level 1","Level 2","Level 3","Level 4","French Tips"].map(v => <option key={v} value={v}>{v || "N/A"}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Length</label>
          <select value={formData.length} onChange={(e) => setFormData({ ...formData, length: e.target.value })} className={selectCls}>
            {["","Small/Xtra Small","Medium","Large","XL/XXL"].map(v => <option key={v} value={v}>{v || "N/A"}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Soak-Off</label>
          <select value={formData.soakoff} onChange={(e) => setFormData({ ...formData, soakoff: e.target.value })} className={selectCls}>
            <option value="none">No Soak-Off</option>
            <option value="soak-off">Soak-Off</option>
            <option value="foreign">Foreign Soak-Off</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Pedicure</label>
          <select value={formData.pedicure} onChange={(e) => setFormData({ ...formData, pedicure: e.target.value })} className={selectCls}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {formData.pedicure === "yes" && (
          <div>
            <label className={labelCls}>Pedicure Type</label>
            <select value={formData.pedicure_type} onChange={(e) => setFormData({ ...formData, pedicure_type: e.target.value })} className={selectCls}>
              <option value="">Select Type</option>
              <option value="Gel pedicure">Gel Pedicure</option>
              <option value="Gel pedciure + Acrylic big toes">Gel Pedicure + Acrylic Big Toes</option>
              <option value="Acrylic Pedicure">Acrylic Pedicure</option>
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Date</label>
          <input type="date" required value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Start Time</label>
          <input type="time" required value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Duration (hours)</label>
          <input type="number" min="1" max="5" required value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Client Type</label>
          <select value={formData.returning} onChange={(e) => setFormData({ ...formData, returning: e.target.value })} className={selectCls}>
            <option value="no">New Client</option>
            <option value="yes">Returning Client</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Paid Status</label>
          <select value={formData.paid ? "true" : "false"}
            onChange={(e) => setFormData({ ...formData, paid: e.target.value === "true" })} className={selectCls}>
            <option value="false">Not Paid</option>
            <option value="true">Paid</option>
          </select>
        </div>
      </div>

      {formData.returning === "no" && (
        <div>
          <label className={labelCls}>Referral</label>
          <input type="text" value={formData.referral}
            onChange={(e) => setFormData({ ...formData, referral: e.target.value })} className={inputCls} />
        </div>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <textarea rows="3" value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className={`${inputCls} resize-none`} />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>Cancel</button>
        <button type="submit" className={btnPrimary}>Save Changes</button>
      </div>
    </form>
  );
}

// ── New Appointment Form ───────────────────────────────────────
function NewAppointmentForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: "", instagram: "", phone: "", email: "",
    service: "", art_level: "", length: "", soakoff: "none",
    pedicure: "no", pedicure_type: "", date: "", start_time: "",
    duration: 2, notes: "", returning: "no", referral: "", paid: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const [hour, minute] = formData.start_time.split(":");
    const endHour = parseInt(hour) + parseInt(formData.duration);
    const end_time = `${endHour.toString().padStart(2, "0")}:${minute || "00"}`;
    const { error } = await supabase.from("bookings").insert([{ ...formData, end_time }]);
    if (error) {
      alert("Failed to add appointment");
      console.error(error.message);
    } else {
      alert("Appointment added successfully!");
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-stone-50 border border-stone-200 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: "Name *", key: "name", type: "text", required: true },
          { label: "Instagram", key: "instagram", type: "text" },
          { label: "Phone *", key: "phone", type: "tel", required: true },
          { label: "Email", key: "email", type: "email" },
        ].map(({ label, key, type, required }) => (
          <div key={key}>
            <label className={labelCls}>{label}</label>
            <input type={type} required={required} value={formData[key]}
              onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
              className={inputCls} />
          </div>
        ))}

        <div>
          <label className={labelCls}>Service</label>
          <select value={formData.service} onChange={(e) => setFormData({ ...formData, service: e.target.value })} className={selectCls}>
            {serviceOptions(formData.service).map(v => <option key={v}>{v}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Art Level</label>
          <select value={formData.art_level} onChange={(e) => setFormData({ ...formData, art_level: e.target.value })} className={selectCls}>
            {["","Level 1","Level 2","Level 3","Level 4","French Tips"].map(v => <option key={v} value={v}>{v || "N/A"}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Length</label>
          <select value={formData.length} onChange={(e) => setFormData({ ...formData, length: e.target.value })} className={selectCls}>
            {["","Small/Xtra Small","Medium","Large","XL/XXL"].map(v => <option key={v} value={v}>{v || "N/A"}</option>)}
          </select>
        </div>

        <div>
          <label className={labelCls}>Soak-Off</label>
          <select value={formData.soakoff} onChange={(e) => setFormData({ ...formData, soakoff: e.target.value })} className={selectCls}>
            <option value="none">No Soak-Off</option>
            <option value="soak-off">Soak-Off</option>
            <option value="foreign">Foreign Soak-Off</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Pedicure</label>
          <select value={formData.pedicure} onChange={(e) => setFormData({ ...formData, pedicure: e.target.value })} className={selectCls}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {formData.pedicure === "yes" && (
          <div>
            <label className={labelCls}>Pedicure Type</label>
            <select value={formData.pedicure_type} onChange={(e) => setFormData({ ...formData, pedicure_type: e.target.value })} className={selectCls}>
              <option value="">Select Type</option>
              <option value="Gel pedicure">Gel Pedicure</option>
              <option value="Gel pedciure + Acrylic big toes">Gel Pedicure + Acrylic Big Toes</option>
              <option value="Acrylic Pedicure">Acrylic Pedicure</option>
            </select>
          </div>
        )}

        <div>
          <label className={labelCls}>Date *</label>
          <input type="date" required value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Start Time *</label>
          <input type="time" required value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Duration (hours) *</label>
          <input type="number" min="1" max="5" required value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Client Type</label>
          <select value={formData.returning} onChange={(e) => setFormData({ ...formData, returning: e.target.value })} className={selectCls}>
            <option value="no">New Client</option>
            <option value="yes">Returning Client</option>
          </select>
        </div>
      </div>

      {formData.returning === "no" && (
        <div>
          <label className={labelCls}>Referral</label>
          <input type="text" value={formData.referral}
            onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
            placeholder="Who referred this client?" className={inputCls} />
        </div>
      )}

      <div>
        <label className={labelCls}>Notes</label>
        <textarea rows="3" value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Special requests or inspo details..." className={`${inputCls} resize-none`} />
      </div>

      <div className="bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
        New appointments are marked <strong>NOT PAID</strong> by default.
      </div>

      <button type="submit" className={`w-full ${btnPrimary}`}>ADD APPOINTMENT</button>
    </form>
  );
}

// ── Client Notes (inline editable) ───────────────────────────
function ClientNotes({ phone, initialNotes, currentLabel, onSave, saving }) {
  const [notes, setNotes] = useState(initialNotes);
  const dirty = notes !== initialNotes;
  return (
    <div>
      <label className={labelCls}>Notes</label>
      <textarea
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. prefers coffin shape, allergic to acrylics…"
        className="w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 placeholder-stone-400 bg-white text-sm resize-none"
      />
      {dirty && (
        <button
          onClick={() => onSave(notes)}
          disabled={saving}
          className="mt-2 text-xs font-semibold text-stone-700 hover:text-stone-900 border border-stone-300 hover:border-stone-900 px-3 py-1.5 transition"
        >
          {saving ? "Saving…" : "Save Notes"}
        </button>
      )}
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard() {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [gallery, setGallery] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [newSlot, setNewSlot] = useState({ start: "", end: "" });
  const [bookings, setBookings] = useState([]);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showNewAppointmentForm, setShowNewAppointmentForm] = useState(false);
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [profilePic, setProfilePic] = useState(null);
  const [profilePicPreview, setProfilePicPreview] = useState(null);
  const [uploadingProfilePic, setUploadingProfilePic] = useState(false);
  const [promoText, setPromoText] = useState("");
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [scheduleSettings, setScheduleSettings] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [allBookings, setAllBookings] = useState([]);
  const [expandedClientKey, setExpandedClientKey] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientLimit, setClientLimit] = useState(25);
  const [chargingNoShow, setChargingNoShow] = useState(new Set());
  const [clientProfiles, setClientProfiles] = useState({});
  const [savingClientLabel, setSavingClientLabel] = useState(new Set());

  const [reactivation, setReactivation] = useState(null);
  const [loadingReactivation, setLoadingReactivation] = useState(false);
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [campaignMsg, setCampaignMsg] = useState(null);
  const [campaignPicks, setCampaignPicks] = useState(null); // null = everyone due
  const [showSampleText, setShowSampleText] = useState(false);
  const [reactivationPercent, setReactivationPercent] = useState("");
  const [savingPercent, setSavingPercent] = useState(false);
  const [automations, setAutomations] = useState({
    reviews_enabled: true,
    rebook_enabled: true,
    rebook_after_weeks: 3,
  });
  const [savingAutomations, setSavingAutomations] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null);

  /** What the site has been doing on its own. Never blocks the dashboard —
   *  a failure here just hides the panel rather than breaking the page. */
  async function fetchAutomationStatus() {
    try {
      const res = await fetch("/api/automations-status");
      if (!res.ok) return;
      setAutoStatus(await res.json());
    } catch {
      /* panel stays hidden */
    }
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await Promise.all([
          fetchGallery(), fetchAvailability(), fetchBookings(),
          fetchBio(), fetchScheduleSettings(), fetchClientProfiles(),
          fetchAutomationStatus(),
        ]);
      }
      setReady(true);
    })();
  }, []);

  // Loaded on first visit to the tab rather than on mount: these are the only
  // views that need a round trip to the server, and most dashboard sessions
  // never open them.
  useEffect(() => {
    if (activeTab === "reactivate" && !reactivation && !loadingReactivation) {
      fetchReactivation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-stone-600 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Fetchers ──────────────────────────────────────────────────
  async function fetchBio() {
    const BASE = "bio, profile_picture_url, promo_text, promo_enabled";
    const ADDED = "reactivation_percent, rebook_after_weeks, reviews_enabled, rebook_enabled";
    // Selecting a column the database doesn't have fails the whole query, so
    // until the migrations have been run the bio and promo settings would
    // silently stop loading. Fall back to the columns that predate them.
    let { data, error } = await supabase.from("settings").select(`${BASE}, ${ADDED}`).single();
    if (error) {
      ({ data, error } = await supabase.from("settings").select(BASE).single());
      if (!error) console.warn("Newer settings columns are missing — run the migrations in supabase/migrations/");
    }
    if (!error && data) {
      setBio(data.bio || "");
      setProfilePicPreview(data.profile_picture_url || null);
      setPromoText(data.promo_text || "");
      setPromoEnabled(data.promo_enabled || false);
      setReactivationPercent(String(data.reactivation_percent ?? DEFAULT_PERCENT));
      setAutomations({
        reviews_enabled: data.reviews_enabled ?? true,
        rebook_enabled: data.rebook_enabled ?? true,
        rebook_after_weeks: data.rebook_after_weeks ?? 3,
      });
    }
  }

  const saveAutomations = async () => {
    setSavingAutomations(true);
    const clamp = (v, lo, hi, fallback) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
    };
    const payload = {
      reviews_enabled: !!automations.reviews_enabled,
      rebook_enabled: !!automations.rebook_enabled,
      rebook_after_weeks: clamp(automations.rebook_after_weeks, 1, 12, 3),
    };
    const { error } = await supabase
      .from("settings")
      .update(payload)
      .eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9");
    setSavingAutomations(false);
    setAutomations(payload);
    if (error) { alert("Failed to save."); return; }
    alert("Saved!");
  };

  // ── Reactivation campaign ────────────────────────────────────
  // Everything the campaign needs comes from one authenticated route: the
  // offer log and the opt-out list are service-role only, so the dashboard's
  // anon client can't read them directly.
  async function fetchReactivation() {
    setLoadingReactivation(true);
    try {
      const res = await fetch("/api/reactivation");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't load the campaign.");
      setReactivation(json);
      setCampaignPicks(null);
    } catch (err) {
      setCampaignMsg(err.message);
    } finally {
      setLoadingReactivation(false);
    }
  }

  const sendCampaign = async () => {
    const recipients = reactivation?.recipients ?? [];
    const targets = campaignPicks ? recipients.filter((r) => campaignPicks.includes(r.phone)) : recipients;
    if (targets.length === 0) return;

    const ok = confirm(
      `Text ${targets.length} ${targets.length === 1 ? "client" : "clients"} ${reactivation.percentOff}% off?\n\n` +
      `Each offer is good for ${reactivation.windowDays} days. This sends real texts and can't be undone.`
    );
    if (!ok) return;

    setSendingCampaign(true);
    setCampaignMsg(null);
    try {
      const res = await fetch("/api/reactivation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campaignPicks ? { phones: campaignPicks } : {}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Send failed.");

      const parts = [`Sent ${json.sent} ${json.sent === 1 ? "text" : "texts"}.`];
      if (json.failed?.length) parts.push(`Couldn't reach: ${json.failed.join(", ")}.`);
      setCampaignMsg(parts.join(" "));
      await fetchReactivation();
    } catch (err) {
      setCampaignMsg(err.message);
    } finally {
      setSendingCampaign(false);
    }
  };

  const setOptOut = async (phone, optedOut) => {
    const res = await fetch("/api/reactivation-optout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, opted_out: optedOut }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setCampaignMsg(json.error || "Couldn't update that.");
      return;
    }
    await fetchReactivation();
  };

  const saveReactivationPercent = async () => {
    setSavingPercent(true);
    const clamped = clampPercent(reactivationPercent);
    const { error } = await supabase
      .from("settings")
      .update({ reactivation_percent: clamped })
      .eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9");
    setSavingPercent(false);
    setReactivationPercent(String(clamped));
    if (error) { alert("Failed to save the offer."); return; }
    alert(`Reactivation offer set to ${clamped}% off.`);
    if (reactivation) fetchReactivation();
  };

  async function fetchClientProfiles() {
    const { data, error } = await supabase.from("clients").select("*");
    if (error) { console.error(error.message); return; }
    const map = {};
    (data || []).forEach((c) => { map[c.phone] = c; });
    setClientProfiles(map);
  }

  async function saveClientLabel(phone, label, notes) {
    setSavingClientLabel((prev) => new Set([...prev, phone]));
    await supabase
      .from("clients")
      .upsert({ phone, label: label || null, notes: notes || null }, { onConflict: "phone" });
    setClientProfiles((prev) => ({ ...prev, [phone]: { ...prev[phone], phone, label, notes } }));
    setSavingClientLabel((prev) => { const s = new Set(prev); s.delete(phone); return s; });
  }

  async function fetchScheduleSettings() {
    const { data, error } = await supabase.from("schedule_settings").select("*").order("day_of_week");
    if (!error) setScheduleSettings(data || []);
  }

  async function fetchGallery() {
    const { data, error } = await supabase.from("gallery").select("*").order("created_at", { ascending: false });
    if (!error) setGallery(data || []);
  }

  async function fetchAvailability() {
    const { data, error } = await supabase.from("availability").select("*").order("date");
    if (!error) setAvailability(data || []);
  }

  function convertTo24Hr(timeStr) {
    if (!timeStr || typeof timeStr !== "string") return "00:00";
    const match = timeStr.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i);
    if (!match) return "00:00";
    let [, hourStr, minuteStr, modifier] = match;
    let hour = parseInt(hourStr, 10);
    let minutes = parseInt(minuteStr || "00", 10);
    if (modifier.toUpperCase() === "PM" && hour !== 12) hour += 12;
    if (modifier.toUpperCase() === "AM" && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  async function fetchBookings() {
    const { data, error } = await supabase.from("bookings").select("*").order("date", { ascending: true });
    if (error) { console.error(error.message); return; }
    const all = data || [];
    setAllBookings(all);
    const now = new Date();
    const upcoming = all.filter((b) => {
      if (!b.date || !b.start_time) return false;
      const start = typeof b.start_time === "string" && b.start_time.includes("AM")
        ? convertTo24Hr(b.start_time) : b.start_time;
      return new Date(`${b.date}T${start}`).getTime() > now.getTime() - 5 * 60 * 1000;
    });
    setBookings(upcoming);
  }

  const handleChargeNoShow = async (booking) => {
    if (!confirm(`Charge ${booking.name} a $25 no-show fee? This will immediately charge their card on file.`)) return;
    setChargingNoShow((prev) => new Set([...prev, booking.id]));
    try {
      const res = await fetch("/api/charge-noshow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ booking_id: booking.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Charge failed");
      const patch = { no_show_charged: true, no_show_fee_amount: 2500 };
      setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, ...patch } : b));
      setAllBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, ...patch } : b));
      alert(`$25 no-show fee charged to ${booking.name}'s card.`);
    } catch (err) {
      alert(`Charge failed: ${err.message}`);
    } finally {
      setChargingNoShow((prev) => { const s = new Set(prev); s.delete(booking.id); return s; });
    }
  };

  function formatTime(time24) {
    if (!time24) return "";
    const [hourStr, minuteStr = "00"] = time24.split(":");
    const hour = parseInt(hourStr, 10);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minuteStr}${suffix}`;
  }

  function formatTimeRange(startTime, endTime) {
    return `${formatTime(startTime)} – ${formatTime(endTime)}`;
  }

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function dataURLtoFile(dataUrl, filename) {
    const arr = dataUrl.split(",");
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  async function handleUpload() {
    if (!preview || !caption) { alert("Please choose a photo and enter a name."); return; }
    const file = dataURLtoFile(preview, `${caption}.png`);
    const filePath = `nails/${caption}-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("gallery").upload(filePath, file);
    if (uploadError) { alert("Upload failed"); console.error(uploadError.message); return; }
    const { error: insertError } = await supabase.from("gallery").insert({ image_url: filePath, caption });
    if (insertError) { alert("Upload succeeded but caption save failed"); return; }
    alert("Uploaded successfully!");
    setPreview(null);
    setCaption("");
    fetchGallery();
  }

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!selectedDate || !newSlot.start || !newSlot.end) { alert("Please select date and times."); return; }
    const isoDate = new Date(selectedDate).toISOString().split("T")[0];
    const { error } = await supabase.from("availability").insert({ date: isoDate, start_time: newSlot.start, end_time: newSlot.end });
    if (error) { alert("Failed to add slot."); console.error(error.message); }
    else { setNewSlot({ start: "", end: "" }); fetchAvailability(); }
  };

  async function handleDeleteImage(item) {
    if (!confirm("Delete this set?")) return;
    const { error: deleteError } = await supabase.storage.from("gallery").remove([item.image_url]);
    if (deleteError) { alert("Delete failed"); return; }
    const { error: dbError } = await supabase.from("gallery").delete().eq("id", item.id);
    if (dbError) { alert("Deleted from storage but not DB"); return; }
    setGallery((prev) => prev.filter((g) => g.id !== item.id));
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleDeleteSelected() {
    if (!confirm(`Delete ${selectedIds.length} slot(s)?`)) return;
    const { error } = await supabase.from("availability").delete().in("id", selectedIds);
    if (error) { alert("Failed to delete."); console.error(error.message); }
    else { setSelectedIds([]); fetchAvailability(); }
  }

  const generateMonthAvailability = async () => {
    const { data: schedule, error: scheduleError } = await supabase.from("schedule_settings").select("*").order("day_of_week");
    if (scheduleError || !schedule) { alert("Failed to load schedule settings"); return; }
    const inserts = [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(selectedYear, selectedMonth, day);
      const dow = date.getDay();
      const iso = date.toISOString().split("T")[0];
      const daySchedule = schedule.find((s) => s.day_of_week === dow);
      if (!daySchedule || !daySchedule.is_open) continue;
      inserts.push({ date: iso, start_time: daySchedule.start_time, end_time: daySchedule.end_time });
    }
    if (inserts.length === 0) { alert("No availability to generate — all days closed?"); return; }
    const { error } = await supabase.from("availability").insert(inserts);
    if (error) { alert("Failed to insert slots."); console.error(error.message); }
    else { alert(`Generated ${inserts.length} availability slots!`); fetchAvailability(); }
  };

  const handleDeleteBooking = async (booking) => {
    if (!confirm("Delete this appointment?")) return;

    // Tell her before the row is gone — once it's deleted the phone number
    // goes with it. Cancelling on someone without telling them means they
    // turn up to a locked door, so a failed text stops the delete rather
    // than letting it go through silently.
    const tellThem = booking.phone
      ? confirm(`Text ${booking.name || "them"} to let them know it's cancelled?`)
      : false;

    if (tellThem) {
      try {
        const res = await fetch("/api/send-cancel-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: booking.name || "there",
            phone: booking.phone,
            date: booking.date,
            start_time: formatTime(booking.start_time),
          }),
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (!confirm(`Couldn't text them (${json.error || "send failed"}).\n\nDelete the appointment anyway?`)) return;
        }
      } catch {
        if (!confirm("Couldn't text them.\n\nDelete the appointment anyway?")) return;
      }
    }

    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (error) { alert("Failed to delete"); console.error(error.message); }
    else { fetchBookings(); }
  };

  const handleUpdateBooking = async (updatedData) => {
    const dateChanged = editingBooking.date !== updatedData.date;
    const timeChanged = editingBooking.start_time !== updatedData.start_time;
    const { error } = await supabase.from("bookings").update(updatedData).eq("id", editingBooking.id);
    if (error) { alert("Failed to update"); console.error(error.message); return; }
    if ((dateChanged || timeChanged) && updatedData.phone) {
      try {
        await fetch("/api/send-update-sms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: updatedData.phone, name: updatedData.name,
            oldDate: editingBooking.date, oldTime: editingBooking.start_time,
            newDate: updatedData.date, newTime: updatedData.start_time,
          }),
        });
      } catch (e) { console.error("SMS error:", e); }
    }
    alert("Appointment updated!");
    setEditingBooking(null);
    fetchBookings();
  };

  const saveBio = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ bio }).eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9");
    setSaving(false);
    if (error) { alert("Failed to save bio."); } else { alert("Bio updated!"); }
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePic(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const uploadProfilePicture = async () => {
    if (!profilePic) { alert("Please select a photo first!"); return; }
    setUploadingProfilePic(true);
    const filePath = `profile/mya-profile-${Date.now()}.png`;
    const { error: uploadError } = await supabase.storage.from("gallery").upload(filePath, profilePic);
    if (uploadError) { alert("Upload failed"); setUploadingProfilePic(false); return; }
    const { error: updateError } = await supabase.from("settings").update({ profile_picture_url: filePath }).eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9");
    setUploadingProfilePic(false);
    if (updateError) { alert("Upload succeeded but save failed"); } else { alert("Profile picture updated!"); setProfilePic(null); fetchBio(); }
  };

  const savePromoSettings = async () => {
    setSavingPromo(true);
    const { error } = await supabase.from("settings").update({ promo_text: promoText, promo_enabled: promoEnabled }).eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9");
    setSavingPromo(false);
    if (error) { alert("Failed to save promo settings."); } else { alert("Promo settings saved!"); }
  };

  const saveScheduleSettings = async () => {
    setSavingSchedule(true);
    const updates = scheduleSettings.map((day) =>
      supabase.from("schedule_settings").update({ is_open: day.is_open, start_time: day.start_time, end_time: day.end_time }).eq("day_of_week", day.day_of_week)
    );
    const results = await Promise.all(updates);
    setSavingSchedule(false);
    if (results.some((r) => r.error)) { alert("Failed to save schedule."); }
    else { alert("Schedule saved! Use Generate Availability to apply."); }
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "appointments", label: "Appointments" },
    { id: "clients", label: "Clients" },
    { id: "reactivate", label: "Reactivate" },
    { id: "gallery", label: "Gallery" },
    { id: "availability", label: "Availability" },
    { id: "schedule", label: "Schedule" },
    { id: "settings", label: "Settings" },
  ];

  const today = new Date().toISOString().split("T")[0];

  return (
    <main className="min-h-screen bg-stone-100">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-stone-900 flex items-center justify-center overflow-hidden flex-shrink-0">
              {profilePicPreview ? (
                <img
                  src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicPreview}`}
                  alt="Mya" className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-white text-lg font-bold" style={{ fontFamily: "Georgia, serif" }}>M</span>
              )}
            </div>
            <div>
              <h1 className="text-lg font-bold text-stone-900" style={{ fontFamily: "Georgia, serif" }}>Dashboard</h1>
              <p className="text-xs text-stone-500">MyasNailsBaby</p>
            </div>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = "/login"; }}
            className="text-sm text-stone-500 hover:text-stone-900 transition font-medium"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Tab Navigation */}
        <div className="mb-8 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
          <div className="flex gap-1 min-w-max sm:min-w-0 bg-white border border-stone-200 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium transition ${
                  activeTab === tab.id
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Today", value: bookings.filter((b) => b.date === today).length, accent: true },
                {
                  label: "This Week",
                  value: (() => {
                    const now = new Date();
                    const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0,0,0,0);
                    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23,59,59,999);
                    return bookings.filter((b) => { const d = new Date(b.date); return d >= weekStart && d <= weekEnd; }).length;
                  })(),
                  accent: false,
                },
                { label: "Gallery Items", value: gallery.length, accent: false },
                { label: "Open Slots", value: availability.length, accent: false },
              ].map(({ label, value, accent }) => (
                <div key={label} className="bg-white border border-stone-200 p-5 stat-card">
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">{label}</p>
                  <p className={`text-4xl font-bold ${accent ? "text-rose-800" : "text-stone-900"}`}>{value}</p>
                </div>
              ))}
            </div>

            {/* What the site did on its own.
                Mya had no view of this at all — the site was texting her
                clients and the only record was a GitHub Actions log. If it
                stopped she'd never have noticed, she'd just have got fewer
                rebookings. The banners are the important half: they make
                silence mean something. */}
            {autoStatus?.ok && (
              <div className="bg-white border border-stone-200 p-6">
                <SectionHeading>Automatic Texts</SectionHeading>

                {autoStatus.health === "stale" && (
                  <div className="mb-4 border border-red-300 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-900">Automatic texts may have stopped</p>
                    <p className="text-sm text-red-800 mt-0.5">
                      Nothing has run in over 6 hours. Reminders and review requests
                      probably aren&rsquo;t going out — let Nick know.
                    </p>
                  </div>
                )}
                {autoStatus.health === "never" && (
                  <div className="mb-4 border border-stone-300 bg-stone-50 px-4 py-3">
                    <p className="text-sm text-stone-700">Waiting for the first run.</p>
                  </div>
                )}
                {autoStatus.health === "failing" && (
                  <div className="mb-4 border border-red-300 bg-red-50 px-4 py-3">
                    <p className="text-sm font-semibold text-red-900">Some texts didn&rsquo;t send</p>
                    <p className="text-sm text-red-800 mt-0.5">
                      The last run couldn&rsquo;t deliver {autoStatus.failures}{" "}
                      {autoStatus.failures === 1 ? "message" : "messages"} — let Nick know.
                    </p>
                  </div>
                )}
                {autoStatus.health === "low-credits" && (
                  <div className="mb-4 border border-amber-300 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">Texts are about to stop</p>
                    <p className="text-sm text-amber-800 mt-0.5">
                      The texting account is nearly empty — let Nick know so he can top it up.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">Sent today</p>
                    <p className="text-3xl font-bold text-stone-900">{autoStatus.sentToday}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1">This week</p>
                    <p className="text-3xl font-bold text-stone-900">{autoStatus.sentThisWeek}</p>
                  </div>
                </div>

                {autoStatus.recent.length > 0 ? (
                  <div className="divide-y divide-stone-100 border-t border-stone-100">
                    {autoStatus.recent.map((r, i) => (
                      <div key={i} className="py-2.5 flex items-baseline justify-between gap-4">
                        <span className="text-sm text-stone-700 truncate">
                          {r.label}
                          {r.name && <span className="text-stone-400"> · {r.name}</span>}
                        </span>
                        <span className="text-xs text-stone-400 whitespace-nowrap">{timeAgo(r.sentAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-stone-500">
                    Nothing sent yet. Reminders go out the day before an appointment.
                  </p>
                )}
              </div>
            )}

            {/* Today's Schedule */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Today&apos;s Schedule</SectionHeading>
              {(() => {
                const todaysBookings = bookings.filter((b) => b.date === today).sort((a, b) => a.start_time.localeCompare(b.start_time));
                if (todaysBookings.length === 0) {
                  return <p className="text-stone-500 text-sm py-6 text-center">No appointments today.</p>;
                }
                return (
                  <div className="space-y-3">
                    {todaysBookings.map((b) => (
                      <div key={b.id} className="flex items-center justify-between p-4 border border-stone-200 hover:border-rose-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-stone-900 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {b.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-900 text-sm">{b.name}</p>
                            <p className="text-xs text-stone-500">{serviceLabel(b.service) || "—"}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-stone-900 text-sm">{formatTime(b.start_time)}</p>
                          <p className="text-xs text-stone-500">{b.duration}h</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Quick Actions */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Quick Actions</SectionHeading>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Appointments", tab: "appointments" },
                  { label: "Gallery", tab: "gallery" },
                  { label: "Availability", tab: "availability" },
                  { label: "Settings", tab: "settings" },
                ].map(({ label, tab }) => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className="border border-stone-300 text-stone-700 hover:bg-stone-900 hover:text-white hover:border-stone-900 py-3 px-4 text-sm font-medium transition">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Upcoming This Week */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Upcoming This Week</SectionHeading>
              {(() => {
                const now = new Date();
                const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(0,0,0,0);
                const nextWeek = new Date(now); nextWeek.setDate(nextWeek.getDate() + 7); nextWeek.setHours(23,59,59,999);
                const upcoming = bookings.filter((b) => {
                  const d = new Date(b.date + "T00:00:00");
                  return d >= tomorrow && d <= nextWeek;
                }).slice(0, 5);
                if (upcoming.length === 0) return <p className="text-stone-500 text-sm text-center py-4">No appointments coming up this week.</p>;
                return (
                  <div className="space-y-2">
                    {upcoming.map((b) => (
                      <div key={b.id} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0">
                        <div>
                          <p className="font-semibold text-stone-900 text-sm">{b.name}</p>
                          <p className="text-xs text-stone-500">{serviceLabel(b.service) || "—"}</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium text-stone-900">
                            {new Date(b.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                          <p className="text-xs text-stone-500">{formatTime(b.start_time)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── APPOINTMENTS ── */}
        {activeTab === "appointments" && (
          <div className="space-y-6">
            {/* Add New */}
            <div className="bg-white border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <SectionHeading>Add New Appointment</SectionHeading>
                <button
                  onClick={() => setShowNewAppointmentForm(!showNewAppointmentForm)}
                  className="text-sm text-rose-800 hover:text-rose-900 font-medium transition"
                >
                  {showNewAppointmentForm ? "Cancel" : "+ Add"}
                </button>
              </div>
              {showNewAppointmentForm && (
                <NewAppointmentForm onSuccess={() => { setShowNewAppointmentForm(false); fetchBookings(); }} />
              )}
            </div>

            {/* List */}
            <div className="bg-white border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <SectionHeading>Upcoming Appointments</SectionHeading>
                <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1">{bookings.length} total</span>
              </div>

              {bookings.length === 0 ? (
                <p className="text-stone-500 text-sm text-center py-12">No upcoming appointments.</p>
              ) : (
                <div className="space-y-4">
                  {bookings.map((booking) => {
                    const isReturning = booking.returning === "yes";
                    const editingThis = editingBooking?.id === booking.id;
                    return (
                      <div key={booking.id} className="border border-stone-200 hover:border-stone-400 transition-colors p-5 booking-card">
                        {!editingThis ? (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                              <div>
                                <h3 className="text-base font-bold text-stone-900">{booking.name}</h3>
                                <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                                  {booking.instagram && <p className="text-xs text-stone-500">@{booking.instagram}</p>}
                                  {booking.phone && <p className="text-xs text-stone-500">{booking.phone}</p>}
                                  {booking.email && <p className="text-xs text-stone-500">{booking.email}</p>}
                                </div>
                              </div>
                              <div className="text-left sm:text-right flex-shrink-0">
                                <p className="font-semibold text-stone-900 text-sm">{booking.date}</p>
                                <p className="text-xs text-stone-500">{formatTimeRange(booking.start_time, booking.end_time)}</p>
                                <p className="text-xs text-stone-400">{booking.duration}h appointment</p>
                              </div>
                            </div>

                            {/* The whole reactivation mechanism, from Mya's
                                side. There is no code for the client to
                                redeem — this flag is how she knows to take
                                the discount off, so it sits above the
                                details rather than among them, and names the
                                figure so it isn't mental arithmetic with
                                someone waiting. */}
                            {booking.discount_percent > 0 && (
                              <div className="mb-4 border border-rose-300 bg-rose-50 px-3 py-2">
                                <p className="text-xs font-semibold text-rose-900 uppercase tracking-wider">
                                  Came back · take {booking.discount_percent}% off
                                </p>
                                {booking.quoted_cents ? (
                                  <p className="text-sm text-rose-900 mt-0.5">
                                    {formatPrice(discountedCents(booking.quoted_cents, booking.discount_percent))}
                                    <span className="text-rose-700"> instead of {formatPrice(booking.quoted_cents)}</span>
                                    <span className="text-rose-700">
                                      {" "}· {formatPrice(Math.max(0, discountedCents(booking.quoted_cents, booking.discount_percent) - DEPOSIT_CENTS))} due at the visit
                                    </span>
                                  </p>
                                ) : (
                                  <p className="text-sm text-rose-900 mt-0.5">Discount off whatever the set comes to.</p>
                                )}
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-sm">
                              {booking.service && booking.service !== "N/A" && (
                                <p className="text-stone-700"><span className="text-stone-400">Service: </span>{serviceLabel(booking.service)}</p>
                              )}
                              {booking.art_level && booking.art_level !== "N/A" && (
                                <p className="text-stone-700"><span className="text-stone-400">Art: </span>{booking.art_level}</p>
                              )}
                              {booking.length && booking.length !== "N/A" && (
                                <p className="text-stone-700"><span className="text-stone-400">Length: </span>{booking.length}</p>
                              )}
                              {booking.soakoff && booking.soakoff !== "none" && (
                                <p className="text-stone-700"><span className="text-stone-400">Soak-Off: </span>{booking.soakoff}</p>
                              )}
                              {booking.pedicure === "yes" && (
                                <p className="text-stone-700"><span className="text-stone-400">Pedicure: </span>{booking.pedicure_type || "Yes"}</p>
                              )}
                            </div>

                            {booking.notes && (
                              <div className="mb-4 bg-stone-50 border border-stone-200 p-3 text-sm text-stone-700 italic">
                                &ldquo;{booking.notes}&rdquo;
                              </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex flex-wrap gap-2">
                                <span className={`text-xs font-semibold px-2.5 py-1 border ${booking.paid ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
                                  {booking.paid ? "PAID" : "UNPAID"}
                                </span>
                                <span className={`text-xs font-semibold px-2.5 py-1 border ${isReturning ? "bg-stone-100 text-stone-700 border-stone-200" : "bg-amber-50 text-amber-800 border-amber-200"}`}>
                                  {isReturning ? "RETURNING" : "NEW CLIENT"}
                                </span>
                              </div>
                              <div className="flex gap-4 items-center">
                                {booking.stripe_payment_method_id && (
                                  <button
                                    onClick={() => handleChargeNoShow(booking)}
                                    disabled={booking.no_show_charged || chargingNoShow.has(booking.id)}
                                    className={`text-xs font-semibold uppercase tracking-wide transition ${
                                      booking.no_show_charged
                                        ? "text-stone-400 cursor-default"
                                        : chargingNoShow.has(booking.id)
                                        ? "text-amber-400 cursor-wait"
                                        : "text-amber-700 hover:text-amber-900"
                                    }`}
                                  >
                                    {booking.no_show_charged ? "No-Show Charged ✓" : chargingNoShow.has(booking.id) ? "Charging…" : "Charge No-Show"}
                                  </button>
                                )}
                                <button onClick={() => setEditingBooking(booking)} className="text-xs font-semibold text-stone-600 hover:text-stone-900 transition uppercase tracking-wide">Edit</button>
                                <button onClick={() => handleDeleteBooking(booking)} className="text-xs font-semibold text-red-600 hover:text-red-800 transition uppercase tracking-wide">Delete</button>
                              </div>
                            </div>

                            {!isReturning && booking.referral?.trim() && booking.referral !== "MANUAL BLOCK" && (
                              <p className="mt-3 pt-3 border-t border-stone-100 text-xs text-stone-400">Referred by: {booking.referral}</p>
                            )}
                          </>
                        ) : (
                          <EditBookingForm booking={editingBooking} onSave={handleUpdateBooking} onCancel={() => setEditingBooking(null)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {activeTab === "clients" && (() => {
          const clientMap = {};
          allBookings.forEach((b) => {
            // A booking with no real phone number is one of Mya's own
            // block-offs — "wax", holds, personal time. It isn't a client,
            // it can't be texted, and left in it dominates the list: one
            // block-off entry had 111 "visits" and sat above everyone.
            const key = normalizePhone(b.phone);
            if (!key) return;
            if (!clientMap[key]) {
              clientMap[key] = { name: b.name, phone: b.phone, email: b.email, instagram: b.instagram, hasCard: false, bookings: [], noShowsCharged: 0 };
            }
            const c = clientMap[key];
            c.bookings.push(b);
            if (b.stripe_payment_method_id) c.hasCard = true;
            if (b.no_show_charged) c.noShowsCharged++;
            if (!c.email && b.email) c.email = b.email;
            if (!c.instagram && b.instagram) c.instagram = b.instagram;
          });

          const allClients = Object.entries(clientMap)
            .map(([key, c]) => ({ key, ...c }))
            .sort((a, b) => b.bookings.length - a.bookings.length);

          // 90 rows is a scroll to nowhere. Search first, then a capped list
          // with an explicit "show more" — the people she wants are almost
          // always either the most frequent or someone she can name.
          const q = clientSearch.trim().toLowerCase();
          const matched = q
            ? allClients.filter((c) =>
                [c.name, c.phone, c.email, c.instagram]
                  .filter(Boolean)
                  .some((v) => String(v).toLowerCase().includes(q)))
            : allClients;
          const clientList = matched.slice(0, clientLimit);

          const LABELS = [
            { value: "",        display: "No Label", cls: "bg-stone-100 text-stone-600 border-stone-200" },
            { value: "regular", display: "Regular",  cls: "bg-green-50 text-green-800 border-green-200" },
            { value: "vip",     display: "VIP",      cls: "bg-purple-50 text-purple-800 border-purple-200" },
            { value: "flagged", display: "Flagged",  cls: "bg-red-50 text-red-800 border-red-200" },
          ];

          const selected = expandedClientKey ? clientList.find((c) => c.key === expandedClientKey) : null;

          // ── Client detail panel ──────────────────────────────
          const DetailPanel = ({ client }) => {
            const profile = clientProfiles[client.phone] || {};
            const currentLabel = profile.label || "";
            const labelMeta = LABELS.find((l) => l.value === currentLabel) || LABELS[0];
            const sorted = [...client.bookings].sort((a, b) => new Date(b.date) - new Date(a.date));
            const paidCount = client.bookings.filter((b) => b.paid).length;
            const totalDeposits = paidCount * 20;
            const totalNoShowFees = client.noShowsCharged * 25;

            return (
              <div className="bg-white border border-stone-200 flex flex-col h-full">
                {/* Header */}
                <div className="p-6 border-b border-stone-200">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-stone-900 text-white flex items-center justify-center font-bold text-xl flex-shrink-0" style={{ fontFamily: "Georgia, serif" }}>
                      {(client.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-lg font-bold text-stone-900">{client.name}</h3>
                        {currentLabel && (
                          <span className={`text-xs font-semibold px-2 py-0.5 border ${labelMeta.cls}`}>{labelMeta.display}</span>
                        )}
                        {client.hasCard && (
                          <span className="text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200 px-2 py-0.5">Card on file</span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {client.phone    && <p className="text-sm text-stone-600">{client.phone}</p>}
                        {client.email    && <p className="text-sm text-stone-500">{client.email}</p>}
                        {client.instagram && <p className="text-sm text-stone-500">@{client.instagram}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3 mt-5">
                    {[
                      { label: "Visits",    value: client.bookings.length },
                      { label: "Deposits",  value: `$${totalDeposits}` },
                      { label: "No-Shows",  value: client.noShowsCharged, warn: client.noShowsCharged > 0 },
                    ].map(({ label, value, warn }) => (
                      <div key={label} className="bg-stone-50 border border-stone-200 p-3 text-center">
                        <p className={`text-xl font-bold ${warn ? "text-rose-800" : "text-stone-900"}`}>{value}</p>
                        <p className="text-xs text-stone-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Label + Notes */}
                <div className="p-5 border-b border-stone-200 space-y-4">
                  <div>
                    <p className={labelCls}>Label</p>
                    <div className="flex flex-wrap gap-2">
                      {LABELS.map((l) => (
                        <button
                          key={l.value}
                          disabled={savingClientLabel.has(client.phone)}
                          onClick={() => saveClientLabel(client.phone, l.value, profile.notes)}
                          className={`text-xs font-semibold px-3 py-1.5 border transition ${
                            currentLabel === l.value
                              ? l.cls + " ring-2 ring-offset-1 ring-stone-400"
                              : "bg-white border-stone-300 text-stone-600 hover:border-stone-900"
                          }`}
                        >
                          {l.display}
                        </button>
                      ))}
                      {savingClientLabel.has(client.phone) && (
                        <span className="text-xs text-stone-400 self-center">Saving…</span>
                      )}
                    </div>
                  </div>
                  <ClientNotes
                    phone={client.phone}
                    initialNotes={profile.notes || ""}
                    currentLabel={currentLabel}
                    onSave={(notes) => saveClientLabel(client.phone, currentLabel, notes)}
                    saving={savingClientLabel.has(client.phone)}
                  />
                </div>

                {/* Booking history */}
                <div className="flex-1 overflow-y-auto p-5">
                  <p className={`${labelCls} mb-3`}>Booking History</p>
                  {sorted.length === 0 ? (
                    <p className="text-stone-400 text-sm">No bookings found.</p>
                  ) : (
                    <div className="space-y-3">
                      {sorted.map((b) => {
                        const details = [
                          b.service && b.service !== "N/A" && serviceLabel(b.service),
                          b.art_level,
                          b.length,
                          b.soakoff && b.soakoff !== "none" && b.soakoff,
                          b.pedicure === "yes" && (b.pedicure_type || "Pedicure"),
                          b.duration && `${b.duration}h`,
                        ].filter(Boolean);

                        return (
                          <div key={b.id} className="border border-stone-200 p-4 bg-stone-50">
                            {/* Date / time row */}
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <p className="font-bold text-stone-900 text-sm">
                                  {new Date(b.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                                </p>
                                {b.start_time && (
                                  <p className="text-xs text-stone-500 mt-0.5">{formatTimeRange(b.start_time, b.end_time)}</p>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                <span className={`text-xs font-semibold px-2 py-0.5 border ${b.paid ? "bg-green-50 text-green-800 border-green-200" : "bg-stone-100 text-stone-500 border-stone-200"}`}>
                                  {b.paid ? "Paid $20" : "Unpaid"}
                                </span>
                                {b.no_show_charged && (
                                  <span className="text-xs font-semibold px-2 py-0.5 border bg-rose-50 text-rose-800 border-rose-200">No-show $25</span>
                                )}
                              </div>
                            </div>

                            {/* Service details */}
                            {details.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {details.map((d, i) => (
                                  <span key={i} className="text-xs bg-white border border-stone-200 text-stone-700 px-2 py-0.5">{d}</span>
                                ))}
                              </div>
                            )}

                            {/* Notes */}
                            {b.notes && (
                              <p className="text-xs text-stone-500 italic mb-3">&ldquo;{b.notes}&rdquo;</p>
                            )}

                            {/* Charge button */}
                            {b.stripe_payment_method_id && !b.no_show_charged && (
                              <button
                                onClick={() => handleChargeNoShow(b)}
                                disabled={chargingNoShow.has(b.id)}
                                className={`text-xs font-semibold uppercase tracking-wide transition border px-3 py-1.5 ${
                                  chargingNoShow.has(b.id)
                                    ? "border-amber-200 text-amber-400 cursor-wait"
                                    : "border-amber-300 text-amber-700 hover:bg-amber-50"
                                }`}
                              >
                                {chargingNoShow.has(b.id) ? "Charging…" : "Charge $25 No-Show Fee"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return (
            <div>
              {/* Mobile: back button when a client is selected */}
              {selected && (
                <button
                  onClick={() => setExpandedClientKey(null)}
                  className="sm:hidden flex items-center gap-2 text-sm font-medium text-stone-600 hover:text-stone-900 mb-4"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                  All Clients
                </button>
              )}

              <div className="grid sm:grid-cols-[280px,1fr] gap-4 items-start">
                {/* Client list — hidden on mobile when detail is open */}
                <div className={`bg-white border border-stone-200 ${selected ? "hidden sm:block" : ""}`}>
                  <div className="p-4 border-b border-stone-200 flex items-center justify-between">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                      {q ? "Matching" : "All Clients"}
                    </p>
                    <span className="text-xs font-semibold text-stone-400">
                      {q ? `${matched.length} of ${allClients.length}` : allClients.length}
                    </span>
                  </div>

                  <div className="px-4 py-3 border-b border-stone-200">
                    <input
                      type="search"
                      value={clientSearch}
                      onChange={(e) => { setClientSearch(e.target.value); setClientLimit(25); }}
                      placeholder="Search name, number, or @handle"
                      aria-label="Search clients"
                      className="w-full px-3 py-2 border border-stone-300 focus:border-stone-900 focus:outline-none text-sm bg-white placeholder-stone-400"
                    />
                  </div>

                  {clientList.length === 0 ? (
                    <p className="text-stone-400 text-sm text-center py-10">
                      {q ? `Nobody matching "${clientSearch}".` : "No clients yet."}
                    </p>
                  ) : (
                    <div className="divide-y divide-stone-100">
                      {clientList.map((client) => {
                        const profile = clientProfiles[client.phone] || {};
                        const currentLabel = profile.label || "";
                        const labelMeta = LABELS.find((l) => l.value === currentLabel) || LABELS[0];
                        const isSelected = expandedClientKey === client.key;
                        return (
                          <button
                            key={client.key}
                            onClick={() => setExpandedClientKey(client.key)}
                            className={`w-full text-left px-4 py-3.5 transition hover:bg-stone-50 ${isSelected ? "bg-stone-900 hover:bg-stone-900" : ""}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 flex items-center justify-center font-bold text-xs flex-shrink-0 ${isSelected ? "bg-white text-stone-900" : "bg-stone-900 text-white"}`}>
                                {(client.name || "?").charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className={`text-sm font-semibold truncate ${isSelected ? "text-white" : "text-stone-900"}`}>{client.name}</p>
                                  {currentLabel && (
                                    <span className={`text-xs font-semibold px-1.5 py-0.5 border flex-shrink-0 ${isSelected ? "bg-white/20 text-white border-white/30" : labelMeta.cls}`}>
                                      {labelMeta.display}
                                    </span>
                                  )}
                                </div>
                                <p className={`text-xs truncate mt-0.5 ${isSelected ? "text-stone-300" : "text-stone-500"}`}>
                                  {client.phone || client.email || "—"}
                                </p>
                              </div>
                              <p className={`text-xs font-semibold flex-shrink-0 ${isSelected ? "text-stone-300" : "text-stone-400"}`}>
                                {client.bookings.length}×
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {matched.length > clientList.length && (
                    <button
                      onClick={() => setClientLimit(clientLimit + 25)}
                      className="w-full py-3 text-xs font-semibold text-rose-800 hover:bg-stone-50 border-t border-stone-200 uppercase tracking-wider transition"
                    >
                      Show {Math.min(25, matched.length - clientList.length)} more
                    </button>
                  )}
                </div>

                {/* Detail panel */}
                <div className={selected ? "" : "hidden sm:flex sm:items-center sm:justify-center sm:bg-white sm:border sm:border-stone-200 sm:min-h-[400px]"}>
                  {selected
                    ? <DetailPanel client={selected} />
                    : <p className="text-stone-400 text-sm">Select a client to view their profile.</p>
                  }
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── REACTIVATE ── */}
        {activeTab === "reactivate" && (() => {
          const recipients = reactivation?.recipients ?? [];
          const clients = reactivation?.clients ?? [];
          const stats = reactivation?.stats;
          const liveOffers = clients.filter((c) => c.offer && !c.offer.booked);
          const wonBack = clients.filter((c) => c.offer?.booked);
          const optedOut = clients.filter((c) => c.optedOut);
          const chosen = campaignPicks ?? recipients.map((r) => r.phone);

          const togglePick = (phone) => {
            const next = new Set(chosen);
            if (next.has(phone)) next.delete(phone); else next.add(phone);
            setCampaignPicks([...next]);
          };

          return (
            <div className="space-y-6">
              {campaignMsg && (
                <div className="bg-rose-50 border border-rose-200 text-stone-800 px-4 py-3 text-sm flex items-start justify-between gap-4">
                  <span>{campaignMsg}</span>
                  <button onClick={() => setCampaignMsg(null)} className="text-stone-400 hover:text-stone-900 flex-shrink-0">✕</button>
                </div>
              )}

              {loadingReactivation && !reactivation ? (
                <div className="bg-white border border-stone-200 p-10 text-center">
                  <div className="w-8 h-8 border-2 border-stone-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-stone-500 text-sm">Working out who&apos;s gone quiet...</p>
                </div>
              ) : !reactivation ? (
                <div className="bg-white border border-stone-200 p-10 text-center">
                  <p className="text-stone-500 text-sm mb-4">Couldn&apos;t load the campaign.</p>
                  <button onClick={fetchReactivation} className={btnSecondary}>Try again</button>
                </div>
              ) : (
                <>
                  {/* Scoreboard */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Due Now", value: recipients.length, accent: true },
                      { label: "Offers Live", value: stats?.live ?? 0 },
                      { label: "Came Back", value: stats?.booked ?? 0 },
                      { label: "Deposits", value: `$${stats?.deposits ?? 0}` },
                    ].map(({ label, value, accent }) => (
                      <div key={label} className="bg-white border border-stone-200 p-5 stat-card">
                        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2">{label}</p>
                        <p className={`text-4xl font-bold ${accent ? "text-rose-800" : "text-stone-900"}`}>{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* The campaign */}
                  <div className="bg-white border border-stone-200 p-6">
                    <SectionHeading>Win Them Back</SectionHeading>

                    {recipients.length === 0 ? (
                      <p className="text-stone-500 text-sm leading-relaxed">
                        {liveOffers.length > 0
                          ? `Nobody new is due. ${liveOffers.length} ${liveOffers.length === 1 ? "offer is" : "offers are"} still live — give them time to book.`
                          : `Nobody's due. Clients show up here ${reactivation.dormantAfterDays} days after their last set with nothing on the books.`}
                      </p>
                    ) : (
                      <div className="space-y-5">
                        <p className="text-sm text-stone-700 leading-relaxed">
                          <strong className="text-stone-900">{recipients.length} {recipients.length === 1 ? "client hasn't" : "clients haven't"} been in for a while.</strong>{" "}
                          Each one gets a single text offering {reactivation.percentOff}% off, good for {reactivation.windowDays} days.
                          There&rsquo;s no code — if they book, they&rsquo;ll show up flagged and you take it off at the chair.
                          Change the offer under Settings.
                        </p>

                        <div>
                          <button
                            onClick={() => setShowSampleText((v) => !v)}
                            className="text-xs font-semibold text-rose-800 hover:text-rose-900 uppercase tracking-wider"
                          >
                            {showSampleText ? "Hide the text" : "See the text they get"}
                          </button>
                          {showSampleText && reactivation.sample && (
                            <pre className="mt-3 bg-stone-50 border border-stone-200 p-4 text-xs text-stone-700 whitespace-pre-wrap font-sans leading-relaxed">
                              {reactivation.sample}
                            </pre>
                          )}
                        </div>

                        {/* Who's getting it — every row is unticked-able, so a
                            client Mya knows has moved away isn't texted. */}
                        <div className="border border-stone-200">
                          <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-b border-stone-200">
                            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
                              Sending to {chosen.length} of {recipients.length}
                            </p>
                            <button
                              onClick={() => setCampaignPicks(chosen.length === recipients.length ? [] : null)}
                              className="text-xs font-semibold text-rose-800 hover:text-rose-900"
                            >
                              {chosen.length === recipients.length ? "Clear all" : "Select all"}
                            </button>
                          </div>
                          <div className="divide-y divide-stone-100 max-h-80 overflow-y-auto">
                            {recipients.map((r) => (
                              <label key={r.phone} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-stone-50 transition">
                                <input
                                  type="checkbox"
                                  checked={chosen.includes(r.phone)}
                                  onChange={() => togglePick(r.phone)}
                                  className="w-4 h-4 accent-rose-800 flex-shrink-0"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-stone-900 truncate">{r.name || r.phone}</p>
                                  <p className="text-xs text-stone-500">
                                    {r.daysSinceVisit} days since her last set · {r.visits} {r.visits === 1 ? "visit" : "visits"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => { e.preventDefault(); setOptOut(r.phone, true); }}
                                  className="text-xs text-stone-400 hover:text-red-700 transition flex-shrink-0"
                                  title="Never send her promotional texts"
                                >
                                  Don&apos;t text
                                </button>
                              </label>
                            ))}
                          </div>
                        </div>

                        <button
                          onClick={sendCampaign}
                          disabled={sendingCampaign || chosen.length === 0}
                          className={btnPrimary}
                        >
                          {sendingCampaign ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Sending...
                            </span>
                          ) : `SEND TO ${chosen.length}`}
                        </button>
                      </div>
                    )}

                    <details className="mt-6 text-xs text-stone-500">
                      <summary className="cursor-pointer text-rose-800 font-semibold uppercase tracking-wider">How this works</summary>
                      <p className="mt-3 leading-relaxed">
                        Anyone who books from a texted number within {reactivation.windowDays} days is credited automatically —
                        they don&apos;t have to mention the code. Their booking gets stamped with the discount and you get a
                        text the moment it happens, so you know to honor it when they sit down. If someone replies STOP they
                        stop getting offers straight away, but their appointment confirmations and reminders keep coming.
                      </p>
                    </details>
                  </div>

                  {/* Live offers */}
                  {liveOffers.length > 0 && (
                    <div className="bg-white border border-stone-200 p-6">
                      <SectionHeading>Offers Out There</SectionHeading>
                      <div className="divide-y divide-stone-100">
                        {liveOffers.map((c) => (
                          <div key={c.phone} className="py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-900 truncate">{c.name || c.phone}</p>
                              <p className="text-xs text-stone-500">
                                {c.offer.percentOff}% off · expires {new Date(c.offer.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </p>
                            </div>
                            <span className="text-xs font-semibold bg-rose-50 text-rose-900 border border-rose-200 px-2 py-0.5 flex-shrink-0">Waiting</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Won back */}
                  {wonBack.length > 0 && (
                    <div className="bg-white border border-stone-200 p-6">
                      <SectionHeading>Came Back</SectionHeading>
                      <div className="divide-y divide-stone-100">
                        {wonBack.map((c) => (
                          <div key={c.phone} className="py-3 flex items-center justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-stone-900 truncate">{c.name || c.phone}</p>
                              <p className="text-xs text-stone-500">Take {c.offer.percentOff}% off at the chair</p>
                            </div>
                            <span className="text-xs font-semibold bg-green-50 text-green-800 border border-green-200 px-2 py-0.5 flex-shrink-0">Booked</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Opted out */}
                  {optedOut.length > 0 && (
                    <div className="bg-white border border-stone-200 p-6">
                      <SectionHeading>Not Receiving Offers</SectionHeading>
                      <p className="text-xs text-stone-500 mb-4 leading-relaxed">
                        These numbers asked out of promotional texts. They still get confirmations and reminders for
                        appointments they book.
                      </p>
                      <div className="divide-y divide-stone-100">
                        {optedOut.map((c) => (
                          <div key={c.phone} className="py-3 flex items-center justify-between gap-4">
                            <p className="text-sm text-stone-700 truncate">{c.name || c.phone}</p>
                            <button
                              onClick={() => setOptOut(c.phone, false)}
                              className="text-xs text-stone-400 hover:text-stone-900 transition flex-shrink-0"
                            >
                              Let back in
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {/* ── GALLERY ── */}
        {activeTab === "gallery" && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Upload New Set</SectionHeading>
              <div className="space-y-5">
                <div>
                  <label className={labelCls}>Choose Photo</label>
                  <label className="cursor-pointer block">
                    <div className="border-2 border-dashed border-stone-300 p-8 text-center hover:border-rose-800 hover:bg-stone-50 transition-colors">
                      {preview ? (
                        <img src={preview} alt="Preview" className="max-h-64 object-cover mx-auto" />
                      ) : (
                        <div>
                          <p className="text-sm font-medium text-stone-700">Click to upload photo</p>
                          <p className="text-xs text-stone-400 mt-1">PNG, JPG up to 10MB</p>
                        </div>
                      )}
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>
                <div>
                  <label className={labelCls}>Set Name</label>
                  <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
                    placeholder="e.g. Valentine's Set" className={inputCls} />
                </div>
                <button onClick={handleUpload} disabled={!preview || !caption} className={`w-full ${btnPrimary}`}>
                  UPLOAD SET
                </button>
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <SectionHeading>Gallery</SectionHeading>
                <span className="text-xs font-semibold text-stone-500 bg-stone-100 px-3 py-1">{gallery.length} sets</span>
              </div>
              {gallery.length === 0 ? (
                <p className="text-stone-500 text-sm text-center py-12">No gallery items yet. Upload your first set!</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {gallery.map((item) => (
                    <div key={item.id} className="group relative overflow-hidden bg-stone-100 gallery-item">
                      <img
                        src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${item.image_url}`}
                        alt={item.caption}
                        className="w-full aspect-square object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-stone-900/0 group-hover:bg-stone-900/50 transition-colors duration-300 flex items-center justify-center">
                        <button
                          onClick={() => handleDeleteImage(item)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity bg-white text-red-700 text-xs font-semibold px-4 py-2 hover:bg-red-600 hover:text-white transition-colors"
                        >
                          DELETE
                        </button>
                      </div>
                      <div className="p-3 border-t border-stone-200">
                        <p className="text-xs font-medium text-stone-900 truncate">{item.caption}</p>
                        <p className="text-xs text-stone-400 mt-0.5">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── AVAILABILITY ── */}
        {activeTab === "availability" && (
          <div className="space-y-6">
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Generate Monthly Availability</SectionHeading>
              <div className="flex flex-wrap gap-4 items-end mb-4">
                <div>
                  <label className={labelCls}>Month</label>
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))} className={`${selectCls} w-auto`}>
                    {["January","February","March","April","May","June","July","August","September","October","November","December"].map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Year</label>
                  <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))} className={`${selectCls} w-auto`}>
                    {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map((y) => (
                      <option key={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <button onClick={generateMonthAvailability} className={btnPrimary}>GENERATE AVAILABILITY</button>
              </div>
              <div className="bg-stone-50 border border-stone-200 p-4 text-sm text-stone-700">
                <strong>Tip:</strong> Your weekly schedule is configured in the <strong>Schedule</strong> tab. Click Generate to apply it to the selected month.
              </div>
            </div>

            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Availability Calendar</SectionHeading>
              <div className="calendar-container mb-6">
                <Calendar
                  value={selectedDate ? new Date(selectedDate + "T00:00:00") : null}
                  onChange={(date) => setSelectedDate(date.toISOString().split("T")[0])}
                  tileClassName={({ date }) => {
                    const iso = date.toISOString().split("T")[0];
                    return availability.some((a) => a.date === iso) ? "available-date" : "";
                  }}
                  calendarType="US"
                  className="w-full border-none"
                />
              </div>

              {selectedDate && (
                <>
                  <div className="border-t border-stone-200 pt-6 mb-6">
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">
                      Add Slot — {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                    <form onSubmit={handleAddSlot} className="flex flex-wrap gap-4 items-end">
                      <div>
                        <label className={labelCls}>Start Time</label>
                        <input type="time" required className={`${inputCls} w-auto`} value={newSlot.start}
                          onChange={(e) => setNewSlot((p) => ({ ...p, start: e.target.value }))} />
                      </div>
                      <div>
                        <label className={labelCls}>End Time</label>
                        <input type="time" required className={`${inputCls} w-auto`} value={newSlot.end}
                          onChange={(e) => setNewSlot((p) => ({ ...p, end: e.target.value }))} />
                      </div>
                      <button type="submit" className={btnPrimary}>ADD SLOT</button>
                    </form>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">Available Times</p>
                    <div className="space-y-2">
                      {availability.filter((s) => s.date === selectedDate).map((slot) => (
                        <div key={slot.id} className="flex items-center justify-between border border-stone-200 px-4 py-3 hover:border-stone-400 transition-colors">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={selectedIds.includes(slot.id)} onChange={() => toggleSelected(slot.id)}
                              className="w-4 h-4 accent-rose-800" />
                            <span className="font-medium text-stone-900 text-sm">{formatTime(slot.start_time)} → {formatTime(slot.end_time)}</span>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm("Delete this slot?")) return;
                              const { error } = await supabase.from("availability").delete().eq("id", slot.id);
                              if (!error) fetchAvailability();
                            }}
                            className="text-xs font-semibold text-red-600 hover:text-red-800 transition uppercase tracking-wide"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                      {availability.filter((s) => s.date === selectedDate).length === 0 && (
                        <p className="text-stone-500 text-sm text-center py-4">No slots for this date.</p>
                      )}
                    </div>
                    {selectedIds.length > 0 && (
                      <button onClick={handleDeleteSelected} className="mt-4 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 text-sm font-medium transition">
                        DELETE SELECTED ({selectedIds.length})
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {activeTab === "schedule" && (
          <div className="bg-white border border-stone-200 p-6">
            <SectionHeading>Weekly Schedule</SectionHeading>
            <p className="text-sm text-stone-600 mb-4">Set default working hours per day. Used when generating availability slots.</p>
            <div className="bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 mb-6">
              <strong>Note:</strong> Changes only affect future availability generation. Existing slots are not modified.
            </div>

            <div className="space-y-3">
              {scheduleSettings.length === 0 ? (
                <p className="text-stone-500 text-sm">Loading schedule...</p>
              ) : (
                scheduleSettings.map((day, index) => {
                  const dayName = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day.day_of_week];
                  return (
                    <div key={day.day_of_week} className={`border p-4 transition-colors ${day.is_open ? "border-stone-300 bg-white" : "border-stone-200 bg-stone-50"}`}>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="w-28 flex-shrink-0">
                          <span className={`text-sm font-bold ${day.is_open ? "text-stone-900" : "text-stone-400"}`}>{dayName}</span>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={day.is_open}
                            onChange={(e) => { const u = [...scheduleSettings]; u[index].is_open = e.target.checked; setScheduleSettings(u); }}
                            className="w-4 h-4 accent-rose-800" />
                          <span className="text-sm text-stone-700">{day.is_open ? "Open" : "Closed"}</span>
                        </label>
                        {day.is_open && (
                          <div className="flex items-center gap-4">
                            <div>
                              <label className="text-xs text-stone-500 mr-2">From</label>
                              <input type="time" value={day.start_time}
                                onChange={(e) => { const u = [...scheduleSettings]; u[index].start_time = e.target.value; setScheduleSettings(u); }}
                                className="border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none" />
                            </div>
                            <div>
                              <label className="text-xs text-stone-500 mr-2">To</label>
                              <input type="time" value={day.end_time}
                                onChange={(e) => { const u = [...scheduleSettings]; u[index].end_time = e.target.value; setScheduleSettings(u); }}
                                className="border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none" />
                            </div>
                            <span className="text-xs text-stone-400 hidden sm:block">({formatTime(day.start_time)} – {formatTime(day.end_time)})</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button onClick={() => fetchScheduleSettings()} className={btnSecondary}>Reset Changes</button>
              <button onClick={saveScheduleSettings} disabled={savingSchedule} className={btnPrimary}>
                {savingSchedule ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : "SAVE SCHEDULE"}
              </button>
            </div>

            <div className="mt-6 bg-stone-50 border border-stone-200 p-5">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-3">How It Works</p>
              <ol className="text-sm text-stone-700 space-y-1 list-decimal list-inside">
                <li>Set your hours for each day above</li>
                <li>Click Save Schedule to store changes</li>
                <li>Go to Availability tab and click Generate Availability</li>
                <li>New slots will use your updated schedule</li>
              </ol>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Profile Picture */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Profile Picture</SectionHeading>
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 bg-stone-200 flex-shrink-0 overflow-hidden">
                  {profilePicPreview ? (
                    <img
                      src={profilePicPreview.startsWith("http") ? profilePicPreview : `https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${profilePicPreview}`}
                      alt="Profile" className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>M</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <label className="cursor-pointer block">
                    <div className="border-2 border-dashed border-stone-300 p-4 text-center hover:border-rose-800 hover:bg-stone-50 transition-colors">
                      <p className="text-sm font-medium text-stone-700">Click to upload new photo</p>
                      <p className="text-xs text-stone-400 mt-1">PNG, JPG up to 5MB</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleProfilePicChange} className="hidden" />
                  </label>
                  {profilePic && (
                    <button onClick={uploadProfilePicture} disabled={uploadingProfilePic} className={`mt-3 w-full ${btnPrimary}`}>
                      {uploadingProfilePic ? "Uploading..." : "SAVE PROFILE PICTURE"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Bio</SectionHeading>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Booking Page Bio</label>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={5}
                    placeholder="Enter the bio that appears on your booking page..."
                    className={`${inputCls} resize-none`} />
                </div>
                <button onClick={saveBio} disabled={saving} className={btnPrimary}>
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : "SAVE BIO"}
                </button>
              </div>
            </div>

            {/* Automatic Texts */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Automatic Texts</SectionHeading>
              <p className="text-xs text-stone-500 mb-5 leading-relaxed">
                These go out on their own, every hour, without you touching anything. Appointment
                reminders always send — they&apos;re part of the booking.
              </p>
              <div className="space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={automations.reviews_enabled}
                    onChange={(e) => setAutomations({ ...automations, reviews_enabled: e.target.checked })}
                    className="w-4 h-4 accent-rose-800 mt-0.5" />
                  <span className="text-sm text-stone-700 leading-relaxed">
                    <strong className="text-stone-900">Ask for a Google review</strong> a couple of hours after
                    they leave. Reviews are the biggest thing deciding whether you show up when someone
                    searches &ldquo;nails near me&rdquo;.
                  </span>
                </label>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={automations.rebook_enabled}
                    onChange={(e) => setAutomations({ ...automations, rebook_enabled: e.target.checked })}
                    className="w-4 h-4 accent-rose-800 mt-0.5" />
                  <span className="text-sm text-stone-700 leading-relaxed">
                    <strong className="text-stone-900">Nudge them for a fill</strong> when their set is due.
                    This one catches people at full price, before they drift far enough to need a discount.
                  </span>
                </label>
                <div className="pt-1">
                  <label className={labelCls}>Nudge After</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min={1} max={12}
                      value={automations.rebook_after_weeks}
                      onChange={(e) => setAutomations({ ...automations, rebook_after_weeks: e.target.value })}
                      className={`${inputCls} max-w-32`} />
                    <span className="text-sm text-stone-500">weeks after their last set</span>
                  </div>
                </div>
                <button onClick={saveAutomations} disabled={savingAutomations} className={btnPrimary}>
                  {savingAutomations ? "Saving..." : "SAVE"}
                </button>
              </div>
            </div>

            {/* Reactivation Offer */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Reactivation Offer</SectionHeading>
              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Percent Off</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={MIN_PERCENT}
                      max={MAX_PERCENT}
                      value={reactivationPercent}
                      onChange={(e) => setReactivationPercent(e.target.value)}
                      className={`${inputCls} max-w-32`}
                    />
                    <span className="text-sm text-stone-500">% off their next set</span>
                  </div>
                  <p className="text-xs text-stone-400 mt-2 leading-relaxed">
                    The discount in every reactivation text. Anything between {MIN_PERCENT}% and {MAX_PERCENT}%.
                    Codes already sent keep the percentage they were sent with.
                  </p>
                </div>
                <button onClick={saveReactivationPercent} disabled={savingPercent} className={btnPrimary}>
                  {savingPercent ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : "SAVE OFFER"}
                </button>
              </div>
            </div>

            {/* Promo Banner */}
            <div className="bg-white border border-stone-200 p-6">
              <SectionHeading>Promo Banner</SectionHeading>
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={promoEnabled} onChange={(e) => setPromoEnabled(e.target.checked)}
                    className="w-4 h-4 accent-rose-800" />
                  <span className="text-sm text-stone-700">Show promo banner on booking page</span>
                </label>
                <div>
                  <label className={labelCls}>Promo Message</label>
                  <input type="text" value={promoText} onChange={(e) => setPromoText(e.target.value)}
                    placeholder="e.g. 20% OFF all services this week!" className={inputCls} />
                  <p className="text-xs text-stone-400 mt-1">Appears at the top of your booking page when enabled.</p>
                </div>
                {promoEnabled && promoText && (
                  <div className="bg-rose-800 text-white p-3 text-center text-sm font-medium">
                    {promoText}
                  </div>
                )}
                <button onClick={savePromoSettings} disabled={savingPromo} className={btnPrimary}>
                  {savingPromo ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </span>
                  ) : "SAVE PROMO SETTINGS"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .stat-card {
          transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .stat-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .booking-card {
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .booking-card:hover {
          box-shadow: 0 4px 16px rgba(0,0,0,0.06);
        }
        .gallery-item {
          transition: box-shadow 0.2s ease;
        }
        .gallery-item:hover {
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }

        .calendar-container .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
        }
        .calendar-container .react-calendar__tile {
          border: 1px solid #e7e5e4 !important;
          background: white !important;
          padding: 10px !important;
          transition: all 0.15s !important;
          font-size: 13px;
          color: #57534e;
        }
        .calendar-container .react-calendar__tile:hover:enabled {
          background: #fafaf9 !important;
          border-color: #78716c !important;
        }
        .calendar-container .react-calendar__tile--now {
          background: #fafaf9 !important;
          font-weight: 600 !important;
        }
        .calendar-container .available-date {
          background: white !important;
          color: #1c1917 !important;
          font-weight: 700 !important;
          border-color: #9f1239 !important;
          border-width: 2px !important;
        }
        .calendar-container .react-calendar__tile:disabled {
          background: #fafaf9 !important;
          color: #d6d3d1 !important;
          border-color: #f5f5f4 !important;
          cursor: default !important;
        }
        .calendar-container .react-calendar__navigation {
          background: transparent !important;
          margin-bottom: 10px !important;
        }
        .calendar-container .react-calendar__navigation button {
          color: #1c1917 !important;
          font-weight: 600 !important;
          font-size: 14px;
        }
        .calendar-container .react-calendar__navigation button:hover {
          background: #fafaf9 !important;
        }
        .calendar-container .react-calendar__month-view__weekdays {
          font-weight: 600 !important;
          color: #78716c !important;
          font-size: 11px;
          text-transform: uppercase;
        }
        .calendar-container .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none !important;
        }
      `}</style>
    </main>
  );
}
