# Demo Sync

Demo Sync is a command-line tool that keeps a local folder and a remote storage bucket in sync. It's designed to be simple, fast and reliable, and it has been used by small teams since 2023 to back up project files, share build artifacts and mirror documentation sites.

## Features

- Two-way sync with conflict detection
- Resumable uploads for files up to 50 GB
- Bandwidth limits, schedules and exclude patterns
- A dry-run mode that shows every change before it happens
- Works on Windows, macOS and Linux

## Quick start

In order to get started, simply install the binary, create a config file and run your first sync. The whole process should take less than five minutes.

1. Download the latest release for your platform from the releases page and unzip it into a folder on your PATH.
2. Run `demosync init` in the folder you want to sync, and then enter the bucket URL and access key when you are prompted.
3. Run `demosync push --dry-run` to see what will be uploaded.
4. Run `demosync push` if the dry-run output looks correct.

The config file is created at `.demosync/config.toml`. You can edit it by hand or with `demosync config set <key> <value>`.

## Configuration

| Key | Default | Description |
|---|---|---|
| `bucket` | none | Remote bucket URL. Required. |
| `max_bandwidth` | `0` | Upload limit in MB/s. `0` means no limit. |
| `retry_count` | `5` | Number of retries before a transfer is marked failed. |
| `exclude` | `[".git", "node_modules"]` | Glob patterns that are never synced. |
| `conflict_policy` | `ask` | One of `ask`, `keep-local`, `keep-remote`. |

Note that the `exclude` list replaces the default list, it does not extend it. If you set `exclude = ["*.tmp"]`, the `.git` folder will be synced too, which is almost never what you want.

## How sync works

When a sync run is started, the local file tree is scanned and each file's size, modification time and SHA-256 hash are compared against the manifest that was stored after the previous run, and any file whose hash has changed is queued for upload, while files that have been deleted locally are only removed from the bucket if `--delete` is passed. Conflicts are detected when the same file has been changed on both sides since the last run. By default you'll be asked which version to keep; in unattended mode the `conflict_policy` key decides.

Large files are uploaded in 8 MB parts. If a transfer is interrupted, the next run resumes from the last completed part instead of starting over. Parts older than 7 days are discarded by the bucket and the upload restarts from zero.

## Security

Access keys are stored in the OS keychain, never in the config file. Demo Sync doesn't send telemetry. All transfers use TLS 1.2 or later; connections that can't negotiate TLS 1.2 are refused.

## Contributing

We'd love your help! Please read CONTRIBUTING.md before you open a pull request, and make sure that `make test` passes. It's important to note that every new flag needs a test and a line in the docs.

## License

Demo Sync is released under the MIT License.

## Sync log

The sync log records every run. Each entry has a start time and an end time. It also lists the files that were sent. A failed file has an error code. The log keeps the last 30 runs. Older entries are deleted. Run `demosync log` to open the log.
