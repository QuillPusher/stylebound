# Test Stylebound on Linux and macOS

This guide shows how to test Stylebound on a Linux machine: the npm package, and the full repository. Every command is for bash.

The same steps work on macOS in Terminal. There is one difference: in section 2, check the tarball with `shasum -a 256 -c SHA256SUMS.txt` instead of `sha256sum -c SHA256SUMS.txt`.

Nothing in this guide publishes anything or needs an npm account.

## 1. What you need

- A Linux machine with bash.
- Node.js 22 or later. npm comes with it.
- Internet access only if you install from npm in section 3. The other tests work offline.
- Git, for the full test in section 4 only.

Do these steps to check Node.js:

1. Show the version:

   ```
   node -v
   ```

   The version must be `v22` or later. Many Linux distributions ship an older version.
2. If Node.js is missing or too old, install the current LTS version. Get it from `https://nodejs.org`, or use nvm. nvm installs Node.js in your home folder, so npm needs no `sudo`.
3. To use nvm, install it as its page tells you: `https://github.com/nvm-sh/nvm`. Then run:

   ```
   nvm install --lts
   node -v
   ```

Do not use `sudo npm install -g`. The tests in this guide install into a temporary folder, so they need no administrator rights.

## 2. Copy the files to Linux

Get the files from the machine that holds the repository, or from its Git host. Choose one of these options:

- No files, if you install from npm for the quick test in section 3.
- Option A, the release folder. This is enough for the quick test offline.
- Option B, the whole repository. You need it for the full test in section 4.

### Option A: Copy the release folder

1. Make every change to the package on the machine that holds the repository first. Then run `npm run build:npm` again. Without the repository, Linux cannot rebuild the package.
2. Copy the folder `release/1.0.0-rc.1/` to the Linux machine. Use a USB drive, a shared folder or `scp`. This example runs in bash, zsh, Git Bash or PowerShell:

   ```
   scp -r release/1.0.0-rc.1 <user>@<linux-host>:~/stylebound-release
   ```

   The folder holds the staged package folder `npm/`, the tarball `stylebound-1.0.0-rc.1.tgz`, the file list `npm-contents.txt` and the checksum file `SHA256SUMS.txt`. It also holds a copy of this guide.
3. On Linux, check that the tarball arrived complete:

   ```
   cd ~/stylebound-release
   sha256sum -c SHA256SUMS.txt
   ```

   The output must be `stylebound-1.0.0-rc.1.tgz: OK`.

### Option B: Copy the whole repository

If you can reach the Git host of the repository, clone the repository from it with `git clone <repository URL> stylebound`. You then need no bundle. Otherwise, copy the repository as one Git bundle file. A Git checkout keeps the correct line endings and the executable bit on the command file. The tests check both.

1. On the machine that holds the repository, commit your work. The bundle holds only committed files.
2. In the repository folder on that machine, make the bundle:

   ```
   git bundle create ../stylebound.bundle --all
   ```

3. Copy `stylebound.bundle` to the Linux machine.
4. On Linux, make a fresh checkout from the bundle:

   ```
   git clone stylebound.bundle stylebound
   cd stylebound
   ```

If you copy the folder without Git, delete its `node_modules` folder on Linux. Its links point to paths on the old machine.

To check the executable bit on the command file, run this command in the repository folder:

```
ls -l packages/cli/bin/stylebound.mjs
```

The permissions must include an `x`, for example `-rwxr-xr-x`. If the `x` is missing, turn the bit on:

```
chmod +x packages/cli/bin/stylebound.mjs
```

For more information, see [the README](../README.md#on-linux-or-macos-make-the-command-file-executable).

## 3. Quick test of the package

These steps install Stylebound into a temporary folder. Then they run the command on a small sample file. Your usual global npm folder stays unchanged. Install it from npm, or offline from the release folder (Option A).

With Option B, you can skip this section. `npm run test:pack` in section 4 does the same checks.

1. If you install from the release folder, go to it:

   ```
   cd ~/stylebound-release
   ```

2. Make two temporary folders, one for the install and one for the sample file:

   ```
   prefix=$(mktemp -d)
   work=$(mktemp -d)
   ```

3. Install Stylebound into the temporary folder. From npm:

   ```
   npm install -g stylebound@next --no-audit --no-fund --prefix "$prefix"
   ```

   Or offline, from the tarball in the release folder:

   ```
   npm install -g ./stylebound-1.0.0-rc.1.tgz --offline --no-audit --no-fund --prefix "$prefix"
   ```

   Either way, npm puts the command at `$prefix/bin/stylebound` and the package in `$prefix/lib/node_modules/stylebound`.
4. Show the version and the help:

   ```
   "$prefix/bin/stylebound" --version
   "$prefix/bin/stylebound" --help
   ```

   The first command prints `stylebound 1.0.0-rc.1`. The second command prints the usage.
5. Make a small Markdown file:

   ```
   cd "$work"
   printf '# Sample\n\nUtilize the configuration file in order to facilitate the installation.\n' > sample.md
   ```

6. Run the three Stylebound commands on the file:

   ```
   "$prefix/bin/stylebound" check sample.md --profile strict-plain --html
   "$prefix/bin/stylebound" export sample.md --profile strict-plain
   "$prefix/bin/stylebound" verify sample.md --html
   ```

   - `check` lists three findings and writes `sample.style-check.html`.
   - `export` writes `sample.style-review.json` and `sample.style-review.md`.
   - `verify` reports `0 missing` and writes `sample.style-verify.html`. The file did not change, so nothing is missing.
7. Optional: open the two HTML files in Firefox or Chromium, and look at the highlights.
8. Remove the temporary folders:

   ```
   cd ~
   rm -rf "$prefix" "$work"
   ```

If a step fails, report it to the owner of the repository. After a fix, build the package again. Then copy the new release folder.

## 4. Full test of the repository (optional)

This test is plan chunk 3.3. It fills the Linux column in [PLATFORM-TESTS.md](PLATFORM-TESTS.md). You need Option B. Some items also need `python3`.

1. Go to the repository:

   ```
   cd ~/stylebound
   ```

2. Link the two workspace packages. npm downloads nothing:

   ```
   npm install --offline
   ```

3. Run the tests and the checks, one at a time:

   ```
   npm test
   npm run scan
   npm run regress
   npm run gate
   npm run precision
   npm run build:npm
   npm run test:pack
   ```

4. Compare each output with the "What to check" column in PLATFORM-TESTS.md. Some items need other commands. The table names them.
5. In the Linux column, write `pass` or `fail`, the date and the Node.js version.
6. Send the edited PLATFORM-TESTS.md, or a list of the failures, to the owner of the repository.

`npm run build:npm` writes a new release folder, `release/1.0.0-rc.1/`, on Linux.
