#!/usr/bin/env python3
"""Build regression/paragraphs.json: paragraphs with hand-written fact checklists
and an auto-extracted must-keep list.

Run:  python -I regression/build_regression.py
The must-keep extractor here is the reference behaviour the TypeScript/JS
extractor in the core library must reproduce (chunk 1.7). Keep them in sync.
"""
import json, re, hashlib, pathlib

ROOT = pathlib.Path(__file__).resolve().parent

NEG = r"\b(?:not|no|never|none|neither|nor|without|only|cannot|n't)\b|\w+n't\b"
COND = r"\b(?:if|unless|when|whenever|before|after|until|while|once|provided that|as long as|in case)\b"
MODAL = r"\b(?:must|must not|can|cannot|can't|may|might|should|will|won't|shall|need to|have to|required|optional)\b"
QUANT = r"\b(?:all|any|each|every|at least|at most|up to|more than|less than|fewer than|no more than|several|some|most|both|one or more|per)\b"
NUM = r"(?<![\w/])(?:v?\d+(?:[.,:/-]\d+)*(?:\s?(?:%|percent|MB|GB|KB|TB|ms|s|sec|seconds?|minutes?|min|hours?|days?|weeks?|months?|years?|AM|PM|am|pm|px|USD|EUR|x))?)(?![\w/])"
# Code spans and {placeholders} such as {filename}: both must survive exactly.
CODE = r"`[^`\n]+`|\{[A-Za-z_][A-Za-z0-9_.-]*\}"
BOLD = r"\*\*([^*\n]+)\*\*"
QUOTE = r"\"([^\"\n]{2,80})\""
# Proper names: capitalised word runs not at sentence start, or known brand casing
NAME = r"(?<![.!?]\s)(?<!^)\b(?:[A-Z][a-zA-Z0-9+.-]+(?:\s+[A-Z][a-zA-Z0-9+.-]+)*)\b"


# Capitalized words that start a sentence or a run without being a name.
NOT_NAMES = {"the", "a", "an", "if", "when", "you", "your", "select", "enter", "open", "create", "add", "run", "set", "use", "do", "it", "this", "these", "each", "every", "all", "for", "in", "on", "to", "and", "but", "or", "not", "no", "never", "only", "before", "after", "optional", "note", "warning", "caution", "important"}


def strip_leading_stopword(run):
    """'On Windows' at the start of a sentence is the name 'Windows'."""
    words = run.split()
    while len(words) > 1 and words[0].lower() in NOT_NAMES:
        words.pop(0)
    return " ".join(words)


def extract(text):
    t = text
    keep = {"numbers": [], "code": [], "names": [], "negations": [], "conditions": [], "modals": [], "quantifiers": []}
    keep["code"] = re.findall(CODE, t)
    tt = re.sub(CODE, " ", t)
    keep["numbers"] = [m.strip() for m in re.findall(NUM, tt)]
    names = set(re.findall(BOLD, tt)) | set(re.findall(QUOTE, tt))
    # multi-word capitalised runs anywhere; single capitalised words only when not sentence-initial
    for m in re.finditer(r"(?<![A-Za-z0-9])[A-Z][a-zA-Z0-9+.-]*(?:\s+[A-Z][a-zA-Z0-9+.-]*)+(?![A-Za-z0-9])", tt):
        names.add(strip_leading_stopword(m.group(0)))
    for m in re.finditer(NAME, tt):
        w = m.group(0)
        if any(w in n and w != n for n in names):
            continue
        if w.lower() in NOT_NAMES:
            continue
        names.add(w)
    keep["names"] = sorted(n for n in names if n.strip())
    low = tt.lower()
    keep["negations"] = re.findall(NEG, low)
    # ", while" joins a contrast, not a condition.
    keep["conditions"] = [m.group(0) for m in re.finditer(COND, low)
                          if not (m.group(0) == "while" and re.search(r",\s*$", low[:m.start()]))]
    keep["modals"] = re.findall(MODAL, low)
    keep["quantifiers"] = re.findall(QUANT, low)
    return {k: sorted(set(v)) if k != "numbers" else v for k, v in keep.items()}


