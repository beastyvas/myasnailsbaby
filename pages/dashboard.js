// pages/dashboard.jsx
import { useEffect, useState } from "react";
import { useRouter } from 'next/router';
import { supabase } from "@/utils/supabaseClient";
import dynamic from "next/dynamic";
import "react-calendar/dist/Calendar.css";

// Load react-calendar only on the client
const Calendar = dynamic(() => import("react-calendar"), { ssr: false });

// Edit Booking Form Component
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
    
    // Calculate end time based on start time + duration
    const [hour, minute] = formData.start_time.split(':');
    const endHour = parseInt(hour) + parseInt(formData.duration);
    const end_time = `${endHour.toString().padStart(2, '0')}:${minute || '00'}`;
    
    onSave({ ...formData, end_time });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
          <input
            type="text"
            value={formData.instagram}
            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
          <select
            value={formData.service}
            onChange={(e) => setFormData({ ...formData, service: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="N/A">N/A</option>
            <option value="Gel-X">Gel-X</option>
            <option value="Acrylic">Acrylic</option>
            <option value="Gel Manicure">Gel Manicure</option>
            <option value="Hard Gel">Hard Gel</option>
            <option value="Builder Gel Manicure">Builder Gel Manicure</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nail Art Level</label>
          <select
            value={formData.art_level}
            onChange={(e) => setFormData({ ...formData, art_level: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="">N/A</option>
            <option value="Level 1">Level 1</option>
            <option value="Level 2">Level 2</option>
            <option value="Level 3">Level 3</option>
            <option value="Level 4">Level 4</option>
            <option value="French Tips">French Tips</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
          <select
            value={formData.length}
            onChange={(e) => setFormData({ ...formData, length: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="">N/A</option>
            <option value="Small/Xtra Small">Short/Xtra Short</option>
            <option value="Medium">Medium</option>
            <option value="Large">Large</option>
            <option value="XL/XXL">XL/XXL</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Soak-Off</label>
          <select
            value={formData.soakoff}
            onChange={(e) => setFormData({ ...formData, soakoff: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="none">No Soak-Off</option>
            <option value="soak-off">Soak-Off</option>
            <option value="foreign">Foreign Soak-Off</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pedicure</label>
          <select
            value={formData.pedicure}
            onChange={(e) => setFormData({ ...formData, pedicure: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {formData.pedicure === "yes" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pedicure Type</label>
            <select
              value={formData.pedicure_type}
              onChange={(e) => setFormData({ ...formData, pedicure_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Select Type</option>
              <option value="Gel pedicure">Gel Pedicure</option>
              <option value="Gel pedciure + Acrylic big toes">Gel Pedicure + Acrylic big toes</option>
              <option value="Acrylic Pedicure">Acrylic Pedicure</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
          <input
            type="time"
            required
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
          <input
            type="number"
            min="1"
            max="5"
            required
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Returning Client</label>
          <select
            value={formData.returning}
            onChange={(e) => setFormData({ ...formData, returning: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="no">New Client</option>
            <option value="yes">Returning Client</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Paid Status</label>
          <select
            value={formData.paid ? "true" : "false"}
            onChange={(e) => setFormData({ ...formData, paid: e.target.value === "true" })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="false">Not Paid</option>
            <option value="true">Paid</option>
          </select>
        </div>
      </div>

      {formData.returning === "no" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referral</label>
          <input
            type="text"
            value={formData.referral}
            onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows="3"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
}

// New Appointment Form Component
function NewAppointmentForm({ onSuccess }) {
  const [formData, setFormData] = useState({
    name: "",
    instagram: "",
    phone: "",
    service: "",
    art_level: "",
    length: "",
    soakoff: "none",
    pedicure: "no",
    pedicure_type: "",
    date: "",
    start_time: "",
    duration: 2,
    notes: "",
    returning: "no",
    referral: "",
    paid: false,
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Calculate end time
    const [hour, minute] = formData.start_time.split(':');
    const endHour = parseInt(hour) + parseInt(formData.duration);
    const end_time = `${endHour.toString().padStart(2, '0')}:${minute || '00'}`;
    
    const { error } = await supabase.from("bookings").insert([
      {
        ...formData,
        end_time,
      },
    ]);

    if (error) {
      alert("❌ Failed to add appointment");
      console.error(error.message);
    } else {
      alert("✅ Appointment added successfully!");
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-pink-50 rounded-xl p-6 border border-pink-200">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
          <input
            type="text"
            value={formData.instagram}
            onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
          <select
            value={formData.service}
            onChange={(e) => setFormData({ ...formData, service: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="N/A">N/A</option>
            <option value="Gel-X">Gel-X</option>
            <option value="Acrylic">Acrylic</option>
            <option value="Gel Manicure">Gel Manicure</option>
            <option value="Hard Gel">Hard Gel</option>
            <option value="Builder Gel Manicure">Builder Gel Manicure</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nail Art Level</label>
          <select
            value={formData.art_level}
            onChange={(e) => setFormData({ ...formData, art_level: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="">N/A</option>
            <option value="Level 1">Level 1</option>
            <option value="Level 2">Level 2</option>
            <option value="Level 3">Level 3</option>
            <option value="Level 4">Level 4</option>
            <option value="French Tips">French Tips</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Length</label>
          <select
            value={formData.length}
            onChange={(e) => setFormData({ ...formData, length: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="">N/A</option>
            <option value="Small/Xtra Small">Short/Xtra Short</option>
            <option value="Medium">Medium</option>
            <option value="Large">Large</option>
            <option value="XL/XXL">XL/XXL</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Soak-Off</label>
          <select
            value={formData.soakoff}
            onChange={(e) => setFormData({ ...formData, soakoff: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="none">No Soak-Off</option>
            <option value="soak-off">Soak-Off</option>
            <option value="foreign">Foreign Soak-Off</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pedicure</label>
          <select
            value={formData.pedicure}
            onChange={(e) => setFormData({ ...formData, pedicure: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        {formData.pedicure === "yes" && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pedicure Type</label>
            <select
              value={formData.pedicure_type}
              onChange={(e) => setFormData({ ...formData, pedicure_type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
            >
              <option value="">Select Type</option>
              <option value="Gel pedicure">Gel Pedicure</option>
              <option value="Gel pedciure + Acrylic big toes">Gel Pedicure + Acrylic big toes</option>
              <option value="Acrylic Pedicure">Acrylic Pedicure</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
          <input
            type="time"
            required
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours) *</label>
          <input
            type="number"
            min="1"
            max="5"
            required
            value={formData.duration}
            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Returning Client</label>
          <select
            value={formData.returning}
            onChange={(e) => setFormData({ ...formData, returning: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          >
            <option value="no">New Client</option>
            <option value="yes">Returning Client</option>
          </select>
        </div>
      </div>

      {formData.returning === "no" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Referral</label>
          <input
            type="text"
            value={formData.referral}
            onChange={(e) => setFormData({ ...formData, referral: e.target.value })}
            placeholder="Who referred this client?"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows="3"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          placeholder="Any special notes or inspo details..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
        />
      </div>

      <div className="flex items-center space-x-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <span className="text-yellow-600">⚠️</span>
        <p className="text-sm text-yellow-800">
          New appointments are marked as <strong>NOT PAID</strong> by default. You can edit this later if payment is received.
        </p>
      </div>

      <button
        type="submit"
        className="w-full py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all font-semibold"
      >
        Add Appointment
      </button>
    </form>
  );
}

export default function Dashboard() {
  const router = useRouter();
  // -------- STATE (all hooks at the top, fixed order) --------
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

  const [selectedIds, setSelectedIds] = useState([]);

  const [scheduleSettings, setScheduleSettings] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [darkMode, setDarkMode] = useState(false);

  // -------- EFFECT: Load dark mode preference --------
  useEffect(() => {
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    }
  }, []);

  // -------- EFFECT: Save dark mode preference --------
  useEffect(() => {
    if (darkMode) {
      localStorage.setItem('darkMode', 'true');
      document.documentElement.classList.add('dark-mode');
    } else {
      localStorage.setItem('darkMode', 'false');
      document.documentElement.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // -------- EFFECT: wait for session, then load data --------
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // initial loads
        await Promise.all([
          fetchGallery(),
          fetchAvailability(),
          fetchBookings(),
          fetchBio(),
          fetchScheduleSettings(),
        ]);
      }
      setReady(true);
    })();
  }, []);

  // -------- RENDER GUARD --------
  if (!ready) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // -------- ACTIONS & HELPERS --------
  async function fetchBio() {
    const { data, error } = await supabase.from("settings").select("bio").single();
    if (error) {
      console.error("Error fetching bio:", error.message);
    } else {
      setBio(data?.bio || "");
    }
  }

  async function fetchScheduleSettings() {
    const { data, error } = await supabase
      .from("schedule_settings")
      .select("*")
      .order("day_of_week");
    
    if (error) {
      console.error("Error fetching schedule:", error.message);
    } else {
      setScheduleSettings(data || []);
    }
  }

  const saveScheduleSettings = async () => {
    setSavingSchedule(true);
    
    // Update each day's settings
    const updates = scheduleSettings.map(day => 
      supabase
        .from("schedule_settings")
        .update({
          is_open: day.is_open,
          start_time: day.start_time,
          end_time: day.end_time,
        })
        .eq("day_of_week", day.day_of_week)
    );

    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);

    setSavingSchedule(false);
    
    if (hasError) {
      alert("Failed to save schedule settings.");
      console.error("Schedule update errors:", results.filter(r => r.error));
    } else {
      alert("✅ Schedule settings saved! Use 'Generate Availability' to apply to future dates.");
    }
  };

  const saveBio = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .update({ bio })
      .eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9");
    setSaving(false);
    if (error) {
      alert("Failed to save bio.");
      console.error("Bio update error:", error.message);
    } else {
      alert("Bio updated!");
    }
  };

  async function fetchGallery() {
    const { data, error } = await supabase
      .from("gallery")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch gallery error:", error.message);
    else setGallery(data || []);
  }

  async function fetchAvailability() {
    const { data, error } = await supabase
      .from("availability")
      .select("*")
      .order("date");
    if (error) console.error("Fetch availability error:", error.message);
    else setAvailability(data || []);
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
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      console.error("Error fetching bookings:", error.message);
      return;
    }

    const now = new Date();
    const upcoming = (data || []).filter((b) => {
      if (!b.date || !b.start_time) return false;
      const start = typeof b.start_time === "string" && b.start_time.includes("AM")
        ? convertTo24Hr(b.start_time)
        : b.start_time;
      const ts = new Date(`${b.date}T${start}`);
      return ts.getTime() > now.getTime() - 5 * 60 * 1000;
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
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
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
    if (!preview || !caption) {
      alert("Please choose a photo and enter a name for the set!");
      return;
    }
    const file = dataURLtoFile(preview, `${caption}.png`);
    const filePath = `nails/${caption}-${Date.now()}.png`;

    const { error: uploadError } = await supabase.storage
      .from("gallery")
      .upload(filePath, file);
    if (uploadError) {
      console.error("Upload error:", uploadError.message);
      alert("Upload failed 😢");
      return;
    }

    const { error: insertError } = await supabase
      .from("gallery")
      .insert({ image_url: filePath, caption });
    if (insertError) {
      console.error("DB insert error:", insertError.message);
      alert("Upload succeeded, but saving the caption failed 😢");
      return;
    }

    alert("Upload successful! 🥳");
    setPreview(null);
    setCaption("");
    fetchGallery();
  }

  const handleAddSlot = async (e) => {
    e.preventDefault();
    if (!selectedDate || !newSlot.start || !newSlot.end) {
      alert("Please select a date and time.");
      return;
    }
    const isoDate = new Date(selectedDate).toISOString().split("T")[0];
    const { error } = await supabase.from("availability").insert({
      date: isoDate,
      start_time: newSlot.start,
      end_time: newSlot.end,
    });
    if (error) {
      console.error("Add slot error:", error.message);
      alert("Failed to add slot.");
    } else {
      setNewSlot({ start: "", end: "" });
      fetchAvailability();
    }
  };

  async function handleDeleteImage(item) {
    const confirm = window.confirm("Are you sure you want to delete this set?");
    if (!confirm) return;

    const { error: deleteError } = await supabase
      .storage
      .from("gallery")
      .remove([item.image_url]);

    if (deleteError) {
      alert("Delete failed 😢");
      console.error("Delete error:", deleteError.message);
      return;
    }

    const { error: dbError } = await supabase
      .from("gallery")
      .delete()
      .eq("id", item.id);

    if (dbError) {
      alert("Deleted from storage but not DB 😢");
      console.error("DB delete error:", dbError.message);
      return;
    }

    setGallery((prev) => prev.filter((g) => g.id !== item.id));
    alert("Deleted successfully 🗑️");
  }

  function toggleSelected(id) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleDeleteSelected() {
    const ok = confirm(`Delete ${selectedIds.length} selected availability slot(s)?`);
    if (!ok) return;
    const { error } = await supabase.from("availability").delete().in("id", selectedIds);
    if (error) {
      console.error("Bulk delete error:", error.message);
      alert("Failed to delete selected slots.");
    } else {
      setSelectedIds([]);
      fetchAvailability();
    }
  }

  const generateMonthAvailability = async () => {
    // Fetch current schedule settings
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedule_settings")
      .select("*")
      .order("day_of_week");

    if (scheduleError || !schedule) {
      alert("❌ Failed to load schedule settings");
      console.error("Schedule fetch error:", scheduleError);
      return;
    }

    const inserts = [];
    const year = selectedYear;
    const month = selectedMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dow = date.getDay(); // 0=Sunday, 1=Monday, etc.
      const iso = date.toISOString().split("T")[0];
      
      // Find the schedule for this day of week
      const daySchedule = schedule.find(s => s.day_of_week === dow);
      
      if (!daySchedule || !daySchedule.is_open) {
        continue; // Skip closed days
      }
      
      inserts.push({ 
        date: iso, 
        start_time: daySchedule.start_time, 
        end_time: daySchedule.end_time 
      });
    }

    if (inserts.length === 0) {
      alert("⚠️ No availability to generate (all days closed?)");
      return;
    }

    const { error } = await supabase.from("availability").insert(inserts);
    if (error) {
      console.error("Insert error:", error.message);
      alert("❌ Failed to insert slots.");
    } else {
      alert(`✅ Generated ${inserts.length} availability slots!`);
      fetchAvailability();
    }
  };

  const handleDeleteBooking = async (booking) => {
    const confirmDelete = confirm("Are you sure you want to delete this appointment?");
    if (!confirmDelete) return;
    
    const { error } = await supabase.from("bookings").delete().eq("id", booking.id);
    if (error) {
      alert("Failed to delete appointment");
      console.error("Delete error:", error.message);
    } else {
      alert("Appointment deleted successfully");
      fetchBookings();
    }
  };

  const handleUpdateBooking = async (updatedData) => {
    const { error } = await supabase
      .from("bookings")
      .update(updatedData)
      .eq("id", editingBooking.id);

    if (error) {
      alert("❌ Failed to update appointment");
      console.error("Update error:", error.message);
    } else {
      alert("✅ Appointment updated successfully!");
      setEditingBooking(null);
      fetchBookings();
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: "📊" },
    { id: "appointments", label: "Appointments", icon: "📅" },
    { id: "gallery", label: "Gallery", icon: "🖼️" },
    { id: "availability", label: "Availability", icon: "⏰" },
    { id: "schedule", label: "Schedule", icon: "📆" },
    { id: "settings", label: "Settings", icon: "⚙️" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-2xl">💅</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                  Mya's Dashboard
                </h1>
                <p className="text-sm text-gray-600">Manage your nail salon</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2 rounded-lg hover:bg-gray-100 dark-mode-hover transition-colors"
                title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              >
                {darkMode ? (
                  <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  window.location.href = '/login';
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark-mode-text hover:text-gray-900 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-white/50 backdrop-blur-sm rounded-2xl p-1 shadow-lg border border-white/20 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center justify-center space-x-2 px-3 sm:px-4 py-3 rounded-xl font-medium transition-all duration-200 min-w-0 ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                }`}
              >
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                    <p className="text-3xl font-bold text-pink-600">
                      {bookings.filter(b => b.date === new Date().toISOString().split('T')[0]).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📅</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">This Week</p>
                    <p className="text-3xl font-bold text-rose-600">
                      {(() => {
                        const now = new Date();
                        const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                        const weekEnd = new Date(now.setDate(now.getDate() - now.getDay() + 6));
                        return bookings.filter(b => {
                          const bookingDate = new Date(b.date);
                          return bookingDate >= weekStart && bookingDate <= weekEnd;
                        }).length;
                      })()}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-rose-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Gallery Items</p>
                    <p className="text-3xl font-bold text-purple-600">{gallery.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">🖼️</span>
                  </div>
                </div>
              </div>

              <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Available Slots</p>
                    <p className="text-3xl font-bold text-green-600">{availability.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⏰</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Today's Schedule */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Today's Schedule</h2>
              <div className="space-y-4">
                {(() => {
                  const today = new Date().toISOString().split('T')[0];
                  const todaysBookings = bookings
                    .filter(b => b.date === today)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time));
                  
                  if (todaysBookings.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <span className="text-2xl">☀️</span>
                        </div>
                        <p className="text-gray-500">No appointments scheduled for today</p>
                      </div>
                    );
                  }
                  
                  return todaysBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl border border-pink-100">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-pink-500 text-white rounded-full flex items-center justify-center font-semibold">
                          {booking.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-800">{booking.name}</p>
                          <p className="text-sm text-gray-600">{booking.service}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-800">{formatTime(booking.start_time)}</p>
                        <p className="text-sm text-gray-600">{booking.duration}h appointment</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  onClick={() => setActiveTab("appointments")}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white p-4 rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all duration-200"
                >
                  <span>📅</span>
                  <span className="font-medium">View Appointments</span>
                </button>
                <button
                  onClick={() => setActiveTab("gallery")}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-xl hover:from-purple-600 hover:to-pink-600 transition-all duration-200"
                >
                  <span>🖼️</span>
                  <span className="font-medium">Manage Gallery</span>
                </button>
                <button
                  onClick={() => setActiveTab("availability")}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-green-500 to-teal-500 text-white p-4 rounded-xl hover:from-green-600 hover:to-teal-600 transition-all duration-200"
                >
                  <span>⏰</span>
                  <span className="font-medium">Set Availability</span>
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className="flex items-center justify-center space-x-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white p-4 rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200"
                >
                  <span>⚙️</span>
                  <span className="font-medium">Edit Bio</span>
                </button>
              </div>
            </div>

            {/* Next Few Days Preview */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Upcoming This Week</h2>
              <div className="space-y-3">
                {(() => {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const nextWeek = new Date();
                  nextWeek.setDate(nextWeek.getDate() + 7);
                  
                  const upcomingBookings = bookings
                    .filter(b => {
                      const bookingDate = new Date(b.date + 'T00:00:00');
                      return bookingDate >= tomorrow && bookingDate < nextWeek;
                    })
                    .slice(0, 5);
                  
                  if (upcomingBookings.length === 0) {
                    return (
                      <p className="text-gray-500 text-center py-4">No upcoming appointments this week</p>
                    );
                  }
                  
                  return upcomingBookings.map((booking) => (
                    <div key={booking.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold text-gray-800">{booking.name}</p>
                        <p className="text-sm text-gray-600">{booking.service}</p>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium text-gray-800">{new Date(booking.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                        <p className="text-gray-600">{formatTime(booking.start_time)}</p>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>
        )}

        {activeTab === "appointments" && (
          <div className="space-y-6">
            {/* Add New Appointment - MOVED TO TOP */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-800">Add New Appointment</h3>
                <button
                  onClick={() => setShowNewAppointmentForm(!showNewAppointmentForm)}
                  className="text-pink-500 hover:text-pink-700 font-medium transition-colors"
                >
                  {showNewAppointmentForm ? "Cancel" : "+ Add Appointment"}
                </button>
              </div>

              {showNewAppointmentForm && (
                <NewAppointmentForm 
                  onSuccess={() => {
                    setShowNewAppointmentForm(false);
                    fetchBookings();
                  }}
                />
              )}
            </div>

            {/* Existing Appointments */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Upcoming Appointments</h2>
                <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">
                  {bookings.length} appointments
                </span>
              </div>

              <div className="space-y-4">
                {bookings.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl">📅</span>
                    </div>
                    <p className="text-gray-500">No upcoming appointments yet.</p>
                  </div>
                ) : (
                  bookings.map((booking) => {
                    const isVerified = booking.returning === "yes";
                    const editingThis = editingBooking?.id === booking.id;
                    
                    return (
                      <div key={booking.id} className="bg-gradient-to-r from-white to-pink-50 rounded-xl p-6 shadow-sm border border-pink-100">
                        {!editingThis ? (
                          <>
                            <div className="flex justify-between items-start mb-4">
                              <div>
                                <h3 className="text-xl font-bold text-gray-800">{booking.name}</h3>
                                {booking.instagram && (
                                  <p className="text-sm text-gray-600 mt-1">📸 @{booking.instagram}</p>
                                )}
                                {booking.phone && (
                                  <p className="text-sm text-gray-600">📞 {booking.phone}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium text-gray-800">{booking.date}</p>
                                <p className="text-sm text-gray-600">{formatTimeRange(booking.start_time, booking.end_time)}</p>
                                <p className="text-xs text-gray-500 mt-1">{booking.duration}h appointment</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div className="space-y-2">
                                {booking.service && booking.service !== "N/A" && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-pink-500">💅</span>
                                    <span className="text-sm text-gray-700">{booking.service}</span>
                                  </div>
                                )}
                                {booking.art_level && booking.art_level !== "N/A" && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-purple-500">🎨</span>
                                    <span className="text-sm text-gray-700">Nail Art: {booking.art_level}</span>
                                  </div>
                                )}
                                {booking.length && booking.length !== "N/A" && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-blue-500">📏</span>
                                    <span className="text-sm text-gray-700">Length: {booking.length}</span>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-2">
                                {booking.soakoff && booking.soakoff !== "N/A" && booking.soakoff !== "none" && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-orange-500">🧽</span>
                                    <span className="text-sm text-gray-700">Soak-Off: {booking.soakoff}</span>
                                  </div>
                                )}
                                {booking.pedicure === "yes" && (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-green-500">🦶</span>
                                    <span className="text-sm text-gray-700">Pedicure: {booking.pedicure_type || "Standard"}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {booking.notes && (
                              <div className="mb-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                                <p className="text-sm text-gray-700"><strong>Notes:</strong> {booking.notes}</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-4">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  booking.paid ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                }`}>
                                  {booking.paid ? "✓ Paid" : "✗ Not Paid"}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  isVerified ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                                }`}>
                                  {isVerified ? "✓ Verified" : "⚠ New Client"}
                                </span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => setEditingBooking(booking)}
                                  className="text-blue-500 hover:text-blue-700 text-sm font-medium transition-colors"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteBooking(booking)}
                                  className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {!isVerified && booking.referral?.trim() && booking.referral !== "MANUAL BLOCK" && (
                              <div className="mt-3 pt-3 border-t border-pink-100">
                                <p className="text-sm text-gray-500 italic">Referred by: {booking.referral}</p>
                              </div>
                            )}
                          </>
                        ) : (
                          <EditBookingForm 
                            booking={editingBooking}
                            onSave={handleUpdateBooking}
                            onCancel={() => setEditingBooking(null)}
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "gallery" && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Upload New Set</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Choose Photo</label>
                  <label className="cursor-pointer">
                    <div className="border-2 border-dashed border-pink-300 rounded-xl p-8 text-center hover:border-pink-400 hover:bg-pink-50 transition-all duration-200">
                      <div className="w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-700">Click to upload photo</p>
                      <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                    </div>
                    <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Set Name</label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="e.g. Valentine's Bling 💘"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-600"
                  />
                </div>

                {preview && (
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-200">
                    <p className="text-sm font-medium text-gray-800 mb-3">Preview:</p>
                    <div className="relative">
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full max-h-80 object-cover rounded-xl shadow-lg"
                      />
                      <div className="absolute bottom-4 left-4 bg-black/80 text-white px-3 py-1 rounded-lg text-sm font-medium">
                        {caption || "Untitled Set"}
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!preview || !caption}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
                >
                  Upload Set ✨
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Your Gallery</h2>
                <span className="px-3 py-1 bg-pink-100 text-pink-800 rounded-full text-sm font-medium">
                  {gallery.length} sets
                </span>
              </div>

              {gallery.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl">🖼️</span>
                  </div>
                  <p className="text-gray-500">No gallery items yet. Upload your first set!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {gallery.map((item) => (
                    <div key={item.id} className="group relative bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
                      <div className="relative">
                        <img
                          src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${item.image_url}`}
                          alt={item.caption}
                          className="w-full h-48 object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <button
                          onClick={() => handleDeleteImage(item)}
                          className="absolute top-3 right-3 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="p-4">
                        <p className="font-medium text-gray-900 truncate">{item.caption}</p>
                        <p className="text-xs text-gray-700 mt-1">
                          {new Date(item.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "availability" && (
          <div className="space-y-6">
            {/* Month Generator */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Generate Monthly Availability</h2>
              
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent text-gray-900"
                  >
                    {[
                      "January", "February", "March", "April", "May", "June",
                      "July", "August", "September", "October", "November", "December",
                    ].map((month, idx) => (
                      <option key={idx} value={idx}>{month}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    {Array.from({ length: 3 }, (_, i) => new Date().getFullYear() + i).map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={generateMonthAvailability}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-rose-600 transition-all duration-200 shadow-lg"
                >
                  Generate Availability 🗓️
                </button>
              </div>

              <div className="mt-4 p-4 bg-pink-50 rounded-xl border border-pink-200">
                <p className="text-sm text-pink-800">
                  <strong>💡 Tip:</strong> Your weekly schedule is set in the <strong>Schedule</strong> tab. 
                  Click "Generate Availability" to apply your current schedule settings to the selected month.
                </p>
              </div>
            </div>

            {/* Calendar */}
            <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Availability Calendar</h2>
              
              <div className="calendar-container">
                <Calendar
                  value={selectedDate ? new Date(selectedDate + "T00:00:00") : null}
                  onChange={(date) => {
                    const iso = date.toISOString().split("T")[0];
                    setSelectedDate(iso);
                  }}
                  tileClassName={({ date }) => {
                    const iso = date.toISOString().split("T")[0];
                    const isAvailable = availability.some((a) => a.date === iso);
                    return isAvailable ? "available-date" : "";
                  }}
                  calendarType="US"
                  className="w-full border-none"
                />
              </div>

              {/* Add new slot form */}
              {selectedDate && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Add Time Slot for {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  
                  <form onSubmit={handleAddSlot} className="flex flex-wrap gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                      <input
                        type="time"
                        required
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-gray-900"
                        value={newSlot.start}
                        onChange={(e) => setNewSlot((prev) => ({ ...prev, start: e.target.value }))}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                      <input
                        type="time"
                        required
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-gray-900"
                        value={newSlot.end}
                        onChange={(e) => setNewSlot((prev) => ({ ...prev, end: e.target.value }))}
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-pink-600 hover:to-rose-600 transition-all duration-200"
                    >
                      Add Slot
                    </button>
                  </form>
                </div>
              )}

              {/* Available slots for selected date */}
              {selectedDate && (
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Available Times</h3>
                  
                  <div className="space-y-2">
                    {availability
                      .filter((slot) => slot.date === selectedDate)
                      .map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-200 rounded-xl px-4 py-3"
                        >
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(slot.id)}
                              onChange={() => toggleSelected(slot.id)}
                              className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                            />
                            <span className="font-medium text-gray-900">
                              {formatTime(slot.start_time)} → {formatTime(slot.end_time)}
                            </span>
                          </div>
                          
                          <button
                            onClick={async () => {
                              const confirmDelete = confirm("Delete this slot?");
                              if (!confirmDelete) return;
                              const { error } = await supabase.from("availability").delete().eq("id", slot.id);
                              if (error) {
                                alert("Failed to delete slot.");
                              } else {
                                fetchAvailability();
                              }
                            }}
                            className="text-red-500 hover:text-red-700 text-sm font-medium transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    
                    {availability.filter((slot) => slot.date === selectedDate).length === 0 && (
                      <p className="text-gray-500 text-center py-4">No times available for this day</p>
                    )}
                  </div>

                  {selectedIds.length > 0 && (
                    <button
                      onClick={handleDeleteSelected}
                      className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors"
                    >
                      Delete Selected ({selectedIds.length})
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Weekly Schedule Settings</h2>
              <p className="text-sm text-gray-600">
                Set your default working hours for each day. These settings will be used when generating new availability slots.
              </p>
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  ⚠️ <strong>Note:</strong> Changing these settings only affects <strong>future availability generation</strong>. 
                  Existing availability slots and appointments will not be changed automatically.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {scheduleSettings.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading schedule...</p>
                </div>
              ) : (
                scheduleSettings.map((day, index) => {
                  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                  const dayName = dayNames[day.day_of_week];
                  
                  return (
                    <div key={day.day_of_week} className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-5 border border-pink-200">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Day Name */}
                        <div className="w-32">
                          <h3 className="text-lg font-bold text-gray-800">{dayName}</h3>
                        </div>

                        {/* Open/Closed Toggle */}
                        <div className="flex items-center space-x-3">
                          <label className="flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              checked={day.is_open}
                              onChange={(e) => {
                                const updated = [...scheduleSettings];
                                updated[index].is_open = e.target.checked;
                                setScheduleSettings(updated);
                              }}
                              className="w-5 h-5 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                            />
                            <span className="ml-2 text-sm font-medium text-gray-700">
                              {day.is_open ? 'Open' : 'Closed'}
                            </span>
                          </label>
                        </div>

                        {/* Time Inputs */}
                        {day.is_open && (
                          <>
                            <div className="flex items-center space-x-2">
                              <label className="text-sm font-medium text-gray-700">From:</label>
                              <input
                                type="time"
                                value={day.start_time}
                                onChange={(e) => {
                                  const updated = [...scheduleSettings];
                                  updated[index].start_time = e.target.value;
                                  setScheduleSettings(updated);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 text-gray-900"
                              />
                            </div>

                            <div className="flex items-center space-x-2">
                              <label className="text-sm font-medium text-gray-700">To:</label>
                              <input
                                type="time"
                                value={day.end_time}
                                onChange={(e) => {
                                  const updated = [...scheduleSettings];
                                  updated[index].end_time = e.target.value;
                                  setScheduleSettings(updated);
                                }}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 text-gray-900"
                              />
                            </div>

                            <div className="text-sm text-gray-600 hidden sm:block">
                              ({formatTime(day.start_time)} - {formatTime(day.end_time)})
                            </div>
                          </>
                        )}

                        {!day.is_open && (
                          <div className="text-sm text-gray-500 italic">No hours set</div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => fetchScheduleSettings()}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-gray-700"
              >
                Reset Changes
              </button>
              
              <button
                onClick={saveScheduleSettings}
                disabled={savingSchedule}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {savingSchedule ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  "Save Schedule Settings"
                )}
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">💡 How It Works:</h3>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Adjust your hours for each day of the week above</li>
                <li>Click "Save Schedule Settings" to store your changes</li>
                <li>Go to the <strong>Availability</strong> tab and click "Generate Availability"</li>
                <li>Your new schedule will be applied to all generated slots</li>
              </ol>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-white/20">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Bio Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Booking Page Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all duration-200 resize-none text-gray-900 placeholder-gray-500"
                  placeholder="Enter the bio that will appear on your booking page..."
                />
              </div>
              
              <button
                onClick={saveBio}
                disabled={saving}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {saving ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Saving...</span>
                  </div>
                ) : (
                  "Save Bio"
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Styles */}
      <style jsx global>{`
        .calendar-container .react-calendar {
          border: none !important;
          font-family: inherit;
          width: 100%;
        }
        
        .calendar-container .react-calendar__tile {
          border-radius: 8px !important;
          border: none !important;
          background: transparent !important;
          padding: 12px !important;
          transition: all 0.2s ease !important;
        }
        
        .calendar-container .react-calendar__tile:hover {
          background: rgb(249 168 212 / 0.3) !important;
          transform: scale(1.05);
        }
        
        .calendar-container .react-calendar__tile--now {
          background: rgb(244 114 182 / 0.2) !important;
          font-weight: bold !important;
        }
        
        .calendar-container .available-date {
          background: rgb(244 114 182 / 0.4) !important;
          color: rgb(159 18 57) !important;
          font-weight: 600 !important;
        }
        
        .calendar-container .react-calendar__navigation {
          background: rgb(244 114 182 / 0.1) !important;
          border-radius: 12px !important;
          margin-bottom: 16px !important;
        }
        
        .calendar-container .react-calendar__navigation button {
          color: rgb(159 18 57) !important;
          font-weight: 600 !important;
          border-radius: 8px !important;
        }
        
        .calendar-container .react-calendar__navigation button:hover {
          background: rgb(244 114 182 / 0.2) !important;
        }
        
        .calendar-container .react-calendar__month-view__weekdays {
          font-weight: 600 !important;
          color: rgb(107 114 128) !important;
        }

        /* Make all form input text dark and readable */
        input[type="text"],
        input[type="tel"],
        input[type="date"],
        input[type="time"],
        input[type="number"],
        select,
        textarea {
          color: #111827 !important;
          font-weight: 500 !important;
        }

        input::placeholder,
        textarea::placeholder {
          color: #9ca3af !important;
        }

        select option {
          color: #111827 !important;
        }

        /* ===== DARK MODE STYLES ===== */
        .dark-mode {
          /* Main backgrounds */
          background: linear-gradient(to bottom right, #1e1b4b, #312e81, #4c1d95) !important;
        }

        .dark-mode main {
          background: linear-gradient(to bottom right, #1e1b4b, #312e81, #4c1d95) !important;
        }

        /* Loading screen */
        .dark-mode .min-h-screen {
          background: linear-gradient(to bottom right, #1e1b4b, #312e81, #4c1d95) !important;
        }

        /* Header */
        .dark-mode .bg-white\/70 {
          background: rgba(30, 27, 75, 0.9) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* Cards and panels */
        .dark-mode .bg-white\/70.backdrop-blur-xl,
        .dark-mode .bg-white {
          background: rgba(30, 27, 75, 0.7) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* Tab navigation */
        .dark-mode .bg-white\/50 {
          background: rgba(30, 27, 75, 0.6) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
        }

        /* Text colors */
        .dark-mode .text-gray-800,
        .dark-mode .text-gray-900,
        .dark-mode .text-gray-700 {
          color: #f1f5f9 !important;
        }

        .dark-mode .text-gray-600 {
          color: #cbd5e1 !important;
        }

        .dark-mode .text-gray-500 {
          color: #94a3b8 !important;
        }

        /* Form inputs in dark mode */
        .dark-mode input[type="text"],
        .dark-mode input[type="tel"],
        .dark-mode input[type="date"],
        .dark-mode input[type="time"],
        .dark-mode input[type="number"],
        .dark-mode input[type="email"],
        .dark-mode input[type="password"],
        .dark-mode input[type="checkbox"],
        .dark-mode select,
        .dark-mode textarea {
          background: rgba(51, 65, 85, 0.5) !important;
          border-color: rgba(148, 163, 184, 0.3) !important;
          color: #f1f5f9 !important;
        }

        .dark-mode input::placeholder,
        .dark-mode textarea::placeholder {
          color: #94a3b8 !important;
        }

        .dark-mode select option {
          background: #1e293b !important;
          color: #f1f5f9 !important;
        }

        /* Buttons */
        .dark-mode button:not(.bg-gradient-to-r):not([class*="from-"]) {
          color: #f1f5f9 !important;
        }

        .dark-mode .hover\:bg-gray-50:hover {
          background: rgba(51, 65, 85, 0.5) !important;
        }

        .dark-mode .dark-mode-hover:hover {
          background: rgba(51, 65, 85, 0.5) !important;
        }

        .dark-mode .dark-mode-text {
          color: #f1f5f9 !important;
        }

        /* Stat cards */
        .dark-mode .bg-pink-100,
        .dark-mode .bg-rose-100,
        .dark-mode .bg-purple-100,
        .dark-mode .bg-green-100 {
          background: rgba(236, 72, 153, 0.2) !important;
        }

        /* Gradient backgrounds for appointment cards */
        .dark-mode .bg-gradient-to-r.from-white,
        .dark-mode .bg-gradient-to-r.from-pink-50,
        .dark-mode .bg-gradient-to-r.from-gray-50 {
          background: linear-gradient(to right, rgba(30, 27, 75, 0.7), rgba(49, 46, 129, 0.7)) !important;
        }

        /* Alert/Info boxes */
        .dark-mode .bg-yellow-50 {
          background: rgba(251, 191, 36, 0.15) !important;
          border-color: rgba(251, 191, 36, 0.3) !important;
        }

        .dark-mode .text-yellow-800,
        .dark-mode .text-yellow-600 {
          color: #fde047 !important;
        }

        .dark-mode .bg-blue-50 {
          background: rgba(59, 130, 246, 0.15) !important;
          border-color: rgba(59, 130, 246, 0.3) !important;
        }

        .dark-mode .text-blue-800,
        .dark-mode .text-blue-900 {
          color: #93c5fd !important;
        }

        .dark-mode .bg-pink-50,
        .dark-mode .bg-rose-50 {
          background: rgba(236, 72, 153, 0.15) !important;
          border-color: rgba(236, 72, 153, 0.3) !important;
        }

        .dark-mode .text-pink-800 {
          color: #f9a8d4 !important;
        }

        .dark-mode .bg-gray-50 {
          background: rgba(51, 65, 85, 0.3) !important;
        }

        .dark-mode .bg-gray-100 {
          background: rgba(51, 65, 85, 0.5) !important;
        }

        /* Badge colors */
        .dark-mode .bg-green-100.text-green-800 {
          background: rgba(34, 197, 94, 0.2) !important;
          color: #86efac !important;
        }

        .dark-mode .bg-red-100.text-red-800 {
          background: rgba(239, 68, 68, 0.2) !important;
          color: #fca5a5 !important;
        }

        .dark-mode .bg-orange-100.text-orange-800 {
          background: rgba(249, 115, 22, 0.2) !important;
          color: #fdba74 !important;
        }

        .dark-mode .bg-pink-100.text-pink-800 {
          background: rgba(236, 72, 153, 0.2) !important;
          color: #f9a8d4 !important;
        }

        /* Border colors */
        .dark-mode .border-gray-200,
        .dark-mode .border-gray-300 {
          border-color: rgba(148, 163, 184, 0.3) !important;
        }

        .dark-mode .border-pink-100,
        .dark-mode .border-pink-200 {
          border-color: rgba(236, 72, 153, 0.3) !important;
        }

        /* Tab buttons */
        .dark-mode button:not(.bg-gradient-to-r) {
          background: transparent !important;
        }

        .dark-mode button:not(.bg-gradient-to-r):hover {
          background: rgba(51, 65, 85, 0.5) !important;
        }

        /* Calendar in dark mode */
        .dark-mode .calendar-container .react-calendar {
          background: rgba(30, 27, 75, 0.7) !important;
          color: #f1f5f9 !important;
        }

        .dark-mode .calendar-container .react-calendar__tile {
          color: #f1f5f9 !important;
        }

        .dark-mode .calendar-container .react-calendar__tile:hover {
          background: rgba(236, 72, 153, 0.3) !important;
        }

        .dark-mode .calendar-container .react-calendar__navigation {
          background: rgba(236, 72, 153, 0.2) !important;
        }

        .dark-mode .calendar-container .react-calendar__navigation button {
          color: #f9a8d4 !important;
        }

        /* IMPORTANT: Keep available dates visible in dark mode */
        .dark-mode .calendar-container .available-date {
          background: rgba(236, 72, 153, 0.6) !important;
          color: #fce7f3 !important;
          font-weight: 600 !important;
        }

        .dark-mode .calendar-container .react-calendar__tile--now {
          background: rgba(236, 72, 153, 0.3) !important;
          font-weight: bold !important;
          color: #f9a8d4 !important;
        }

        .dark-mode .calendar-container .react-calendar__month-view__weekdays {
          color: #cbd5e1 !important;
        }

        /* Keep gradients vibrant in dark mode */
        .dark-mode .bg-gradient-to-r.from-pink-500,
        .dark-mode .bg-gradient-to-r.from-purple-500,
        .dark-mode .bg-gradient-to-r.from-green-500,
        .dark-mode .bg-gradient-to-r.from-gray-500,
        .dark-mode .bg-gradient-to-r.from-gray-700 {
          /* Keep original gradient colors */
          filter: brightness(1.1) !important;
        }
      `}</style>
    </main>
  );
}