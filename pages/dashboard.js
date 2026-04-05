// pages/dashboard.js
import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import dynamic from "next/dynamic";
import "react-calendar/dist/Calendar.css";

const Calendar = dynamic(() => import("react-calendar"), { ssr: false });

const inputCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 placeholder-stone-400 bg-white text-sm";
const selectCls = "w-full px-4 py-3 border border-stone-300 focus:border-stone-900 focus:outline-none focus:ring-0 transition text-stone-900 bg-white text-sm";
const labelCls = "block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-2";
const btnPrimary = "bg-rose-800 hover:bg-rose-900 text-white px-6 py-3 font-medium text-sm tracking-wide transition disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed";
const btnSecondary = "border border-stone-300 text-stone-700 hover:border-stone-900 hover:text-stone-900 px-5 py-2.5 font-medium text-sm transition";

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
            {["N/A","Gel-X","Acrylic","Gel Manicure","Hard Gel","Builder Gel Manicure"].map(v => <option key={v}>{v}</option>)}
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
            {["N/A","Gel-X","Acrylic","Gel Manicure","Hard Gel","Builder Gel Manicure"].map(v => <option key={v}>{v}</option>)}
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

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await Promise.all([
          fetchGallery(), fetchAvailability(), fetchBookings(),
          fetchBio(), fetchScheduleSettings(),
        ]);
      }
      setReady(true);
    })();
  }, []);

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
    const { data, error } = await supabase.from("settings").select("bio, profile_picture_url, promo_text, promo_enabled").single();
    if (!error && data) {
      setBio(data.bio || "");
      setProfilePicPreview(data.profile_picture_url || null);
      setPromoText(data.promo_text || "");
      setPromoEnabled(data.promo_enabled || false);
    }
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
    const now = new Date();
    const upcoming = (data || []).filter((b) => {
      if (!b.date || !b.start_time) return false;
      const start = typeof b.start_time === "string" && b.start_time.includes("AM")
        ? convertTo24Hr(b.start_time) : b.start_time;
      return new Date(`${b.date}T${start}`).getTime() > now.getTime() - 5 * 60 * 1000;
    });
    setBookings(upcoming);
  }

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
                            <p className="text-xs text-stone-500">{b.service || "—"}</p>
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
                          <p className="text-xs text-stone-500">{b.service || "—"}</p>
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

                            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-sm">
                              {booking.service && booking.service !== "N/A" && (
                                <p className="text-stone-700"><span className="text-stone-400">Service: </span>{booking.service}</p>
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
                              <div className="flex gap-4">
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