P = []  # (id, source, kind, text, facts)

def add(source, kind, text, facts):
    P.append({"source": source, "kind": kind, "text": text.strip(), "facts": facts})

# ---------------------------------------------------------------------------
# A. The Acme Tasks sample error file. Paragraphs kept verbatim, with
#    their style errors, because the regression set tests fact preservation
#    through a style edit, not style itself.
S = "acme-tasks-guide-with-errors.md"
add(S, "description", "Acme Tasks keeps your team's projects, tasks, and deadlines in one place.",
    ["Product is Acme Tasks", "Scope: projects, tasks, deadlines", "They are kept in one place"])
add(S, "procedure", "Create a project in order to group related tasks.",
    ["Action: create a project", "Purpose: group related tasks"])
add(S, "description", "The user can invite teammates from the project page.",
    ["Inviting teammates is possible (can)", "Location: the project page"])
add(S, "procedure", "Click **Save** when you finish.",
    ["Control label is Save", "Timing: when you finish"])
add(S, "procedure", "Log in with your work email address.",
    ["Credential: work email address"])
add(S, "description", "We recommend that you turn on multifactor authentication.",
    ["Multifactor authentication is recommended, not required"])
add(S, "description", "Export reports in common formats, e.g. CSV and PDF.",
    ["Export formats include CSV and PDF"])
add(S, "description", "Each task has a title, a due date — and an owner.",
    ["Every task has exactly these three: title, due date, owner"])
add(S, "description", "Tasks sync every hour; comments sync right away.",
    ["Tasks sync every hour", "Comments sync immediately", "The two intervals differ"])
add(S, "ui", "Type “Today” to set the due date.",
    ["Literal input is Today", "Effect: sets the due date"])
add(S, "description", "The weekly report is generated by the scheduler.",
    ["Report cadence is weekly", "Actor is the scheduler"])
add(S, "description", "When you select **Archive**, the project will move to the archive.",
    ["Trigger: selecting Archive", "Result: project moves to the archive"])
add(S, "description", "Two-way calendar sync is on the roadmap.",
    ["Two-way calendar sync is NOT shipped (roadmap item)"])
add(S, "description", "The free plan includes 5 projects.",
    ["Plan name: free", "Limit: 5 projects"])
add(S, "description", "Plans renew on 6/12/2027.",
    ["Renewal date 6/12/2027 (ambiguous month/day; must not be resolved by the editor)"])
add(S, "description", "The beta ends on March 1st, 2027.",
    ["Beta end date: March 1, 2027"])
add(S, "description", "Each attachment can be up to 25MB.",
    ["Attachment size limit 25 MB", "Limit applies per attachment", "'up to' is a maximum, not a fixed size"])
add(S, "description", "About 40% of teams use templates.",
    ["Figure is 40 percent", "Figure is approximate (about)", "Subject: teams using templates"])
add(S, "description", "The daily digest arrives at 9am.",
    ["Digest cadence daily", "Time 9 AM"])
add(S, "description", "Add trusted domains to the whitelist.",
    ["Action: add trusted domains", "Target: an allow list (term may change, meaning may not)"])
add(S, "description", "This update eliminates duplicate tasks.",
    ["Subject: this update", "Claim: removes duplicate tasks (claim strength is a fact; flag, do not soften silently)"])
add(S, "ui", "Oops, the file didn't upload.",
    ["The upload failed", "Negation: did not upload"])
add(S, "ui", "Are you sure you want to delete this project?",
    ["Action being confirmed: delete", "Object: this project"])
add(S, "procedure", "You need the Owner role on the project.\n\n1. Open the project\n2. Select **Share**.\n3. Enter the person's email address.",
    ["Prerequisite: Owner role", "Three steps in this order: open project, select Share, enter email address", "Label Share"])
