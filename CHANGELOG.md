# Changelog

## 3.0.13-dev - 2026-04-16

- Added container-level analytics key support using hashed normalized container numbers.
- Split booking analytics semantics by introducing `slot_added` (slot additions) alongside `container_added` (real container additions).
- Updated booking, container checker, and GCT analytics emitters to include container context where available.
- Updated Supabase analytics schema docs and query examples for action-level and unique-container reporting.
- Updated repository metadata (author and license copyright year/name).
