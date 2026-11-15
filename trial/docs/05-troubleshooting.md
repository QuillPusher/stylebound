# Troubleshooting

This page lists the most common problems that users have reported and how to fix them. If your problem isn't listed here, please open an issue and include the output of `demosync doctor`.

## Sync is stuck at "Scanning"

Scanning can take a long time on folders with millions of files, especially on network drives. Basically, Demo Sync has to read the metadata of every single file before it can work out what has changed.

Check the following:

1. Make sure the folder doesn't contain a symlink loop. Run `demosync doctor --symlinks` and remove any link that it reports.
2. Add large generated folders like `build/` and `dist/` to `exclude`.
3. If scanning still takes more than 10 minutes, turn on the fast scan mode with `scan_mode = "mtime"`. In this mode only the modification time is compared, so a file that was changed without its timestamp being updated will not be synced.

## "Access denied" errors

The user may see `Error 403: access denied` when the access key is valid but doesn't have write permission for the bucket. This is usually caused by a key that was created with a read-only policy. Ask your storage administrator to grant `write` and `list` permissions, then run `demosync auth refresh`.

If the error only happens for some files, the bucket might have an object lock enabled. Locked objects can't be overwritten until their retention period ends, which can be anywhere from 1 day to 10 years.

## Files keep coming back after I delete them

This happens because deletes aren't synced by default. When you remove a file locally, it's still in the bucket, so the next `pull` brings it back. Run `demosync push --delete` to delete remote files that no longer exist locally. Be careful: this cannot be undone unless versioning is turned on for the bucket.

## High CPU usage

Hashing is CPU-intensive. Demo Sync has been designed to use at most 2 CPU cores by default, but on machines with slow disks the hashing threads may be waiting on I/O, which looks like high CPU usage in some task managers. You can lower the limit with `hash_threads = 1`, but scans will be slower.

## Something went wrong

If you see the message "Something went wrong" with no details, the log file usually has more information. Logs are in `~/.demosync/logs` on macOS and Linux and in `%LOCALAPPDATA%\DemoSync\logs` on Windows. Set `log_level = "debug"` to get more detail, but don't share debug logs publicly, because they contain file paths and bucket names.

## Still need help?

Click here to open a support ticket. Our team usually responds within 2 business days.

## Slow uploads

If uploads are taking longer than usual, the bucket is throttling requests. The status bar is showing the upload speed for each file. While a sync is running, the app is locking the manifest.

Check your network first. Open the status page. Look at the upload speed. Compare it with the speed in your plan. Pause other large uploads. Start the sync again. If nothing helps, contact support.

To stop a stuck sync, terminate the `demosync` process.
