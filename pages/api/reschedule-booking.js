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
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #fafaf9; border: 1px solid #e7e5e4;">
              <!-- Header -->
              <div style="background: #1c1917; padding: 32px; text-align: center;">
                <p style="color: #c9848c; margin: 0 0 6px; font-size: 11px; letter-spacing: 3px; text-transform: uppercase;">MyasNailsBaby</p>
                <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: normal; letter-spacing: 1px;">Appointment Rescheduled</h1>
                <div style="width: 48px; height: 1px; background: linear-gradient(90deg, transparent, #c9848c, #e8b4b8, #c9848c, transparent); margin: 16px auto 0;"></div>
              </div>

              <!-- Body -->
              <div style="padding: 32px; background: #ffffff;">
                <p style="color: #57534e; margin: 0 0 6px; font-size: 14px;">Hi ${booking.name},</p>
                <p style="color: #1c1917; margin: 0 0 28px; font-size: 15px;">Your appointment has been successfully rescheduled.</p>

                <!-- Old vs New -->
                <div style="border: 1px solid #e7e5e4; padding: 20px 24px; margin-bottom: 24px; background: #fafaf9;">
                  <div style="margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid #e7e5e4;">
                    <p style="margin: 0 0 4px; font-size: 10px; font-weight: bold; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px;">Previous</p>
                    <p style="margin: 0; color: #a8a29e; font-size: 13px; text-decoration: line-through;">${formatDateLong(oldDate)} at ${to12h(oldTime)}</p>
                  </div>
                  <div>
                    <p style="margin: 0 0 4px; font-size: 10px; font-weight: bold; color: #9f1239; text-transform: uppercase; letter-spacing: 2px;">New Appointment</p>
                    <p style="margin: 0; color: #1c1917; font-size: 15px; font-weight: bold;">${formatDateLong(new_date)} at ${to12h(new_time)}</p>
                  </div>
                </div>

                <!-- Service Details -->
                <div style="border: 1px solid #e7e5e4; padding: 20px 24px; margin-bottom: 24px; background: #fafaf9;">
                  <p style="margin: 0 0 14px; font-size: 10px; font-weight: bold; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px;">Service</p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 6px 0; color: #a8a29e; font-size: 12px; border-bottom: 1px solid #f5f5f4;">Service</td>
                      <td style="padding: 6px 0; color: #1c1917; font-weight: bold; font-size: 13px; text-align: right; border-bottom: 1px solid #f5f5f4;">${booking.service}${booking.pedicure_type && booking.pedicure_type !== "N/A" ? " + " + booking.pedicure_type : ""}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 0; color: #a8a29e; font-size: 12px;">Deposit</td>
                      <td style="padding: 6px 0; color: #9f1239; font-weight: bold; font-size: 13px; text-align: right;">$20 Paid</td>
                    </tr>
                  </table>
                </div>

                <!-- Location -->
                <div style="border-left: 3px solid #9f1239; padding: 14px 18px; margin-bottom: 28px; background: #fafaf9;">
                  <p style="margin: 0 0 4px; font-size: 10px; font-weight: bold; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px;">Location</p>
                  <p style="margin: 0; color: #44403c; font-size: 13px; line-height: 1.6;">2080 E. Flamingo Rd., Suite #106, Room 4<br>Las Vegas, NV 89119</p>
                </div>

                <!-- CTA -->
                <div style="text-align: center;">
                  <a href="https://instagram.com/myasnailsbaby"
                     style="display: inline-block; background: #9f1239; color: #fff; padding: 14px 36px; text-decoration: none; font-size: 13px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">
                    DM @myasnailsbaby
                  </a>
                </div>
              </div>

              <!-- Footer -->
              <div style="background: #1c1917; padding: 20px 32px; text-align: center;">
                <p style="margin: 0; color: #78716c; font-size: 11px; letter-spacing: 1px;">MYASNAILSBABY &middot; LAS VEGAS, NV &middot; @MYASNAILSBABY</p>
              </div>
            </div>
          `,
        });
        console.log("✅ Reschedule email sent to:", booking.email);
      } catch (emailErr) {
        console.error("❌ Email error:", emailErr);
      }
    }

    // 10b. Notify Mya about the reschedule
    const myaEmail = process.env.MYA_EMAIL;
    if (myaEmail) {
      try {
        await resend.emails.send({
          from: "Mya's Nails <bookings@myasnailsbaby.com>",
          to: [myaEmail],
          subject: `📅 Reschedule: ${booking.name}`,
          html: `
            <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #fafaf9; border: 1px solid #e7e5e4;">
              <div style="background: #1c1917; padding: 24px 32px;">
                <p style="color: #c9848c; margin: 0 0 4px; font-size: 10px; letter-spacing: 3px; text-transform: uppercase;">Dashboard Alert</p>
                <h2 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: normal;">Client Rescheduled</h2>
              </div>
              <div style="padding: 28px 32px; background: #ffffff;">
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  ${[
                    ["Client", booking.name],
                    ["Phone", booking.phone],
                    ...(booking.email ? [["Email", booking.email]] : []),
                    ["Service", `${booking.service}${booking.pedicure_type && booking.pedicure_type !== "N/A" ? " + " + booking.pedicure_type : ""}`],
                  ].map(([k, v]) => `
                    <tr>
                      <td style="padding: 7px 0; color: #a8a29e; font-size: 12px; width: 30%; border-bottom: 1px solid #f5f5f4;">${k}</td>
                      <td style="padding: 7px 0; color: #1c1917; font-size: 13px; font-weight: bold; border-bottom: 1px solid #f5f5f4;">${v}</td>
                    </tr>`).join("")}
                </table>
                <div style="border-left: 3px solid #9f1239; padding: 14px 18px; background: #fafaf9; margin-bottom: 16px;">
                  <p style="margin: 0 0 8px; font-size: 10px; font-weight: bold; color: #a8a29e; text-transform: uppercase; letter-spacing: 2px;">Schedule Change</p>
                  <p style="margin: 0 0 4px; color: #a8a29e; font-size: 12px; text-decoration: line-through;">Was: ${formatDateLong(oldDate)} at ${to12h(oldTime)}</p>
                  <p style="margin: 0; color: #1c1917; font-size: 14px; font-weight: bold;">Now: ${formatDateLong(new_date)} at ${to12h(new_time)}</p>
                </div>
                <p style="margin: 0; color: #a8a29e; font-size: 11px;">Reschedule ${(booking.reschedule_count || 0) + 1} of 2</p>
              </div>
            </div>
          `,
        });
        console.log("✅ Reschedule notification sent to Mya");
      } catch (myaEmailErr) {
        console.error("❌ Mya notification email error:", myaEmailErr);
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