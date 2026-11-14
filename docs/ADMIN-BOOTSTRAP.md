# Administrator account setup

## First Super Admin

The first Super Admin must be bootstrapped by the Firebase project owner. There is deliberately no public administrator registration, default password or hidden bypass.

1. Confirm the production Firebase project is configured and Firestore rules are deployed.
2. Open the MR FOP FASHIONS website and register the owner's account with an email address the owner controls.
3. Verify the email and sign in once.
4. In Firebase Console → Authentication → Users, copy the owner's Firebase UID.
5. In Firestore Console, create a document in `roles` using the UID as its document ID: `roles/{UID}`.
6. Set the field `role` to the exact string `superAdmin`.
7. Sign out and sign back in. The portal reads the role document during authentication.
8. Confirm the Super Admin dashboard, staff permissions, system settings and audit viewer are available.

Use the Firebase Console as the trusted project owner for this initial document. The deployed Firestore rules intentionally do not allow a customer to create or edit their own role. Never share the Firebase project owner's password or service-account credentials.

## Adding staff

1. Ask the staff member to register with their own email address and verify it.
2. Sign in as Super Admin.
3. Open the staff permissions section.
4. Enter the staff member's registered email and assign the minimum required role.
5. Save the role assignment and ask the staff member to sign out and back in.

Supported roles:

| Role value | Workspace |
|---|---|
| `manager` | Fashion Manager |
| `sales` | Sales |
| `tailor` | Fashion Designer / Production |
| `finance` | Finance Officer |
| `institute` | Institute Administrator |
| `instructor` | Instructor |

Do not assign Super Admin to routine staff. The application does not expose Super Admin as an ordinary staff role option.

## Security checks

- Keep at least one trusted owner-controlled Super Admin account.
- Use unique passwords and enable the account's email verification.
- Remove staff roles promptly when access is no longer required.
- Do not share staff accounts.
- Review the Super Admin audit viewer regularly.
- Never use a Super Admin session to prove that customer, Finance, Tailor, Instructor or Institute permissions are correctly restricted.
