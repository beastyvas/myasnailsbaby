"use client";

import Link from "next/link";

export default function TermsOfService() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Link 
            href="/"
            className="inline-block mb-6 text-rose-600 hover:text-rose-800 font-medium"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-pink-500 to-rose-500 bg-clip-text text-transparent mb-4" style={{fontFamily: 'Georgia, serif'}}>
            Terms of Service
          </h1>
          <p className="text-rose-700">Last Updated: February 12, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-8 sm:p-12 space-y-8 shadow-xl">
          
          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">1. Agreement to Terms</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              By accessing and booking services through MyasNailsBaby ("we," "us," or "our"), you agree to be bound by these Terms of Service. 
              If you do not agree with any part of these terms, please do not use our services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">2. Services</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              MyasNailsBaby provides professional nail care services including but not limited to:
            </p>
            <ul className="list-disc list-inside text-rose-800 space-y-2 ml-4 mb-4">
              <li>Gel-X applications</li>
              <li>Acrylic nail services</li>
              <li>Gel manicures and pedicures</li>
              <li>Hard gel applications</li>
              <li>Builder gel manicures</li>
              <li>Nail art and custom designs</li>
            </ul>
            <p className="text-rose-800 leading-relaxed">
              All services are provided at our Las Vegas location: 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">3. Booking and Appointments</h2>
            <div className="space-y-4 text-rose-800">
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">3.1 Online Booking</h3>
                <p className="leading-relaxed">
                  Appointments may be booked through our website. By submitting a booking request, you agree to provide accurate and complete information, 
                  including your full name, phone number, and Instagram handle for identification purposes.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">3.2 Deposit Requirement</h3>
                <p className="leading-relaxed">
                  A non-refundable $20 deposit is required to confirm your appointment. This deposit will be processed through Stripe, our secure payment processor, 
                  and will be applied toward your total service cost.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">3.3 Confirmation</h3>
                <p className="leading-relaxed">
                  You will receive appointment confirmation and reminder messages via SMS to the phone number provided during booking. 
                  These messages are sent through Twilio, our messaging service provider.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">4. Cancellation and Rescheduling Policy</h2>
            <div className="space-y-4 text-rose-800">
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.1 Advance Cancellations</h3>
                <p className="leading-relaxed">
                  If you cancel your appointment at least 48 hours in advance, your deposit will be credited toward a future appointment within 90 days.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.2 Late Cancellations</h3>
                <p className="leading-relaxed">
                  Cancellations made less than 48 hours before your scheduled appointment will result in forfeiture of your deposit and a charge of 50% 
                  of the anticipated service cost.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.3 No-Shows</h3>
                <p className="leading-relaxed">
                  Failure to appear for your scheduled appointment without prior notice will result in forfeiture of your deposit and a charge of 50% 
                  of the anticipated service cost. Future bookings may require full prepayment.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.4 Rescheduling</h3>
                <p className="leading-relaxed">
                  You may reschedule your appointment up to 48 hours in advance without penalty. Please contact us via phone at (702) 981-8428 or 
                  through Instagram @myasnailsbaby.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">5. Late Arrival Policy</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              We understand that delays happen. You have a 5-minute grace period for your appointment. Please text us your estimated time of arrival 
              at (702) 981-8428.
            </p>
            <p className="text-rose-800 leading-relaxed">
              Arrivals more than 5 minutes late will incur a $10 late fee, and your service may need to be shortened or rescheduled to accommodate 
              other clients. Arrivals more than 15 minutes late may result in automatic cancellation with applicable cancellation fees.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">6. Payment Terms</h2>
            <div className="space-y-4 text-rose-800">
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">6.1 Payment Methods</h3>
                <p className="leading-relaxed">
                  We accept payments via credit card, debit card, and other payment methods supported by Stripe. Deposits are processed at the time 
                  of booking, and remaining balances are due at the time of service.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">6.2 Pricing</h3>
                <p className="leading-relaxed">
                  Service prices vary based on the type of service, nail length, art level, and any add-ons requested. Final pricing will be confirmed 
                  during your appointment based on the actual services provided.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">6.3 Additional Fees</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Soak-off services (if applicable)</li>
                  <li>Foreign soak-off services (nails not done at our salon)</li>
                  <li>Squeeze-in appointments (50% surcharge on base service price)</li>
                  <li>Late arrival fees ($10 after 5-minute grace period)</li>
                  <li>Nail repairs after 5 days ($10 per nail)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">7. Repair Policy</h2>
            <p className="text-rose-800 leading-relaxed">
              We stand behind our work. Free repairs are provided within 5 days of your original appointment for any issues with the application 
              or workmanship. After 5 days, repairs are available at $10 per nail. Repairs do not cover damage caused by improper care, accidents, 
              or normal wear and tear.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">8. Guest Policy</h2>
            <p className="text-rose-800 leading-relaxed">
              To maintain a professional and relaxing environment for all clients, only individuals receiving services may be present during appointments. 
              Children, friends, and family members not receiving services are not permitted in the service area.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">9. Health and Safety</h2>
            <div className="space-y-4 text-rose-800">
              <p className="leading-relaxed">
                We maintain high standards of sanitation and hygiene. All tools are properly sanitized between clients, and we follow all local health 
                and safety regulations.
              </p>
              <p className="leading-relaxed">
                Please inform us of any allergies, skin sensitivities, or medical conditions that may affect your service. If you have a contagious 
                condition or infection, please reschedule your appointment.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">10. SMS Notifications</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              By providing your phone number during booking, you consent to receive appointment confirmations, reminders, and updates via SMS text messages. 
              These messages are sent through Twilio and may include:
            </p>
            <ul className="list-disc list-inside text-rose-800 space-y-1 ml-4 mb-4">
              <li>Booking confirmations</li>
              <li>Appointment reminders (24-48 hours before)</li>
              <li>Rescheduling or cancellation notifications</li>
              <li>Service updates or policy changes</li>
            </ul>
            <p className="text-rose-800 leading-relaxed">
              Message and data rates may apply. You can opt out of SMS notifications at any time by replying "STOP" to any message or contacting us directly. 
              However, opting out may affect your ability to receive important appointment information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">11. Liability</h2>
            <p className="text-rose-800 leading-relaxed">
              While we take every precaution to ensure your safety and satisfaction, MyasNailsBaby is not liable for allergic reactions to products, 
              damage to natural nails from improper removal attempts at home, or injuries resulting from failure to follow aftercare instructions. 
              You assume all risks associated with nail services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">12. Intellectual Property</h2>
            <p className="text-rose-800 leading-relaxed">
              Photos of nail art and designs created at MyasNailsBaby may be used for promotional purposes on our website, social media, and marketing 
              materials unless you explicitly request otherwise. All custom designs remain the intellectual property of MyasNailsBaby.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">13. Modification of Terms</h2>
            <p className="text-rose-800 leading-relaxed">
              We reserve the right to modify these Terms of Service at any time. Changes will be effective immediately upon posting to our website. 
              Your continued use of our services after changes are posted constitutes acceptance of the modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">14. Governing Law</h2>
            <p className="text-rose-800 leading-relaxed">
              These Terms of Service are governed by the laws of the State of Nevada. Any disputes arising from these terms or your use of our services 
              shall be resolved in the courts of Clark County, Nevada.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">15. Contact Information</h2>
            <div className="text-rose-800 leading-relaxed space-y-2">
              <p><strong className="text-rose-900">Business Name:</strong> MyasNailsBaby</p>
              <p><strong className="text-rose-900">Address:</strong> 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV 89119</p>
              <p><strong className="text-rose-900">Phone:</strong> (702) 981-8428</p>
              <p><strong className="text-rose-900">Instagram:</strong> @myasnailsbaby</p>
            </div>
          </section>

          <section className="pt-8 border-t-2 border-pink-200">
            <p className="text-rose-700 text-sm leading-relaxed">
              By booking an appointment through our website, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. 
              If you have any questions or concerns, please contact us before booking.
            </p>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="mt-12 text-center space-x-6">
          <Link 
            href="/"
            className="text-rose-600 hover:text-rose-800 font-medium"
          >
            Home
          </Link>
          <Link 
            href="/privacy"
            className="text-rose-600 hover:text-rose-800 font-medium"
          >
            Privacy Policy
          </Link>
        </div>
      </div>
    </main>
  );
}