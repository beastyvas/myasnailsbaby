"use client";

import Link from "next/link";

const sectionHeading = { fontFamily: "Georgia, serif" };

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-stone-900" style={sectionHeading}>MyasNailsBaby</Link>
          <Link href="/" className="text-sm text-stone-500 hover:text-stone-900 transition">← Back to Home</Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-stone-900 mb-2" style={sectionHeading}>Privacy Policy</h1>
          <p className="text-stone-500 text-sm">Last Updated: February 12, 2026</p>
        </div>

        <div className="bg-white border border-stone-200 p-8 sm:p-12 space-y-10">

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>1. Introduction</h2>
            <p className="text-stone-700 leading-relaxed mb-2">MyasNailsBaby is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our booking services.</p>
            <p className="text-stone-700 leading-relaxed">By using our services, you consent to the data practices described in this policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-4" style={sectionHeading}>2. Information We Collect</h2>
            <div className="space-y-4 text-stone-700">
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">2.1 Personal Information</h3>
                <p className="leading-relaxed mb-2">When you book an appointment, we collect:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Full name</li>
                  <li>Phone number</li>
                  <li>Email address</li>
                  <li>Instagram handle</li>
                  <li>Service preferences and requirements</li>
                  <li>Appointment date and time selections</li>
                  <li>Special requests or notes</li>
                  <li>Referral source (for new clients)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">2.2 Payment Information</h3>
                <p className="leading-relaxed">Payment processing is handled by Stripe, Inc. We do not store your complete credit card information on our servers. Stripe collects and processes your payment details in accordance with their privacy policy and PCI-DSS compliance standards.</p>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">2.3 Communication Data</h3>
                <p className="leading-relaxed">We collect information about your communications with us, including SMS messages sent through Twilio for appointment confirmations, reminders, and updates.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-stone-700 space-y-2 ml-4">
              <li>Process and manage your appointment bookings</li>
              <li>Send appointment confirmations and reminders via SMS and email</li>
              <li>Process payments and deposits through Stripe</li>
              <li>Communicate with you about appointments, services, and policy changes</li>
              <li>Improve our services and customer experience</li>
              <li>Maintain records of your service history</li>
              <li>Comply with legal obligations and resolve disputes</li>
              <li>Prevent fraud and ensure security</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-4" style={sectionHeading}>4. SMS Text Messaging</h2>
            <div className="space-y-4 text-stone-700">
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">4.1 Consent</h3>
                <p className="leading-relaxed">By providing your mobile phone number during booking, you expressly consent to receive automated SMS text messages from MyasNailsBaby related to your appointment. Messages are sent through Twilio.</p>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">4.2 Types of SMS Messages</h3>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Transactional:</strong> Booking confirmations, reminders, cancellation and rescheduling notifications</li>
                  <li><strong>Service Updates:</strong> Changes to appointment times, policy updates</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">4.3 Message Frequency</h3>
                <p className="leading-relaxed">Message frequency varies depending on your appointment schedule. You can expect approximately 2-4 messages per appointment (confirmation, reminder, and any updates).</p>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">4.4 Message and Data Rates</h3>
                <p className="leading-relaxed">Message and data rates may apply based on your mobile carrier plan. We do not charge for messages.</p>
              </div>
              <div>
                <h3 className="font-semibold text-stone-900 mb-1">4.5 Opting Out</h3>
                <p className="leading-relaxed">You can opt out at any time by replying STOP to any message, calling (702) 981-8428, or emailing myasnailsbaby@gmail.com. For help, reply HELP to any message.</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-4" style={sectionHeading}>5. Third-Party Service Providers</h2>
            <div className="space-y-3 text-stone-700">
              <div><h3 className="font-semibold text-stone-900 mb-1">5.1 Stripe</h3><p className="leading-relaxed">Payment processing. See stripe.com/privacy.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">5.2 Twilio</h3><p className="leading-relaxed">SMS messaging. See twilio.com/legal/privacy.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">5.3 Resend</h3><p className="leading-relaxed">Email delivery for booking confirmations and notifications.</p></div>
              <div><h3 className="font-semibold text-stone-900 mb-1">5.4 Supabase</h3><p className="leading-relaxed">Secure database storage for booking information and appointment history.</p></div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>6. How We Share Your Information</h2>
            <p className="text-stone-700 leading-relaxed mb-3">We do not sell, rent, or trade your personal information. We share information only with our service providers (Stripe, Twilio, Resend, Supabase) as necessary to deliver our services, when required by law, or with your explicit consent.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>7. Data Security</h2>
            <p className="text-stone-700 leading-relaxed">We implement SSL/TLS encryption, secure access controls, and use PCI-DSS compliant payment processors. No method of internet transmission is 100% secure, but we take all reasonable precautions.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>8. Data Retention</h2>
            <p className="text-stone-700 leading-relaxed">We retain your personal information for as long as necessary to fulfill the purposes in this policy. Appointment records are typically retained for 3 years. Payment records are retained per financial record-keeping requirements.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>9. Your Privacy Rights</h2>
            <ul className="list-disc list-inside text-stone-700 space-y-1 ml-4">
              <li><strong>Access:</strong> Request access to your personal information</li>
              <li><strong>Correction:</strong> Request correction of inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information</li>
              <li><strong>Opt-Out:</strong> Opt out of SMS or promotional communications</li>
              <li><strong>Portability:</strong> Request a copy of your information</li>
            </ul>
            <p className="text-stone-700 leading-relaxed mt-3">To exercise these rights, contact us at (702) 981-8428 or myasnailsbaby@gmail.com. We will respond within 30 days.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>10. Children&apos;s Privacy</h2>
            <p className="text-stone-700 leading-relaxed">Our services are not directed to individuals under 18. We do not knowingly collect personal information from children.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>11. Changes to This Policy</h2>
            <p className="text-stone-700 leading-relaxed">We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the updated policy with a new date. Continued use of our services constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-stone-900 mb-3" style={sectionHeading}>12. Contact Us</h2>
            <div className="text-stone-700 space-y-1 text-sm">
              <p><span className="font-semibold text-stone-900">Business:</span> MyasNailsBaby</p>
              <p><span className="font-semibold text-stone-900">Address:</span> 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV 89119</p>
              <p><span className="font-semibold text-stone-900">Phone:</span> (702) 981-8428</p>
              <p><span className="font-semibold text-stone-900">Email:</span> myasnailsbaby@gmail.com</p>
              <p><span className="font-semibold text-stone-900">Instagram:</span> @myasnailsbaby</p>
            </div>
          </section>

          <section className="pt-6 border-t border-stone-200">
            <div className="bg-stone-50 border border-stone-200 p-5">
              <h3 className="font-semibold text-stone-900 mb-2">TCPA Compliance Statement</h3>
              <p className="text-stone-700 leading-relaxed text-sm">
                By providing your mobile phone number and completing the booking process, you expressly consent to receive automated SMS text messages from MyasNailsBaby at the phone number provided. These messages may include appointment confirmations, reminders, and service-related notifications sent via Twilio. Consent is not a condition of purchase. You may opt out at any time by replying STOP. Message frequency varies. Message and data rates may apply. For help, reply HELP or contact us at (702) 981-8428.
              </p>
            </div>
          </section>
        </div>

        <div className="mt-8 flex gap-6 text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-900 transition">Home</Link>
          <Link href="/terms" className="hover:text-stone-900 transition">Terms of Service</Link>
        </div>
      </div>
    </main>
  );
}
