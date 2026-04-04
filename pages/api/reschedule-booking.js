import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import twilio from "twilio";

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Helper: Format time to 12-hour
function to12h(time24) {
  if (!time24) return "";
  const [hourStr, minuteStr = "00"] = time24.split(":");
  const hour = parseInt(hourStr, 10);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minuteStr}${suffix}`;
}

// Helper: Format date
function formatDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { 
    month: "numeric",
    day: "numeric",
    year: "2-digit"
  });
}

// Helper: Format date for email (long form)
function formatDateLong(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { 
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { booking_id, phone, new_date, new_time } = req.body;

  // Validate inputs
  if (!booking_id || !phone || !new_date || !new_time) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(new_date)) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  // Validate time format
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(new_time)) {
    return res.status(400).json({ error: "Invalid time format" });
  }

  const cleanPhone = phone.replace(/\D/g, "");

  try {
    // 1. Get the booking
    const { data: booking, error: fetchErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    if (fetchErr || !booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // 2. Verify phone number matches (stored as 10-digit string)
    if (booking.phone !== cleanPhone) {
      return res.status(403).json({ error: "Phone number does not match booking" });
    }

    // 3. Check if >48 hours from CURRENT appointment
    const now = new Date();
    const vegasNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
    
    const currentApptDateTime = new Date(`${booking.date}T${booking.start_time}`);
    const hoursDiff = (currentApptDateTime - vegasNow) / (1000 * 60 * 60);

    if (hoursDiff < 48) {
      return res.status(400).json({ 
        error: "Cannot reschedule within 48 hours of appointment. Please contact Mya directly." 
      });
    }

    // 4. Check reschedule limit (max 2 reschedules)
    const rescheduleCount = booking.reschedule_count || 0;
    if (rescheduleCount >= 2) {
      return res.status(400).json({ 
        error: "Maximum reschedule limit reached (2). Please contact Mya directly." 
      });
    }

    // 5. Validate new date is 24+ hours away (booking policy)
    const newApptDateTime = new Date(`${new_date}T${new_time}`);
    const hoursUntilNew = (newApptDateTime - vegasNow) / (1000 * 60 * 60);

    if (hoursUntilNew < 24) {
      return res.status(400).json({ 
        error: "New appointment must be at least 24 hours from now" 
      });
    }

    // 6. Check if new slot is available (excluding current booking)
    const { data: conflicts, error: conflictErr } = await supabase
      .from("bookings")
      .select("*")
      .eq("date", new_date)
      .neq("id", booking_id); // Exclude current booking

    if (conflictErr) {
      console.error("Conflict check error:", conflictErr);
      return res.status(500).json({ error: "Failed to check availability" });
    }

    // Parse new time
    const [newHour] = new_time.split(":").map(Number);
    const duration = booking.duration || 2;
    const newEndHour = newHour + duration;

    // Check for time conflicts
    const hasConflict = conflicts.some((c) => {
      const [cStartHour] = c.start_time.split(":").map(Number);
      const [cEndHour] = c.end_time.split(":").map(Number);
      
      // Check if ranges overlap
      return newHour < cEndHour && newEndHour > cStartHour;
    });

    if (hasConflict) {
      return res.status(409).json({ error: "That time slot is already booked" });
    }

    // 7. Calculate new end time
    const endDateTime = new Date(newApptDateTime);
    endDateTime.setHours(endDateTime.getHours() + duration);
    const new_end_time = `${String(endDateTime.getHours()).padStart(2, "0")}:${String(endDateTime.getMinutes()).padStart(2, "0")}:00`;

    // 8. Store old values for notifications
    const oldDate = booking.date;
    const oldTime = booking.start_time;

    // 9. Update the booking
    const { error: updateErr } = await supabase
      .from("bookings")
      .update({
        date: new_date,
        start_time: new_time,
        end_time: new_end_time,
        reschedule_count: rescheduleCount + 1,
        last_rescheduled_at: new Date().toISOString(),
      })
      .eq("id", booking_id);

    if (updateErr) {
      console.error("Update error:", updateErr);
      return res.status(500).json({ error: "Failed to update booking" });
    }

    // 10. Send EMAIL notification via Resend
    if (booking.email) {
      try {
        await resend.emails.send({
          from: "Mya's Nails <bookings@myasnailsbaby.com>",
          to: [booking.email],
          subject: "Appointment Rescheduled 💅",
          html: `
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #f0e6f0;">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #e91e8c, #f06292); padding: 36px 32px; text-align: center;">
                <h1 style="color: #fff; margin: 0; font-size: 26px; letter-spacing: 1px;">Mya's Nails Baby 💅</h1>
                <p style="color: rgba(255,255,255,0.85); margin: 8px 0 0; font-size: 14px;">@myasnailsbaby</p>
              </div>

              <!-- Body -->
              <div style="padding: 32px;">
                <h2 style="color: #c2185b; margin: 0 0 8px;">Your Appointment Has Been Rescheduled! 📅</h2>
                <p style="color: #555; margin: 0 0 24px; font-size: 15px;">Hey ${booking.name}! Your appointment has been successfully rescheduled:</p>

                <!-- Old vs New -->
                <div style="background: #fff8e1; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                  <div style="margin-bottom: 16px;">
                    <p style="margin: 0; color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Previous</p>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px; text-decoration: line-through;">
                      ${formatDateLong(oldDate)} at ${to12h(oldTime)}
                    </p>
                  </div>
                  <div>
                    <p style="margin: 0; color: #c2185b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">New Appointment</p>
                    <p style="margin: 4px 0 0; color: #333; font-size: 16px; font-weight: bold;">
                      ${formatDateLong(new_date)} at ${to12h(new_time)}
                    </p>
                  </div>
                </div>

                <!-- Service Details -->
                <div style="background: #fdf2f8; border-radius: 12px; padding: 20px 24px; margin-bottom: 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 8px 0; color: #999; font-size: 13px;">💅 Service</td>
                      <td style="padding: 8px 0; color: #333; font-weight: bold; font-size: 14px; text-align: right;">${booking.service}${booking.pedicure_type && booking.pedicure_type !== "N/A" ? " + " + booking.pedicure_type : ""}</td>
                    </tr>
                    <tr>
                      <td style="padding: 8px 0; color: #999; font-size: 13px;">💰 Deposit</td>
                      <td style="padding: 8px 0; color: #333; font-weight: bold; font-size: 14px; text-align: right;">$20 ✅ Paid</td>
                    </tr>
                  </table>
                </div>

                <!-- Location -->
                <div style="background: #fff8e1; border-left: 4px solid #f06292; border-radius: 8px; padding: 16px 20px; margin-bottom: 24px;">
                  <p style="margin: 0; color: #555; font-size: 14px;"><strong style="color: #c2185b;">📍 Location</strong><br>
                  2080 E. Flamingo Rd., Suite #106, Room 4<br>Las Vegas, NV</p>
                </div>

                <!-- CTA -->
                <div style="text-align: center; margin-bottom: 24px;">
                  <a href="https://instagram.com/myasnailsbaby"
                     style="display: inline-block; background: linear-gradient(135deg, #e91e8c, #f06292); color: #fff; padding: 14px 32px; border-radius: 50px; text-decoration: none; font-weight: bold; font-size: 15px;">
                    DM @myasnailsbaby 💬
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: #fdf2f8; padding: 20px 32px; text-align: center; border-top: 1px solid #f0e6f0;">
                <p style="margin: 0; color: #bbb; font-size: 12px;">Mya's Nails Baby · Las Vegas, NV · @myasnailsbaby</p>
              </div>
            </div>
          `,
        });
        console.log("✅ Reschedule email sent to:", booking.email);
      } catch (emailErr) {
        console.error("❌ Email error:", emailErr);
        // Don't fail the whole request if email fails
      }
    }

    // 11. Send SMS notification via Twilio (if configured)
    const twilioPhone = `+1${cleanPhone}`; // Twilio requires E.164 format
    if (twilioPhone && process.env.TWILIO_PHONE_NUMBER) {
      try {
        const smsMessage = `Hi ${booking.name}! Your appointment with Mya has been rescheduled:

Old: ${formatDateLong(oldDate)} at ${to12h(oldTime)}
New: ${formatDateLong(new_date)} at ${to12h(new_time)}

📍 2080 E. Flamingo Rd. Suite #106, Room 4
Las Vegas, NV

DM @myasnailsbaby with questions! 💖

Reply STOP to unsubscribe.`;

        await twilioClient.messages.create({
          from: process.env.TWILIO_PHONE_NUMBER,
          to: twilioPhone,
          body: smsMessage,
        });

        console.log("✅ Reschedule SMS sent to:", twilioPhone);
      } catch (smsErr) {
        console.error("❌ SMS error:", smsErr);
        // Don't fail the whole request if SMS fails
      }
    }

    return res.status(200).json({
      success: true,
      message: "Appointment rescheduled successfully",
      booking: {
        id: booking_id,
        old_date: oldDate,
        old_time: oldTime,
        new_date: new_date,
        new_time: new_time,
      }
    });

  } catch (err) {
    console.error("Reschedule error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}