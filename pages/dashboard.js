import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";



export default function Dashboard() {
  const [pin, setPin] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [gallery, setGallery] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [bookings, setBookings] = useState([]);

  const correctPin = "052224";

  function handleSubmit(e) {
    e.preventDefault();
    if (pin === correctPin) {
      setIsVerified(true);
      fetchGallery();
      fetchAvailability();
      fetchBookings();
    } else {
      alert("Wrong pin babe 💅");
    }
  }
const [selectedDate, setSelectedDate] = useState(null);

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setPreview(reader.result);
    reader.readAsDataURL(file);
  }
const [bio, setBio] = useState("");
const [saving, setSaving] = useState(false);

useEffect(() => {
  const fetchBio = async () => {
    const { data, error } = await supabase.from("settings").select("bio").single();
    if (error) {
      console.error("Error fetching bio:", error.message);
    } else {
      setBio(data.bio || "");
    }
  };

  fetchBio();
}, []);

const saveBio = async () => {
  setSaving(true);
  const { error } = await supabase
    .from("settings")
    .update({ bio })
    .eq("id", "c5d1931e-8603-4f6e-ac4e-e6cf6bd839a9"); // ✅ match your Supabase row
  setSaving(false);
  if (error) {
    alert("Failed to save bio.");
    console.error("Bio update error:", error.message);
  } else {
    alert("Bio updated!");
  }
};

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

    const { error: insertError } = await supabase.from("gallery").insert({
      image_url: filePath,
      caption,
    });

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

  async function fetchGallery() {
    const { data, error } = await supabase
      .from("gallery")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) console.error("Fetch error:", error.message);
    else setGallery(data);
  }

  async function fetchAvailability() {
    const { data, error } = await supabase
      .from("availability")
      .select("*")
      .order("date", { ascending: true });
    if (error) console.error("Error fetching availability:", error.message);
    else setAvailability(data);
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
const upcoming = data.filter((booking) => {
  if (!booking.date || !booking.time) return false;

  const bookingDateTime = new Date(`${booking.date}T${convertTo24Hr(booking.time)}`);
  return bookingDateTime.getTime() > now.getTime() - 5 * 60 * 1000;
});


  setBookings(upcoming);
}
const handleDeleteBooking = async (booking) => {
  const confirmed = window.confirm("Are you sure you want to cancel this appointment?");
  if (!confirmed) return;

  const { id, name, phone, date, time } = booking;

  const { error } = await supabase.from("bookings").delete().eq("id", id);
  if (error) {
    console.error("❌ Delete failed:", error.message);
    alert("Could not delete appointment.");
    return;
  }

  try {
    await fetch("/api/send-cancel-text", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, date, time }),
    });

    alert("Appointment deleted and client informed!");
    await fetchBookings(); // ✅ refresh dashboard
  } catch (err) {
    console.error("❌ Failed to send cancel text:", err);
    alert("Deleted, but failed to notify client.");
    await fetchBookings(); // still refresh
  }
};