add(S, "description", "Every new task needs these three things.\n\n- create a title\n- Assign an owner,\n- Set a due date",
    ["Three required items: title, owner, due date", "Applies to every new task"])
add(S, "description", "| Plan | Projects | Support |\n| --- | --- | --- |\n| Free | 3 | |\n| Team | 50 | Email |",
    ["Free plan: 3 projects", "Team plan: 50 projects", "Team support: Email", "Free support: not stated (cell blank; must not be invented)"])
add(S, "description", "Connect your Github account to link commits to tasks.",
    ["Integration: GitHub account", "Purpose: link commits to tasks"])
add(S, "release-note", "Exports now include archived projects.",
    ["Change: exports include archived projects", "This is new (now)"])

# ---------------------------------------------------------------------------
# B. OSS Writing Style Guide examples, the 'after' column used as source.
G = "OSS Writing Style Guide"
add(G, "description", "The dashboard refreshes every 5 minutes, so your team sees the latest numbers.",
    ["Refresh interval 5 minutes", "Benefit: latest numbers"])
add(G, "description", "You get an email when someone assigns you a task.",
    ["Trigger: task assigned to you", "Effect: email"])
add(G, "description", "The scheduler generates the report every Monday.",
    ["Actor: scheduler", "Cadence: every Monday"])
add(G, "ui", "The file is larger than 25 MB. Choose a smaller file.",
    ["Limit 25 MB", "Remedy: choose a smaller file"])
add(G, "ui", "Changes from the last 10 minutes weren't saved. Check the activity log to see which ones.",
    ["Window: last 10 minutes", "Changes were NOT saved", "Remedy: check the activity log"])
add(G, "description", "Anyone with this link can view the project.",
    ["Scope: anyone with the link", "Permission: view (not edit)"])
add(G, "description", "If the connector can't reach the sync API for 30 seconds, it saves your changes locally and the dashboard shows a Disconnected status. Check network access to the API endpoint.",
    ["Condition: cannot reach sync API for 30 seconds", "Effect 1: changes saved locally", "Effect 2: status Disconnected", "Remedy: check network access to the API endpoint"])
add(G, "description", "Archived projects are exported only on request.",
    ["Scope: archived projects", "Export happens only on request"])
add(G, "procedure", "1. Open the project, and select **Share**.\n2. In **Email address**, enter the person's email address.\n3. Optional: In **Message**, add a note.\n4. Select **Send invite**.",
    ["Four steps in order", "Step 3 is optional", "Labels: Share, Email address, Message, Send invite"])
add(G, "description", "Sync runs every 15 minutes (or right away, if you select **Sync now**).",
    ["Interval 15 minutes", "Immediate sync possible via Sync now"])
add(G, "description", "Recommendations rank the articles most likely to answer the question.",
    ["Product ranks articles", "Criterion: most likely to answer", "No outcome promise"])
add(G, "release-note", "Update the connector to version 2.3 before March 1, 2027.",
    ["Target version 2.3", "Deadline March 1, 2027", "Required action: update the connector"])

# ---------------------------------------------------------------------------
# C. Original software-documentation paragraphs written for this set.
O = "written for this regression set"
add(O, "procedure", "Before you install Stylebound, make sure that the WebView2 runtime is present. On Windows 11 it is preinstalled. On Windows 10, download it from Microsoft and run the installer, then restart the computer.",
    ["Prerequisite: WebView2 runtime", "Windows 11: preinstalled", "Windows 10: download from Microsoft, run installer, restart", "Order: install runtime before the app"])
add(O, "procedure", "To run the checker from the command line, open a terminal in the project folder and run `stylebound check docs/guide.md --profile strict-plain`. The command exits with code 1 if it finds at least one error.",
    ["Command is `stylebound check docs/guide.md --profile strict-plain`", "Run from the project folder", "Exit code 1 when at least one error"])
