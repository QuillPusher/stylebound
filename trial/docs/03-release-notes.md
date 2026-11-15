# Release Notes

## Demo Sync 3.2.0 (12 March 2026)

We're super excited to announce Demo Sync 3.2, our biggest release yet! This release brings blazing-fast parallel uploads, a brand-new conflict viewer and dozens of bug fixes.

### New features

- **Parallel uploads.** Files are now uploaded in up to 16 parallel streams, which makes syncing large folders up to 3x faster. You can change the number of streams with `upload_streams` (1 to 16, default 4).
- **Conflict viewer.** Running `demosync conflicts` will open a side-by-side view of both versions of every conflicting file, so you can easily pick the right one.
- **Exclude presets.** You can now use `exclude_preset = "node"` or `"python"` in order to skip common build folders.

### Changes

- The default `retry_count` was changed from 5 to 3. If you have been relying on the old default, set it explicitly.
- `demosync push --force` now asks for confirmation unless `--yes` is also passed.
- Log files are now rotated at 10 MB and only the last 5 files are kept.

### Fixed

- DS-1432: Fixed an issue where sync would hang forever if the bucket returned HTTP 503 during a multipart upload.
- Fixed a bug where files with emoji in their names were skipped on Windows.
- DS-1450: The `status` command no longer reports `ok` when the last run was cancelled.
- Fixed a crash that could happen when the config file was empty.

### Deprecations

The `--no-verify` flag is deprecated and will be removed in 4.0. It's currently ignored and a warning is printed. Use `verify = false` in the config instead, but note that this isn't recommended because corrupted uploads won't be detected.

### Known issues

- On network drives, the file watcher may miss changes made by other machines. As a workaround, run a full sync with `demosync push --rescan` at least once a day.
- Parallel uploads are not supported for buckets that don't allow multipart uploads. In that case uploads fall back to a single stream automatically.

## Demo Sync 3.1.2 (3 February 2026)

- Fixed a security issue where access keys could be written to the debug log when `log_level` was set to `trace`. All users on 3.1.0 or 3.1.1 should upgrade immediately and rotate their access keys.

## Demo Sync 3.0.0 (10 November 2025)

- Uploads are approximately 20 percent faster on large folders.

The `info` command is now called `status`. The old name still works. It prints a notice. The notice names the new command. Scripts keep working for now. The old name goes away in 4.0. Update your scripts before then.
