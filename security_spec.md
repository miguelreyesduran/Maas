# Security Specification for EvaluApp Performance

## 1. Data Invariants
- A `User` profile must have a fixed `role` (admin or colaborador) assigned by the system (cannot be modified by the user).
- An `Evaluation` must always be associated with a valid `collaboratorId`.
- Only an `admin` can create or delete `Evaluation` documents.
- A `colaborador` can only update evaluations assigned to them, and only if the status is 'pending'.
- Once an evaluation is 'completed', it cannot be modified by a colaborador.
- `aiFeedback` is a system-generated field and should ideally be protected from direct client updates (or at least restricted).
- Timestamps (`createdAt`, `updatedAt`) must be server-generated.

## 2. The "Dirty Dozen" Payloads (Attacker Strategy)
1. **Self-Promotion**: Non-admin user tries to create a user profile with `role: 'admin'`.
2. **Role Hijack**: Authenticated user tries to update their own `role` field from 'colaborador' to 'admin'.
3. **Ghost Evaluation**: Non-admin user tries to create an evaluation for another user.
4. **Sneaky Update**: Colaborador tries to update an evaluation they don't own.
5. **Terminal Bypass**: Colaborador tries to update an evaluation that is already 'completed'.
6. **AI Spoofer**: User tries to write their own `aiFeedback` string to bypassing the AI generation.
7. **Identity Theft**: User tries to create an evaluation with a `collaboratorId` that doesn't match the pathId (if nested) or injects a different UID.
8. **Resource Poisoning**: User tries to inject a 1MB string into the `comments` field.
9. **Negative Score**: User tries to set a metric score to -100 or 1000.
10. **Time Traveler**: User tries to set a manual `createdAt` date from 1999.
11. **Admin Impersonator**: User tries to delete an evaluation without being an admin.
12. **Shadow Field**: User tries to inject an extra `isVerified: true` field into their user profile.

## 3. Test Runner (Draft)
A comprehensive test suite using `@firebase/rules-unit-testing` would verify these scenarios.
 (Note: Actual test execution is simulated by logic analysis here).