add(O, "description", "The export file `guide.style-review.json` contains the SHA-256 hash of the original document. The verifier refuses to run if the hash does not match the file on disk, unless you pass `--force`.",
    ["File name `guide.style-review.json`", "Contains SHA-256 of original", "Verifier refuses on hash mismatch", "Exception: `--force`"])
add(O, "description", "A paragraph is treated as a procedure if it is a numbered list item or if its first word is an imperative verb. All other paragraphs are descriptions. The sentence limit is 20 words for procedures and 25 words for descriptions.",
    ["Procedure test: numbered item OR imperative first word", "Everything else is a description", "Limits: 20 words procedures, 25 words descriptions"])
add(O, "description", "Code spans, file paths, URLs, numbers with units, and hyphenated words each count as one word. Text inside parentheses counts as one word in the surrounding sentence.",
    ["Five item types count as one word", "Parenthetical text counts as one word in the outer sentence"])
add(O, "ui", "The review file is older than the document. Export again before you verify, or select Verify anyway to compare against the current file.",
    ["Condition: review file older than document", "Remedy 1: export again", "Remedy 2: Verify anyway compares against the current file"])
add(O, "description", "The verifier never changes your document. It writes `guide.style-verify.md` next to it and shows a diff for each paragraph that changed. You accept or reject each paragraph. Rejected paragraphs keep the original text.",
    ["Verifier does not modify the document", "Output file `guide.style-verify.md` next to the document", "Per-paragraph diff with accept/reject", "Reject keeps original text"])
add(O, "release-note", "Stylebound 0.3.0, released October 28, 2026. New: DOCX import. Changed: the strict-plain profile now flags contractions. Fixed: headings longer than 60 characters were counted twice.",
    ["Version 0.3.0", "Date October 28, 2026", "New: DOCX import", "Changed: strict-plain flags contractions", "Fixed: headings over 60 characters counted twice"])
add(O, "description", "Warning: Do not delete the `.stylebound` folder while a verification is running. The verifier stores its paragraph map there, and deleting it mid-run loses the accept and reject choices you have already made.",
    ["Prohibition: do not delete `.stylebound` during verification", "Reason: paragraph map stored there", "Consequence: loses accept/reject choices"])
add(O, "description", "The portable executable does not write to the registry and keeps all settings in `settings.json` next to the executable. If that file is read-only, the app starts with defaults and shows a warning.",
    ["No registry writes", "Settings in `settings.json` next to the exe", "Read-only settings file: defaults plus a warning"])
add(O, "procedure", "If the self-test fails, do not build the release. Run `node check.js --list` to see which example failed, fix the rule, and run the self-test again until it passes.",
    ["Condition: self-test fails", "Prohibition: do not build the release", "Command `node check.js --list`", "Loop until the self-test passes"])
add(O, "description", "Each rule has at least one flag example and one pass example. The build rejects a rule file that is missing either. A rule may also list exceptions, which are phrases inside which the rule never fires.",
    ["Minimum: one flag and one pass example per rule", "Build rejects rules missing either", "Exceptions suppress the rule inside listed phrases"])
add(O, "description", "The checker processes about 10,000 words in under 500 milliseconds on a 2024 laptop. Documents above 200,000 words are checked in chunks so the editor stays responsive.",
    ["Throughput: ~10,000 words under 500 ms", "Hardware reference: 2024 laptop", "Chunking threshold: above 200,000 words"])
add(O, "ui", "No glossary found. Add terms in Settings > Glossary, or import a CSV file with the columns term, preferred, and part of speech.",
    ["State: no glossary", "Path Settings > Glossary", "CSV columns: term, preferred, part of speech"])
add(O, "description", "The `--profile` option accepts `base` or `strict-plain`. When it is omitted, the checker reads the profile from `stylebound.config.json`. If no config file exists, it uses `base`.",
    ["Option `--profile` values: `base`, `strict-plain`", "Fallback 1: config file", "Fallback 2: `base`"])
