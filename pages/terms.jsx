"use client";

import Link from "next/link";

const sectionHeading = { fontFamily: "Georgia, serif" };

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-stone-900" style={sectionHeading}>MyasNailsBaby</Link>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition">← Back to Home</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-stone-900 mb-2" style={sectionHeading}>Terms of Service</h1>
          <p className="text-stone-500 text-sm">Last Updated: February 12, 2026</p>
        </div>

        <div className="bg-white border border-stone-200 p-8 sm:p-12 space-y-10">

          {[
            {
              title: "1. Agreement to Terms",
              content: 'By accessing and booking services through MyasNailsBaby ("we," "us," or "our"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please do not use our services.',
            },
          ].map(({ title, content }) => (
            <section key={title}>
              <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>{title}</h2>
              <p className="text-stone-700 leading-relaxed">{content}</p>
            </section>
          ))}

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>2. Services</h2>
            <p className="text-stone-700 leading-relaxed mb-3">MyasNailsBaby provides professional nail care services including but not limited to:</p>
            <ul className="list-disc list-inside text-stone-700 space-y-1 ml-4 mb-3">
              <li>Gel-X applications</li>
              <li>Acrylic nail services</li>
              <li>Gel manicures and pedicures</li>
              <li>Hard gel applications</li>
              <li>Builder gel manicures</li>
              <li>Nail art and custom designs</li>
            </ul>
            <p className="text-stone-700 leading-relaxed">All services are provided at our Las Vegas location: 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-4" style={sectionHeading}>3. Booking and Appointments</h2>
            <div className="space-y-4 text-stone-700">
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">3.1 Online Booking</h3>
                <p className="leading-relaxed">Appointments may be booked through our website. By submitting a booking request, you agree to provide accurate and complete information, including your full name, phone number, and Instagram handle.</p>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">3.2 Deposit Requirement</h3>
                <p className="leading-relaxed">A non-refundable $20 deposit is required to confirm your appointment. This deposit is processed through Stripe and applied toward your total service cost.</p>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">3.3 Confirmation</h3>
                <p className="leading-relaxed">You will receive appointment confirmation and reminder messages via SMS to the phone number provided during booking. Messages are sent through Twilio.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-4" style={sectionHeading}>4. Cancellation and Rescheduling Policy</h2>
            <div className="space-y-4 text-stone-700">
              <div><h3 className="font-semibold text-stone-900 mb-1">4.1 Advance Cancellations</h3><p className="leading-relaxed">If you cancel at least 48 hours in advance, your deposit will be credited toward a future appointment within 90 days.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">4.2 Late Cancellations</h3><p className="leading-relaxed">Cancellations made less than 48 hours before your appointment result in forfeiture of your deposit and a charge of 50% of the anticipated service cost.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">4.3 No-Shows</h3><p className="leading-relaxed">Failure to appear without prior notice results in forfeiture of your deposit and a charge of 50% of the anticipated service cost. Future bookings may require full prepayment.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">4.4 Rescheduling</h3><p className="leading-relaxed">You may reschedule up to 48 hours in advance without penalty. Contact us via phone at (702) 981-8428 or Instagram @myasnailsbaby. Online rescheduling is limited to 2 times per booking.</p></div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>5. Late Arrival Policy</h2>
            <p className="text-stone-700 leading-relaxed mb-2">You have a 5-minute grace period. Please text your ETA to (702) 981-8428. Arrivals more than 5 minutes late incur a $10 late fee and your service may be shortened. Arrivals more than 15 minutes late may result in automatic cancellation with applicable fees.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-4" style={sectionHeading}>6. Payment Terms</h2>
            <div className="space-y-4 text-stone-700">
              <div><h3 className="font-semibold text-stone-900 mb-1">6.1 Payment Methods</h3><p className="leading-relaxed">We accept credit card, debit card, and other methods supported by Stripe. Deposits are processed at booking; remaining balances are due at time of service.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">6.2 Pricing</h3><p className="leading-relaxed">Service prices vary by type, length, art level, and add-ons. Final pricing is confirmed during your appointment.</p></div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">6.3 Additional Fees</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Soak-off services</li>
                  <li>Foreign soak-off services</li>
                  <li>Squeeze-in appointments (50% surcharge)</li>
                  <li>Late arrival fees ($10 after 5-minute grace)</li>
                  <li>Nail repairs after 5 days ($10 per nail)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>7. Repair Policy</h2>
            <p className="text-stone-700 leading-relaxed">Free repairs within 5 days for application or workmanship issues. After 5 days: $10 per nail. Repairs do not cover damage from improper care, accidents, or normal wear.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>8. Guest Policy</h2>
            <p className="text-stone-700 leading-relaxed">Only individuals receiving services may be present during appointments. Children, friends, and family not receiving services are not permitted in the service area.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>9. Health and Safety</h2>
            <p className="text-stone-700 leading-relaxed mb-2">We maintain high sanitation standards and follow all local health regulations. Please inform us of any allergies, skin sensitivities, or medical conditions. If you have a contagious condition, please reschedule.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>10. SMS Notifications</h2>
            <p className="text-stone-700 leading-relaxed mb-3">By providing your phone number, you consent to receive appointment confirmations, reminders, and updates via automated SMS through Twilio. Message and data rates may apply. Reply STOP to opt out, HELP for support. Message frequency varies.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>11. Liability</h2>
            <p className="text-stone-700 leading-relaxed">MyasNailsBaby is not liable for allergic reactions to products, damage from improper home removal, or injuries from failure to follow aftercare instructions. You assume all risks associated with nail services.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>12. Intellectual Property</h2>
            <p className="text-stone-700 leading-relaxed">Photos of nail art created at MyasNailsBaby may be used for promotional purposes unless you explicitly request otherwise. All custom designs remain the intellectual property of MyasNailsBaby.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>13. Modification of Terms</h2>
            <p className="text-stone-700 leading-relaxed">We reserve the right to modify these Terms at any time. Changes are effective immediately upon posting. Continued use of our services constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>14. Governing Law</h2>
            <p className="text-stone-700 leading-relaxed">These Terms are governed by the laws of the State of Nevada. Disputes shall be resolved in the courts of Clark County, Nevada.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>15. Contact Information</h2>
            <div className="text-stone-700 space-y-1 text-sm">
              <p><span className="font-semibold text-stone-900">Business:</span> MyasNailsBaby</p>
              <p><span className="font-semibold text-stone-900">Address:</span> 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV 89119</p>
              <p><span className="font-semibold text-stone-900">Phone:</span> (702) 981-8428</p>
              <p><span className="font-semibold text-stone-900">Email:</span> myasnailsbaby@gmail.com</p>
              <p><span className="font-semibold text-stone-900">Instagram:</span> @myasnailsbaby</p>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-200">
            <p className="text-stone-500 text-sm leading-relaxed">By booking an appointment through our website, you acknowledge that you have read, understood, and agree to these Terms of Service.</p>
          </section>
        </div>

        <div className="mt-8 flex gap-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-900 transition">Home</Link>
          <Link href="/privacy" className="hover:text-stone-900 transition">Privacy Policy</Link>
        </div>
      </div>
    </main>
  );
}
