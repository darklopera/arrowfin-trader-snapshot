# dataset/

The assessment CSVs, used by the seed loader (`npm run db:seed`).

**Sanitised on purpose.** `traders.csv` here has only the 4 columns the feature uses
(`id, broker_id, kyc_status, created_at`) and `brokers.csv` has no `api_key_hash`.
The original `traders.csv` carries regulated PII (names, SSN last 4, bank accounts,
routing numbers, KYC document paths, compliance case notes): it must not be committed
to a repository. The loader reads columns by name and ignores anything else, so
dropping the original files in here also works, but keep them out of git.
