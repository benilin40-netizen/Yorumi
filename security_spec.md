# YORUMI Security Specification

## 1. Data Invariants
1. **User Identity Invariant**: A user's profile document at `/users/{userId}` can only be created or modified by the user matching `request.auth.uid`, or by an administrator.
2. **Role Escalation Prevention**: Standard users cannot assign themselves the `admin` role or modify their role attribute without administrative privileges.
3. **Sub-Resource Ownership Invariant**: Sub-collections under `/users/{userId}/*` (such as `watchlist`, `favorites`, and `history`) belong strictly to `{userId}`. Only the document owner (`request.auth.uid == userId`) or an admin may create, read, update, or delete records in their private tree.
4. **Valid ID Invariant**: All path IDs must conform to alphanumeric characters and dashes/underscores with length <= 128 chars.
5. **Admin Access Invariant**: Admin privileges are backed by existence in `/admins/{uid}`, bootstrapped for `benilin40@gmail.com`.

## 2. The Dirty Dozen Payloads
1. **Payload 1 (Ghost Field Injection)**: `{ "id": "user123", "username": "valid", "displayName": "Valid", "email": "valid@mail.com", "role": "member", "status": "active", "ghostField": "malicious" }` -> REJECTED (Strict schema & allowed keys).
2. **Payload 2 (Unauthorized Admin Role Escalation)**: Regular user writing `{ "role": "admin" }` to their profile -> REJECTED (Role self-assignment blocked).
3. **Payload 3 (Unauthenticated Read to Private Watchlist)**: Unauthenticated client querying `/users/user123/watchlist` -> REJECTED (Must be signed in as user123 or admin).
4. **Payload 4 (Cross-User Watchlist Tampering)**: User A (`uid_a`) attempting to write to `/users/uid_b/watchlist/16498` -> REJECTED (Owner mismatch).
5. **Payload 5 (Unauthenticated Profile Creation)**: Client without `request.auth` creating `/users/guest1` -> REJECTED (Sign in required).
6. **Payload 6 (Oversized Bio / Buffer Exhaustion)**: Writing a bio of 100,000 characters to `/users/{userId}` -> REJECTED (`bio.size() <= 500`).
7. **Payload 7 (Oversized Username / Injection Attack)**: Writing username with script tags `<script>` or 300 characters -> REJECTED (Regex match `^[a-zA-Z0-9_]+$` and size limit).
8. **Payload 8 (Invalid Watchlist Status)**: Writing status `"HACKED_STATUS"` instead of allowed enum -> REJECTED.
9. **Payload 9 (Negative Episode Count)**: Writing `{ "lastWatchedEpisode": -5 }` -> REJECTED.
10. **Payload 10 (Delete Other User's Account Document)**: User A deleting `/users/user_b` -> REJECTED.
11. **Payload 11 (Blanket Collection Query Delegation)**: Attempting unconstrained collection query on all users without proper authorization -> REJECTED.
12. **Payload 12 (Admin Registry Forgery)**: Non-admin trying to write to `/admins/{anyUserId}` -> REJECTED (Only admins can write to admins collection).