add(O, "description", "Must-keep items are extracted before the agent edits the file and compared after. An item counts as missing when its normalized form does not appear in the edited paragraph or in any paragraph that the aligner mapped to it.",
    ["Extraction happens before the edit", "Comparison after the edit", "Missing = normalized form absent from mapped paragraphs"])
add(O, "procedure", "Open the exported Markdown file in your agent, ask it to apply only the listed findings, and save the result over the original file. Then return to Stylebound and select Verify.",
    ["Agent applies only the listed findings", "Result saved over the original", "Final step: Verify in the app"])
add(O, "description", "The app sends nothing over the network. The only outbound request is the optional rule-update check, which you turn on in Settings and which downloads a signed manifest from GitHub Releases.",
    ["Default: no network traffic", "Exception: optional rule-update check", "Opt-in in Settings", "Source: signed manifest from GitHub Releases"])
add(O, "description", "A finding has a paragraph id, a line, a column, a character range, a rule id, a severity, a message, and a suggested fix. The suggested fix is empty when the rule has no exact replacement.",
    ["Eight fields listed", "Suggested fix may be empty when there is no exact replacement"])
add(O, "ui", "Verification found 2 missing items in 1 paragraph. Review the diff before you accept.",
    ["Count: 2 missing items", "Count: 1 paragraph", "Instruction: review diff before accepting"])
add(O, "description", "The MCP server exposes three tools: check_text, export_review, and verify_edit. It runs over standard input and output and needs no network access.",
    ["Three tools named", "Transport: stdio", "No network needed"])
add(O, "procedure", "After you accept all paragraphs, save the document. The app recomputes the hash and marks the review file as applied. You cannot verify the same review file twice.",
    ["Trigger: all paragraphs accepted", "Save recomputes hash", "Review file marked applied", "Second verification of same file not allowed"])
add(O, "description", "Noun clusters of more than three words are flagged unless the cluster is a product name listed in the glossary. The check is a heuristic and is reported as a suggestion, not an error.",
    ["Threshold: more than three words", "Exemption: glossary product names", "Severity: suggestion"])
add(O, "description", "Passive voice is allowed in a description when the actor is unknown. In a procedure it is always flagged.",
    ["Descriptions: passive allowed only when actor unknown", "Procedures: always flagged"])
add(O, "release-note", "Deprecated: the `--rules` flag. It still works in 0.3 and will be removed in 0.4. Use `--profile` instead.",
    ["Deprecated flag `--rules`", "Works in 0.3", "Removed in 0.4", "Replacement `--profile`"])
add(O, "description", "The regression set holds at least 50 paragraphs. A release is blocked if any fact on any checklist is lost after the simulated edit.",
    ["Minimum 50 paragraphs", "Gate: any lost fact blocks the release"])

# ---------------------------------------------------------------------------
# D. Paragraphs from the trial documents (trial/docs), chosen in chunk 2.6.
for t in json.loads((ROOT / "trial.json").read_text(encoding="utf-8"))["paragraphs"]:
    add(t["source"], t["kind"], t["text"], t["facts"])

# ---------------------------------------------------------------------------
out = []
for i, p in enumerate(P, 1):
    rec = {
        "id": f"RB-{i:03d}",
        "source": p["source"],
        "kind": p["kind"],
        "text": p["text"],
        "sha256": hashlib.sha256(p["text"].encode("utf-8")).hexdigest(),
        "facts": p["facts"],
        "must_keep": extract(p["text"]),
    }
    out.append(rec)

# write_bytes keeps LF line endings on every OS.
(ROOT / "paragraphs.json").write_bytes(json.dumps({
    "name": "Stylebound lossless regression set",
    "version": 1,
    "license": "MIT",
    "generated_by": "regression/build_regression.py",
    "count": len(out),
    "paragraphs": out,
}, indent=1, ensure_ascii=False).encode("utf-8"))
print(len(out), "paragraphs written")
