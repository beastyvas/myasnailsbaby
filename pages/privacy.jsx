"use client";

import Link from "next/link";

export default function PrivacyPolicy() {
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
            Privacy Policy
          </h1>
          <p className="text-rose-700">Last Updated: February 12, 2026</p>
        </div>

        {/* Content */}
        <div className="bg-white/80 backdrop-blur-sm border-2 border-pink-200 rounded-3xl p-8 sm:p-12 space-y-8 shadow-xl">
          
          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">1. Introduction</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              MyasNailsBaby ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, 
              and safeguard your information when you visit our website and use our booking services.
            </p>
            <p className="text-rose-800 leading-relaxed">
              By using our services, you consent to the data practices described in this policy. If you do not agree with this policy, please do not 
              use our website or services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">2. Information We Collect</h2>
            
            <div className="space-y-4 text-rose-800">
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">2.1 Personal Information</h3>
                <p className="leading-relaxed mb-2">When you book an appointment through our website, we collect:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Full name</li>
                  <li>Phone number</li>
                  <li>Instagram handle</li>
                  <li>Service preferences and requirements</li>
                  <li>Appointment date and time selections</li>
                  <li>Special requests or notes about your service</li>
                  <li>Referral source (for new clients)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">2.2 Payment Information</h3>
                <p className="leading-relaxed">
                  Payment processing is handled by Stripe, Inc., a third-party payment processor. We do not store your complete credit card information 
                  on our servers. When you make a payment, Stripe collects and processes your payment card details, billing address, and transaction 
                  information in accordance with their privacy policy and PCI-DSS compliance standards.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">2.3 Communication Data</h3>
                <p className="leading-relaxed">
                  We collect information about your communications with us, including SMS messages sent through Twilio for appointment confirmations, 
                  reminders, and updates.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">2.4 Automatically Collected Information</h3>
                <p className="leading-relaxed mb-2">When you access our website, we may automatically collect:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>IP address</li>
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>Pages visited and time spent on pages</li>
                  <li>Referring website addresses</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">3. How We Use Your Information</h2>
            <p className="text-rose-800 leading-relaxed mb-4">We use the information we collect to:</p>
            <ul className="list-disc list-inside text-rose-800 space-y-2 ml-4">
              <li>Process and manage your appointment bookings</li>
              <li>Send appointment confirmations and reminders via SMS</li>
              <li>Process payments and deposits through Stripe</li>
              <li>Communicate with you about your appointments, services, and any changes to our policies</li>
              <li>Improve our services and customer experience</li>
              <li>Maintain records of your service history for quality assurance</li>
              <li>Send promotional messages (only with your explicit consent)</li>
              <li>Comply with legal obligations and resolve disputes</li>
              <li>Prevent fraud and ensure the security of our services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">4. SMS Text Messaging</h2>
            
            <div className="space-y-4 text-rose-800">
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.1 Consent to Receive SMS Messages</h3>
                <p className="leading-relaxed">
                  By providing your mobile phone number during the booking process, you expressly consent to receive SMS text messages from MyasNailsBaby 
                  related to your appointment. Messages are sent through Twilio, our SMS service provider.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.2 Types of SMS Messages</h3>
                <p className="leading-relaxed mb-2">We may send you the following types of messages:</p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li><strong>Transactional Messages:</strong> Booking confirmations, appointment reminders, cancellation notifications, and rescheduling confirmations</li>
                  <li><strong>Service Updates:</strong> Changes to appointment times, policy updates, or service availability</li>
                  <li><strong>Promotional Messages:</strong> Special offers, promotions, or new service announcements (only with separate opt-in consent)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.3 Message Frequency</h3>
                <p className="leading-relaxed">
                  Message frequency varies depending on your appointment schedule. You can expect to receive approximately 2-4 messages per appointment 
                  (confirmation, reminder, and any updates). Promotional messages, if you opt in, may be sent up to 4 times per month.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.4 Message and Data Rates</h3>
                <p className="leading-relaxed">
                  Message and data rates may apply based on your mobile carrier's plan. We do not charge for messages, but your carrier may. 
                  Please check with your carrier for details.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.5 Opting Out</h3>
                <p className="leading-relaxed mb-2">
                  You can opt out of SMS messages at any time by:
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Replying "STOP," "UNSUBSCRIBE," or "CANCEL" to any text message</li>
                  <li>Contacting us directly at (702) 981-8428</li>
                  <li>Emailing us through our contact methods</li>
                </ul>
                <p className="leading-relaxed mt-2">
                  Please note that opting out of transactional messages may affect our ability to communicate important appointment information to you.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">4.6 Help and Support</h3>
                <p className="leading-relaxed">
                  For help or support with SMS messages, reply "HELP" to any message or contact us at (702) 981-8428. For questions about Twilio's 
                  privacy practices, visit twilio.com/legal/privacy.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">5. Third-Party Service Providers</h2>
            
            <div className="space-y-4 text-rose-800">
              <div>
                <h3 className="font-semibold text-rose-900 mb-2">5.1 Stripe (Payment Processing)</h3>
                <p className="leading-relaxed">
                  We use Stripe to process payments and deposits. Stripe collects and processes your payment information in accordance with their privacy 
                  policy, available at stripe.com/privacy. Stripe is PCI-DSS compliant and uses industry-standard security measures to protect your 
                  payment information.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">5.2 Twilio (SMS Messaging)</h3>
                <p className="leading-relaxed">
                  We use Twilio to send appointment confirmations, reminders, and updates via SMS. Twilio processes your phone number and message content 
                  in accordance with their privacy policy, available at twilio.com/legal/privacy. Twilio is compliant with applicable data protection 
                  regulations including GDPR and CCPA.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-rose-900 mb-2">5.3 Supabase (Database Services)</h3>
                <p className="leading-relaxed">
                  We use Supabase to securely store your booking information, appointment history, and account data. Supabase maintains industry-standard 
                  security practices and data protection measures.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">6. How We Share Your Information</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              We do not sell, rent, or trade your personal information to third parties for marketing purposes. We may share your information only in 
              the following circumstances:
            </p>
            <ul className="list-disc list-inside text-rose-800 space-y-2 ml-4">
              <li><strong>Service Providers:</strong> With Stripe for payment processing and Twilio for SMS messaging, as necessary to provide our services</li>
              <li><strong>Legal Requirements:</strong> When required by law, court order, or government regulation</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of business assets</li>
              <li><strong>Protection of Rights:</strong> To protect our rights, property, or safety, or that of our clients or others</li>
              <li><strong>With Your Consent:</strong> When you explicitly authorize us to share your information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">7. Data Security</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, 
              alteration, disclosure, or destruction. These measures include:
            </p>
            <ul className="list-disc list-inside text-rose-800 space-y-1 ml-4 mb-4">
              <li>Encryption of data in transit using SSL/TLS</li>
              <li>Secure storage of data with access controls</li>
              <li>Regular security assessments and updates</li>
              <li>Limited access to personal information by authorized personnel only</li>
              <li>Use of PCI-DSS compliant payment processors</li>
            </ul>
            <p className="text-rose-800 leading-relaxed">
              However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your personal information, 
              we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">8. Data Retention</h2>
            <p className="text-rose-800 leading-relaxed">
              We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer 
              retention period is required or permitted by law. Appointment records are typically retained for 3 years for business and legal compliance 
              purposes. Payment transaction records are retained in accordance with financial record-keeping requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">9. Your Privacy Rights</h2>
            <p className="text-rose-800 leading-relaxed mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside text-rose-800 space-y-2 ml-4">
              <li><strong>Access:</strong> Request access to the personal information we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal obligations)</li>
              <li><strong>Opt-Out:</strong> Opt out of receiving SMS messages or promotional communications</li>
              <li><strong>Data Portability:</strong> Request a copy of your information in a portable format</li>
              <li><strong>Object:</strong> Object to certain processing of your personal information</li>
            </ul>
            <p className="text-rose-800 leading-relaxed mt-4">
              To exercise any of these rights, please contact us at (702) 981-8428 or through Instagram @myasnailsbaby. We will respond to your request 
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">10. California Privacy Rights (CCPA)</h2>
            <p className="text-rose-800 leading-relaxed mb-4">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside text-rose-800 space-y-2 ml-4">
              <li>The right to know what personal information we collect, use, and disclose</li>
              <li>The right to request deletion of your personal information</li>
              <li>The right to opt out of the sale of personal information (we do not sell personal information)</li>
              <li>The right to non-discrimination for exercising your CCPA rights</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">11. Children's Privacy</h2>
            <p className="text-rose-800 leading-relaxed">
              Our services are not directed to individuals under the age of 18. We do not knowingly collect personal information from children. 
              If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately, 
              and we will delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">12. Cookies and Tracking Technologies</h2>
            <p className="text-rose-800 leading-relaxed">
              We may use cookies and similar tracking technologies to enhance your experience on our website. Cookies are small data files stored on 
              your device. You can control cookie preferences through your browser settings. Disabling cookies may affect the functionality of certain 
              features on our website.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">13. Changes to This Privacy Policy</h2>
            <p className="text-rose-800 leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of 
              significant changes by posting the updated policy on our website with a new "Last Updated" date. Your continued use of our services 
              after changes are posted constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-rose-900 mb-4">14. Contact Us</h2>
            <div className="text-rose-800 leading-relaxed space-y-2">
              <p>If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:</p>
              <div className="mt-4 space-y-2">
                <p><strong className="text-rose-900">Business Name:</strong> MyasNailsBaby</p>
                <p><strong className="text-rose-900">Address:</strong> 2080 E. Flamingo Rd. Suite #106 Room 4, Las Vegas, NV 89119</p>
                <p><strong className="text-rose-900">Phone:</strong> (702) 981-8428</p>
                <p><strong className="text-rose-900">Instagram:</strong> @myasnailsbaby</p>
              </div>
            </div>
          </section>

          <section className="pt-8 border-t-2 border-pink-200">
            <div className="bg-pink-50 border-2 border-pink-200 rounded-2xl p-6">
              <h3 className="font-bold text-rose-900 mb-3">TCPA Compliance Statement</h3>
              <p className="text-rose-800 leading-relaxed text-sm">
                By providing your mobile phone number and completing the booking process, you expressly consent and agree to receive automated 
                SMS text messages from MyasNailsBaby at the phone number provided. These messages may include appointment confirmations, reminders, 
                updates, and service-related notifications sent via Twilio. You understand that consent is not a condition of purchase, and you may 
                opt out at any time by replying "STOP" to any message. Message frequency varies. Message and data rates may apply. For help, reply 
                "HELP" or contact us at (702) 981-8428.
              </p>
            </div>
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
            href="/terms"
            className="text-rose-600 hover:text-rose-800 font-medium"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </main>
  );
}