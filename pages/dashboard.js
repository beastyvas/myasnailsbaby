import { useEffect, useState } from "react";
import { supabase } from "@/utils/supabaseClient";

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

  const correctPin = "0927";

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
    const bookingTime = new Date(`${booking.date}T${convertTo24Hr(booking.time)}`);
    return bookingTime.getTime() - now.getTime() > -5 * 60 * 1000; // 5 min grace
  });

  setBookings(upcoming);
}
 async function handleDeleteBooking(id) {
  const confirm = window.confirm("Are you sure you want to delete this appointment?");
  if (!confirm) return;

  const { error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("❌ Delete failed:", error.message);
    alert("Could not delete appointment.");
  } else {
    alert("✅ Appointment deleted!");
    fetchBookings(); // Refresh list
  }
}


function convertTo24Hr(timeStr) {
  const [hourStr, modifier] = timeStr.match(/(\d+)(AM|PM)/i).slice(1, 3);
  let hour = parseInt(hourStr);
  if (modifier === "PM" && hour !== 12) hour += 12;
  if (modifier === "AM" && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, '0')}:00`;
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

  if (!isVerified) {
    return (
      <main className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold mb-4 text-myaAccent">Enter Access Pin 🔐</h1>
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-2">
          <input
            type="password"
            placeholder="4-digit PIN"
            maxLength={4}
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
      bookings.map((b) => (
        <div
          key={`${b.id}`} // safer to use booking id
          className="border-b pb-2 mb-2"
        >
          <p className="font-medium">
            {b.name} • {b.service}
          </p>
          <p className="text-sm text-gray-600">
            {b.date} @ {b.time}
          </p>
          <p className="text-sm mb-1">
            {b.paid ? (
              <span className="text-green-500">✔ Paid</span>
            ) : (
              <span className="text-red-500">✘ Not Paid</span>
            )}
          </p>
          <button
  onClick={() => handleDeleteBooking(b.id)}
  className="text-sm text-red-500 hover:underline"
>
  Delete Appointment
</button>

        </div>
      ))
    )}
  </div>
</section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-2">Availability Calendar 📅</h2>
        <div className="bg-white p-4 rounded shadow space-y-4">
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
                const { error } = await supabase
                  .from("availability")
                  .insert({ date: newDate, time: newTime });
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
<button
  onClick={async () => {
    const weekdayTimes = ["10AM", "12PM", "2PM"];
    const saturdayTimes = ["1PM", "3PM", "5PM", "7PM"];
    const inserts = [];

    const baseDate = new Date();

    for (let i = 0; i < 14; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);

      const day = date.getDay(); // 0 = Sunday
      if (day === 0) {
        console.log("🛑 Skipping Sunday:", date.toDateString());
        continue;
      }

      const formattedDate = date.toISOString().split("T")[0];
      const times = day === 6 ? saturdayTimes : weekdayTimes;

      times.forEach((time) => {
        inserts.push({ date: formattedDate, time });
      });
    }

    console.log("✅ Final inserts:", inserts);

    const { error } = await supabase.from("availability").insert(inserts);
    if (error) {
      console.error("Insert error:", error.message);
      alert("Insert failed ❌");
    } else {
      alert("✅ 1-week schedule generated!");
      fetchAvailability();
    }
  }}
  className="bg-pink-100 hover:bg-pink-200 text-pink-700 font-medium px-3 py-2 rounded shadow-sm text-sm mt-2"
>
  Auto-Generate Next 14 Days 🗓
</button>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {availability.map((slot) => (
              <div
                key={slot.id}
                className="bg-pink-50 border border-pink-200 rounded-xl p-4 flex justify-between items-center shadow-sm"
              >
               <div className="text-sm font-medium text-gray-800">
  {(() => {
    const dateObj = new Date(`${slot.date}T00:00:00`);
    return dateObj.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + ` @ ${slot.time}`;
  })()}
</div>
                <button
  onClick={async () => {
    const confirmDelete = confirm("Are you sure you want to delete this slot?");
    if (!confirmDelete) return;("availability slot deleted!")

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
  className="text-xs text-red-500 hover:underline"
>
  Delete
</button>

              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
