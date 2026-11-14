# Free-tier usage and limitations

MR FOP FASHIONS is designed to remain on free services. Do not enable billing, upgrade Firebase to Blaze, add a paid AI API, or activate paid messaging or maps services as part of routine operation.

## Services used

| Service | Purpose | Cost-control notes |
|---|---|---|
| Firebase Authentication | Email/password accounts | Do not enable paid phone/SMS verification. |
| Firebase Firestore | Profiles, orders, appointments, finance, Institute and role data | Stay within the Spark plan's current free quotas; monitor usage in Firebase Console. |
| GitHub Pages | Static website hosting | Keep deployment on the repository's free Pages allowance and observe GitHub's current limits. |
| Google Drive | Photos, videos, payment evidence and Institute lesson files | Monitor account storage and API quotas. Drive permissions are access control, not DRM. |
| Google Apps Script | Optional objective grading and lightweight integrations | Respect the current Apps Script daily quotas and execution limits. |
| Browser PWA APIs | Install prompt, cache and offline shell | No paid app-store distribution is required. |
| WhatsApp links | Customer-initiated conversations | These open WhatsApp; they are not automated WhatsApp Business API messages. |
| Google Maps embed/link | Location information | Uses a standard public embed/link; do not add a paid Maps API key. |

## Features intentionally not dependent on paid services

- The app does not use Firebase Cloud Storage.
- The app does not require Firebase Cloud Functions.
- The app does not initiate bank transfers or card payments.
- The app does not use paid AI measurement APIs.
- The app does not promise unlimited email or SMS.
- The app does not send automated WhatsApp API messages.
- The app does not require a paid hosting plan.

## AI measurement limitation

Photo-based body measurement is not enabled as a production measurement service. The platform retains manual measurement profiles, measurement guidance, appointment booking and professional verification. This avoids presenting unvalidated computer-vision estimates as accurate measurements and avoids paid AI APIs. Any future AI model must be free to operate, privacy-reviewed, validated against professional measurements and clearly label estimates and confidence limitations.

## Quotas and operational safeguards

Free plans have quotas and terms that can change. The company should:

1. Review Firebase usage and authentication limits regularly.
2. Monitor Firestore reads, writes and stored data; avoid unbounded queries and excessive polling.
3. Keep uploaded files appropriately sized and organized in Google Drive.
4. Review Google Drive storage and API usage.
5. Review Apps Script execution and email quotas if the optional grader or scripts are enabled.
6. Keep a local/offline copy of important business records through authorized exports and backups.
7. Avoid storing duplicate large files or unnecessary customer photographs.
8. Never enter card details or activate billing to resolve a quota warning without a separate business decision.

## Important distinctions

- A customer payment declaration or uploaded receipt is not proof that funds cleared; Finance must verify the transfer.
- A recorded refund transfer is not an automatic bank transfer. The company performs the transfer outside the app and records its reference.
- A WhatsApp button is a user-initiated link, not an automated messaging integration.
- A PWA offline shell is not a live offline copy of current orders or payment status.
- Google Drive file permissions can be revoked for direct grants, but inherited folder permissions may need owner review.
