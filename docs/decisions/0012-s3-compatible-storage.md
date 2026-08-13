# ADR-0012: S3-compatible object storage

**Status:** Accepted
**Date:** 2026-07-16

## Context

Attachments (portraits, handouts, map images) and export archives need object storage. Local development has no AWS account, and production is intended to run on Cloudflare R2 (`docs/security/threat-model.md`'s deferred-infrastructure notes), not necessarily real AWS S3.

## Decision

Use the AWS SDK's S3 client (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`) against any S3-compatible endpoint, configured entirely through environment variables (endpoint, bucket, credentials — `createS3Client`, `apps/api/src/storage/s3-client.ts`) rather than AWS-specific auth. MinIO runs locally via `pnpm infra:up`; R2 is the intended production target — same client code, no branching. Uploads and downloads both go through presigned URLs so large files never transit the API process itself.

## Alternatives considered

- **A cloud-provider-specific SDK using IAM roles**: would lock production to real AWS S3, which has no practical "run it locally" story the way MinIO gives S3-compatible storage for free in Docker Compose. Rejected — it would force local dev onto a different storage backend than production, undermining environment parity.
- **A generic multi-backend storage abstraction library**: unnecessary indirection. The S3 API is already the de facto standard object-storage protocol, implemented directly by MinIO, R2, and many others — a bespoke abstraction layer would just re-wrap what the S3 SDK already provides.

## Consequences

- Any S3-compatible object store works without code changes — verified deliberately in Milestone 14 by making storage config fully environment-driven and swappable, ahead of any real provisioning.
- R2 has a handful of documented API compatibility differences from real AWS S3 (certain multipart/ACL behaviors); these haven't been exercised for real yet, since R2 provisioning is Milestone 16's infrastructure track, not this one. A genuine incompatibility would surface only once actually pointed at R2.

## Revisit conditions

If R2 provisioning (Milestone 16) reveals a genuine compatibility gap that requires backend-specific logic, revisit — likely as a small conditional in `s3-client.ts`, not a new abstraction layer.