function convertTo24Hr(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return "00:00";

  const match = timeStr.match(/^(\d{1,2}):?(\d{2})?\s*(AM|PM)$/i);
  if (!match) return "00:00";

  let [_, hourStr, minuteStr, modifier] = match;
  let hour = parseInt(hourStr, 10);
  let minutes = parseInt(minuteStr || "00", 10);

  if (modifier.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (modifier.toUpperCase() === "AM" && hour === 12) hour = 0;

  return `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}




  async function handleDelete(item) {
    const { error } = await supabase
      .from("gallery")
      .delete()
      .eq("id", item.id);

    if (error) {
      console.error("Delete failed:", error.message);
      alert("Failed to delete image");
    } else {
      alert("Deleted successfully! 🗑️");
      setGallery((prev) => prev.filter((g) => g.id !== item.id));
    }
  }

  const [selectedIds, setSelectedIds] = useState([]);

function toggleSelected(id) {
  setSelectedIds((prev) =>
    prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
  );
}

async function handleDeleteSelected() {
  const confirmDelete = confirm(
    `Delete ${selectedIds.length} selected availability slot(s)?`
  );
  if (!confirmDelete) return;

  const { error } = await supabase
    .from("availability")
    .delete()
    .in("id", selectedIds);

  if (error) {
    console.error("Bulk delete error:", error.message);
    alert("Failed to delete selected slots.");
  } else {
    setSelectedIds([]);
    fetchAvailability();
  }
}


  if (!isVerified) {
    return (
      <main className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4 text-myaAccent">Enter Access Pin 🔐</h1>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
          <input
            type="password"
            placeholder="6-digit PIN"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="p-2 border rounded text-center text-lg text-gray-800 placeholder-gray-500"
          />
          <button
            type="submit"
            className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-4 py-2 rounded"
          >
            Enter
          </button>
        </form>
      </main>
    );
  }

 

  return (
    <main className="min-h-screen bg-pink-50 text-gray-800 p-6">
      <h1 className="text-2xl font-bold text-center mb-6">Mya's Dashboard 💅</h1>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Edit Bio ✏️</h2>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className="w-full border p-2 rounded mb-2"
          placeholder="Enter new booking bio here..."
        />
        <button
          onClick={saveBio}
          disabled={saving}
          className="bg-pink-600 text-white px-4 py-2 rounded shadow-sm"
        >
          {saving ? "Saving..." : "Save Bio"}
        </button>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Gallery Upload</h2>
        <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
          <label className="cursor-pointer border-2 border-pink-500 text-pink-500 font-semibold py-2 px-4 rounded-xl inline-block text-center hover:bg-pink-100 transition">
            Choose Photo
            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </label>

          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Name this set (e.g. Valentine’s Bling 💘)"
            className="w-full border border-gray-300 rounded p-2 text-sm text-gray-800 placeholder-gray-500"
          />

          {preview && (
            <div className="border p-4 rounded-lg bg-white shadow">
              <p className="mb-2 text-sm text-gray-600 font-medium">Preview:</p>
              <img
                src={preview}
                alt="Preview"
                className="max-w-full max-h-[300px] mx-auto rounded-lg shadow"
              />
              <p className="mt-2 text-center text-xs text-gray-500 italic">{caption}</p>
            </div>
          )}

          <button
            onClick={handleUpload}
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 rounded-xl shadow-sm"
          >
            Upload Image 💾
          </button>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Manage Gallery</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {gallery.map((item) => (
            <div
              key={item.id}
              className="border p-2 rounded shadow-sm text-center bg-white"
            >
              <img
                src={`https://ywpyfrothdaademzkpnl.supabase.co/storage/v1/object/public/gallery/${item.image_url}`}
                alt={item.caption}
                className="rounded mb-2"
              />
              <p className="text-xs text-gray-600 italic">{item.caption}</p>
              <button
                onClick={async () => {
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
                }}
                className="mt-1 text-red-500 text-sm hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>

    
<section className="mb-10">
  <h2 className="text-lg font-semibold mb-2">Upcoming Appointments</h2>
  <div className="bg-white p-4 rounded shadow-sm space-y-2">
    {bookings.length === 0 ? (
      <p>No upcoming appointments yet.</p>
    ) : (
      bookings.map((b) => {
        const isVerified = b.returning === "yes";

        return (
          <div key={b.id} className="border-b pb-2 mb-2">
            <p className="font-medium">
              {b.name} • {b.service}
            </p>

            <p className="text-sm text-gray-600">
              {b.date} @ {b.time}
            </p>

            <p className="text-sm text-gray-600">
              📸 @{b.instagram}
            </p>
            
            <p className="text-sm text-gray-600">
               Soakoff: {b.soakoff}</p>

            <p className="text-sm text-gray-600">
               Length: {b.length}</p>

            <p className="text-sm mb-1">
              {b.paid ? (
                <span className="text-green-500">✔ Paid</span>
              ) : (
                <span className="text-red-500">✘ Not Paid</span>
              )}
            </p>

            <p className="text-sm mb-1">
              {isVerified ? (
                <span className="text-green-500">✅ Verified</span>
              ) : (
                <span className="text-red-500">❌ Not Verified</span>
              )}
            </p>

            {!isVerified && b.referral?.trim() && (
              <p className="text-sm text-gray-600 italic mb-1">
                Referred by: {b.referral}
              </p>
            )}

            {b.art_level && (
              <p className="text-sm mb-1 text-purple-600">
                🎨 Nail Art Level: {b.art_level}
              </p>
            )}

            <button
              onClick={() => handleDeleteBooking(b)}
              className="text-sm text-red-500 hover:underline"
            >
              Delete Appointment
            </button>
          </div>
        );
      })
    )}
  </div>
</section>


      <section className="mb-10">
  <h2 className="text-lg font-semibold mb-2">Availability Calendar 📅</h2>
  <div className="bg-white p-4 rounded shadow space-y-4">

    {/* ➕ Manual Add Slot */}
    <div className="flex flex-col sm:flex-row gap-2">
      <input
        type="date"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        className="border p-2 rounded w-full"
      />
      <input
        type="time"
        value={newTime}
        onChange={(e) => setNewTime(e.target.value)}
        className="border p-2 rounded w-full"
      />
      <button
        onClick={async () => {
          if (!newDate || !newTime) return alert("Fill both fields!");
          const [hourStr, minuteStr] = newTime.split(":");
          const hour = parseInt(hourStr, 10);
          const minute = parseInt(minuteStr, 10);
          const suffix = hour >= 12 ? "PM" : "AM";
          const hour12 = hour % 12 === 0 ? 12 : hour % 12;
          const formattedTime =
            minute === 0
              ? `${hour12}${suffix}`
              : `${hour12}:${minuteStr}${suffix}`;

          const { error } = await supabase
            .from("availability")
            .insert({ date: newDate, time: formattedTime });

          if (error) return alert("Insert failed.");
          setNewDate("");
          setNewTime("");
          fetchAvailability();
        }}
        className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded"
      >
        Add Slot
      </button>
    </div>

    {/* ⚡ Auto-Generate Slots */}
    <button
      onClick={async () => {
        const weekdayTimes = ["8AM", "10AM", "12PM", "2PM"];
        const mondayTimes = ["1PM", "3PM", "5PM", "7PM"];
        const saturdayTimes = ["8AM", "10AM", "12AM", "2PM"];
        const inserts = [];
        const baseDate = new Date();

        for (let i = 0; i < 30; i++) {
          const date = new Date(baseDate);
          date.setDate(baseDate.getDate() + i);
          const day = date.getDay();
          if (day === 0) continue; // Skip Sunday
          const formattedDate = date.toISOString().split("T")[0];
          const times = day === 1
            ? mondayTimes
            : day === 6
            ? saturdayTimes
            : weekdayTimes;

          times.forEach((time) => inserts.push({ date: formattedDate, time }));
        }

        const { error } = await supabase.from("availability").insert(inserts);
        if (error) {
          console.error("Insert error:", error.message);
          alert("Insert failed ❌");
        } else {
          alert("✅ 2-week schedule generated!");
          fetchAvailability();
        }
      }}
      className="bg-pink-100 hover:bg-pink-200 text-pink-700 font-medium px-3 py-2 rounded shadow-sm text-sm mt-2"
    >
      Auto-Generate Next 30 Days 🗓
    </button>

    {/* 🗑️ Delete Selected */}
    {selectedIds.length > 0 && (
      <button
        onClick={handleDeleteSelected}
        className="bg-red-500 text-white px-4 py-2 rounded shadow-sm mb-3"
      >
        Delete Selected ({selectedIds.length})
      </button>
    )}

    {/* 📆 Calendar View */}
    <Calendar
      value={selectedDate}
      onChange={setSelectedDate}
      tileClassName={({ date }) => {
        const iso = date.toISOString().split("T")[0];
        const isAvailable = availability.some((slot) => slot.date === iso);
        return isAvailable ? "bg-pink-100 font-semibold rounded-full" : null;
      }}
      className="rounded border"
    />

    {/* ⏰ Time Slots Display */}
    {selectedDate && (
      <div className="mt-4 space-y-2">
        <h3 className="font-semibold text-gray-700">
          Available Times on{" "}
          {selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </h3>
        <div className="flex flex-wrap gap-2">
          {availability
            .filter(
              (slot) =>
                slot.date === selectedDate.toISOString().split("T")[0]
            )
            .map((slot) => (
              <div
                key={slot.id}
                className="bg-pink-50 border border-pink-200 rounded-xl px-3 py-2 text-sm flex items-center gap-2"
              >
                {slot.time}
                <input
                  type="checkbox"
                  checked={selectedIds.includes(slot.id)}
                  onChange={() => toggleSelected(slot.id)}
                  className="ml-2"
                />
                <button
                  onClick={async () => {
                    const confirmDelete = confirm("Delete this slot?");
                    if (!confirmDelete) return;
                    const { error } = await supabase
                      .from("availability")
                      .delete()
                      .eq("id", slot.id);
                    if (error) {
                      console.error("Delete error:", error.message);
                      alert("Failed to delete slot.");
                    } else {
                      fetchAvailability();
                    }
                  }}
                  className="text-red-500 text-xs hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          {availability.filter(
            (slot) =>
              slot.date === selectedDate.toISOString().split("T")[0]
          ).length === 0 && (
            <p className="text-gray-500 italic text-sm">
              No times for this day
            </p>
          )}
        </div>
      </div>
    )}
  </div>
</section>
    </main>
  );
 }
