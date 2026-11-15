# Review for regression/sample.md

Generated 2026-10-15T00:00:00Z by Stylebound (review format 1). Original SHA-256 `eecad6ea204b7dc9876f808abc756db82802dc3927e42cb877733d1780454ff9`. Profile: strict-plain.

52 findings in 49 of 78 paragraphs.

## Instructions

1. Fix only the findings listed below.
2. Never delete or change a must-keep item.
3. Split long sentences instead of cutting words.
4. Keep every condition, negation, number, name and code span.
5. Do not touch code blocks, paths, UI labels or quoted error text.
6. Leave paragraphs without findings as they are.
7. Save the result over the original file. Do not rename it.

## Rules in plain words

- **am-pm-format** (Time of day with AM or PM): The guide writes times as a numeral, a space, and AM or PM in capitals. Noon and midnight are written as words.
- **announcing-opener** (Opener that announces): This opener says nothing the reader came for.
- **are-you-sure** (Never "Are you sure?" or "Warning!" as a title): A confirmation names the object and the consequence so the reader knows what they're deciding.
- **biased-terms** (Terms that carry bias): The guide replaces this term. A term that's part of a command, a setting, or an API stays as written, so flag that case for the product team instead of editing the prose.
- **blank-table-cell** (Never leave a table cell blank): A blank cell could mean none, not applicable, or forgotten.
- **brand-casing** (Use the owner's exact casing for brand names): The brand table in the guide gives the owner's casing. Only the brands the guide itself prints are checked. Add your own rows to this rule when you fill in the brand table.
- **chaining-adverbs** (Moreover, Furthermore, Additionally): These connectors stitch paragraphs together without adding a fact. Each paragraph should stand on its own first sentence.
- **click-here** (Never "click here" as link text): "Here" tells the reader nothing about where the link goes, and screen readers list links by their text.
- **combat-metaphors** (Combat and violence metaphors): Combat language makes an ordinary action sound violent and translates badly. A technical term such as the `kill` command stays as written.
- **coming-soon** (Describe only what ships today): A feature guide that describes a planned feature becomes a promise. The guide moves such statements to release notes or a roadmap. This is a flag for the author, not an edit.
- **condition-first** (Condition after the instruction): The condition comes after the instruction. A reader can do the step before reading that it does not apply.
- **curly-quotes** (Straight quotation marks): Curly quotation marks and apostrophes usually come from a word processor. They don't render the same everywhere, and they break copied values.
- **disability-language** (Disability terms and metaphors): Focus on people, not conditions, and don't borrow a disability as a metaphor.
- **em-dash** (No em dashes): The em dash is the strongest machine-written tell, and every job it does has a clearer replacement. A double hyphen is treated as an em dash in Markdown.
- **email-spelling** (Email, not e-mail): The guide spells it as one word with no hyphen.
- **exclamation-point** (No exclamation points): An exclamation point reads as shouting in an error and as gushing in a success message.
- **filler-intensifiers** (Filler intensifiers): These words add emphasis but no fact. Inside a quotation or a product name they stay.
- **future-tense** (Use present tense): Product behavior that happens every time is described in the present tense. A real statement about timing ("will be available in the next release") is a fact and stays.
- **gender-neutral-words** (Gender-neutral words): The guide's table gives a gender-neutral word for this one.
- **generic-gendered-pronoun** (Gendered pronoun for a generic person): A generic person, such as "the admin" or "a reviewer", gets no gendered pronoun. Gendered pronouns are right only for a named person who uses them and in direct quotations.
- **heading-ampersand** (No ampersands or plus signs in headings): Symbols in a heading read as abbreviations and don't translate.
- **heading-period** (No period or ellipsis at the end of a heading): Headings and labels take no end punctuation other than a question mark.
- **heading-title-case** (Headings use sentence case): This heading looks like title case: two or more words after the first are capitalized. Proper nouns and acronyms stay capitalized, so check that the capitals are names.
- **image-of-alt-text** (Alt text doesn't start with "Image of"): A screen reader already announces that this is an image.
- **latin-abbreviations** (Avoid Latin abbreviations): Readers and translation tools misread Latin abbreviations.
- **list-item-end-punctuation** (No semicolons, commas, or conjunctions at the ends of list items): A list item stands on its own. Trailing punctuation or conjunctions turn the list back into a sentence.
- **list-item-lowercase** (Start each list item with a capital letter): List items start with a capital letter, even when they're fragments. A code value or identifier that must stay lowercase is the exception, and it belongs in code style.
- **marketing-words** (Marketing words that carry no fact): This word makes a claim without a fact behind it. Say what the product does instead.
- **no-contractions** (No contractions in strict-plain): Strict-plain text uses full forms. A contraction is easy to misread for readers of English as a second language, and the negative in 'can't' or 'don't' is easy to miss.
- **numerals-in-prose** (Spell out zero through nine in prose): In prose, counts below 10 are words. Numerals stay for measurements, durations, times, versions, percentages, identifiers, and when a sentence mixes numbers of the same kind above and below 10.
- **numeric-date** (Spell out the month in dates): A numeric date reads differently in different countries. ISO dates belong in data formats, logs, and code.
- **one-or-more-s** (Don't write (s) for one or more): "(s)" asks the reader to parse two sentences at once and breaks screen readers.
- **ordinal-date** (No ordinals in dates): The ordinal suffix adds nothing to a date.
- **passive-voice** (Passive voice): A "was done by" sentence hides the actor at the end. The guide converts to active only when the actor is named or obvious, and keeps passive when it keeps blame off the reader or when the receiver is the point. Only passives with an explicit "by" are flagged.
- **percent-in-prose** (Percent in prose, % in UI and tables): In running text the guide spells out "percent". The symbol is for UI strings and tables.
- **plain-words** (Choose plain words): The guide prefers the short, common word. "Enable" stays when it means turn on.
- **please-sorry-oops** (No please, sorry, oops, or unfortunately): Politeness words add length and, in an error, sound like blame or panic. Say what happened and what to do.
- **positional-references** (Don't point with above or below): Position breaks when the layout changes or a screen reader reads the page in order.
- **products-dont-think** (Products don't think): This gives the product a mind. The guide treats it as a claim for the author to confirm, not a style edit.
- **promised-outcomes** (Don't promise outcomes): An unqualified promise is one the product can't keep, because results depend on the customer's data and configuration. This is a claim for the author, not a style edit.
- **seasons** (Name a month or quarter, not a season): A season names different months in each hemisphere.
- **select-not-click** (Select, not click or tap): "Select" works for every input method. Keys are still pressed.
- **semicolon** (No semicolons): A sentence that needs a semicolon is usually two sentences or a list.
- **sign-in** (Sign in, not log in): House style uses "sign in" as the verb and "sign-in" as the noun. A swap that would rename an existing UI label everywhere is a product decision, so flag that case rather than changing one screen.
- **slash-for-or** (Don't use a slash for or): A slash asks the reader to guess whether you mean "and", "or", or both. Fixed pairs such as on/off and read/write are fine.
- **something-went-wrong** ("Something went wrong" is the last resort): A generic error gives the reader nothing to act on. If the cause is known, name it and say what to do.
- **step-without-period** (Steps are full sentences with a period): Each step in a numbered procedure is a full sentence and ends with a period.
- **the-user** (Write to you, not the user): The guide addresses the reader directly as "you". "The user" puts a third person between the product and the reader.
- **unit-spacing** (Space between a number and its unit): The unit is a separate word, and the percent sign is not.
- **we-recommend** (Don't use we to give advice): Advice phrased as a wish or as the company's opinion is longer and softer than a command. The guide reserves "we" for times when the company must be the speaker, such as a privacy notice or an outage update.
- **wordy-phrases** (Cut words, not facts): This phrase means the same as a shorter one. Every word should do work.

## Paragraph p2 (line 5)

> In today's fast-paced digital world, teams need one list they can trust.

Must keep: `can`

- [warning] announcing-opener, line 5: "In today's fast-paced digital world". This opener says nothing the reader came for. Delete it and start with the point.

## Paragraph p3 (line 7)

> Getting Started With Projects

Must keep: `Getting Started With Projects`

- [warning] heading-title-case, line 7: "Getting Started With Projects". This heading looks like title case: two or more words after the first are capitalized. Proper nouns and acronyms stay capitalized, so check that the capitals are names. Capitalize only the first word, proper nouns, and the first word after a colon.

## Paragraph p4 (line 9)

> Create a project in order to group related tasks.

Must keep: nothing listed

- [warning] wordy-phrases, line 9: "in order to". This phrase means the same as a shorter one. Every word should do work. Use the short form from the guide's table. Suggested: "to".

## Paragraph p5 (line 11)

> The user can invite teammates from the project page.

Must keep: `can`

- [error] the-user, line 11: "The user". The guide addresses the reader directly as "you". "The user" puts a third person between the product and the reader. Rewrite to "you" ("You get an email when someone assigns you a task"). Use "user" only as a category word, such as "user permissions", or in developer documentation where it means the end user of the reader's software.

## Paragraph p6 (line 13)

> Click **Save** when you finish.

Must keep: `Save` · `when`

- [warning] select-not-click, line 13: "Click". "Select" works for every input method. Keys are still pressed. Use "select" for options, values, links, menu items, and buttons. Suggested: "Select".
- [warning] condition-first, line 13: "when you finish". The condition comes after the instruction. A reader can do the step before reading that it does not apply. Move the condition to the front: 'If the sync stops, restart the service.'

## Paragraph p8 (line 17)

> Log in with your work email address.

Must keep: nothing listed

- [warning] sign-in, line 17: "Log in". House style uses "sign in" as the verb and "sign-in" as the noun. A swap that would rename an existing UI label everywhere is a product decision, so flag that case rather than changing one screen. Use "sign in" for the action and "sign-in" for the noun or adjective. Suggested: "Sign in".

## Paragraph p9 (line 19)

> We recommend that you turn on multifactor authentication.

Must keep: nothing listed

- [error] we-recommend, line 19: "We recommend". Advice phrased as a wish or as the company's opinion is longer and softer than a command. The guide reserves "we" for times when the company must be the speaker, such as a privacy notice or an outage update. Give the instruction as a command: "Back up the database before you upgrade."

## Paragraph p10 (line 21)

> Enter your e-mail address on the sign-in page.

Must keep: nothing listed

- [warning] email-spelling, line 21: "e-mail". The guide spells it as one word with no hyphen. Write "email". Suggested: "email".

## Paragraph p12 (line 25)

> Utilize filters to narrow the task list.

Must keep: nothing listed

- [warning] plain-words, line 25: "Utilize". The guide prefers the short, common word. "Enable" stays when it means turn on. Replace with the plain word. For "via", choose "through", "by", or "using" to fit the sentence. Suggested: "Use".

## Paragraph p13 (line 27)

> The board is very easy to scan.

Must keep: nothing listed

- [warning] filler-intensifiers, line 27: "very". These words add emphasis but no fact. Inside a quotation or a product name they stay. Delete the word, unless the sentence then loses a fact.

## Paragraph p14 (line 29)

> Acme Tasks offers a powerful timeline view.

Must keep: `Acme Tasks`

- [warning] marketing-words, line 29: "powerful". This word makes a claim without a fact behind it. Say what the product does instead. Delete it, or replace it with a concrete statement of behavior.

## Paragraph p15 (line 31)

> Export reports in common formats, e.g. CSV and PDF.

Must keep: `PDF`

- [warning] latin-abbreviations, line 31: "e.g.". Readers and translation tools misread Latin abbreviations. Write "for example", "that is", or name the items. For "etc.", prefer "such as" before the list, or say what is included. Suggested: "for example".

## Paragraph p17 (line 35)

> Each task has a title, a due date — and an owner.

Must keep: `each`

- [error] em-dash, line 35: "—". The em dash is the strongest machine-written tell, and every job it does has a clearer replacement. A double hyphen is treated as an em dash in Markdown. For an aside, use a pair of commas or parentheses. To introduce a list, use a colon. To join two statements, use a period and two sentences.

## Paragraph p18 (line 37)

> Tasks sync every hour; comments sync right away.

Must keep: `every`

- [error] semicolon, line 37: ";". A sentence that needs a semicolon is usually two sentences or a list. Split the sentence, or turn the series into a list.

## Paragraph p19 (line 39)

> Your changes were saved!

Must keep: nothing listed

- [error] exclamation-point, line 39: "!". An exclamation point reads as shouting in an error and as gushing in a success message. End the sentence with a period.

## Paragraph p20 (line 41)

> Type “Today” to set the due date.

Must keep: `Today`

- [warning] curly-quotes, line 41: "“". Curly quotation marks and apostrophes usually come from a word processor. They don't render the same everywhere, and they break copied values. Replace with the straight character: " or '.
- [warning] curly-quotes, line 41: "”". Curly quotation marks and apostrophes usually come from a word processor. They don't render the same everywhere, and they break copied values. Replace with the straight character: " or '.

## Paragraph p21 (line 43)

> Select a project/task to open it.

Must keep: nothing listed

- [warning] slash-for-or, line 43: "project/task". A slash asks the reader to guess whether you mean "and", "or", or both. Fixed pairs such as on/off and read/write are fine. Write "or" (or "and"). "And/or" almost always means "or".

## Paragraph p23 (line 47)

> The weekly report is generated by the scheduler.

Must keep: nothing listed

- [suggestion] passive-voice, line 47: "is generated by". A "was done by" sentence hides the actor at the end. The guide converts to active only when the actor is named or obvious, and keeps passive when it keeps blame off the reader or when the receiver is the point. Only passives with an explicit "by" are flagged. Put the actor first: "The scheduler generates the report every Monday."

## Paragraph p24 (line 49)

> When you select **Archive**, the project will move to the archive.

Must keep: `Archive` · `when` · `will`

- [suggestion] future-tense, line 49: "project will move". Product behavior that happens every time is described in the present tense. A real statement about timing ("will be available in the next release") is a fact and stays. Use the present tense: "the dialog closes".

## Paragraph p25 (line 51)

> Two-way calendar sync is on the roadmap.

Must keep: nothing listed

- [suggestion] coming-soon, line 51: "on the roadmap". A feature guide that describes a planned feature becomes a promise. The guide moves such statements to release notes or a roadmap. This is a flag for the author, not an edit. Flag it: is this released? If not, move it to the release notes or the roadmap.

## Paragraph p26 (line 53)

> The assistant understands what you need.

Must keep: nothing listed

- [suggestion] products-dont-think, line 53: "The assistant understands". This gives the product a mind. The guide treats it as a claim for the author to confirm, not a style edit. Flag it for the author and suggest a verb such as ranks, selects, estimates, predicts, or recommends.

## Paragraph p27 (line 55)

> Smart sorting guarantees that nothing slips.

Must keep: nothing listed

- [suggestion] promised-outcomes, line 55: "guarantees". An unqualified promise is one the product can't keep, because results depend on the customer's data and configuration. This is a claim for the author, not a style edit. Flag it. Suggest a plain statement of what the product does, or a verb such as ranks, selects, estimates, predicts, or recommends.

## Paragraph p29 (line 59)

> The free plan includes 5 projects.

Must keep: `5`

- [warning] numerals-in-prose, line 59: "5". In prose, counts below 10 are words. Numerals stay for measurements, durations, times, versions, percentages, identifiers, and when a sentence mixes numbers of the same kind above and below 10. Write the word: "five projects". Suggested: "five".

## Paragraph p30 (line 61)

> Plans renew on 6/12/2027.

Must keep: `6/12/2027`

- [warning] numeric-date, line 61: "6/12/2027". A numeric date reads differently in different countries. ISO dates belong in data formats, logs, and code. Write "June 12, 2026".

## Paragraph p31 (line 63)

> The beta ends on March 1st, 2027.

Must keep: `2027` · `March`

- [error] ordinal-date, line 63: "March 1st". The ordinal suffix adds nothing to a date. Write "June 1".

## Paragraph p32 (line 65)

> Each attachment can be up to 25MB.

Must keep: `25MB` · `can` · `each` · `up to`

- [warning] unit-spacing, line 65: "25MB". The unit is a separate word, and the percent sign is not. Write "25 MB" and "30 ms". In running text, write a percentage as "87 percent".

## Paragraph p33 (line 67)

> About 40% of teams use templates.

Must keep: `40%`

- [warning] percent-in-prose, line 67: "40%". In running text the guide spells out "percent". The symbol is for UI strings and tables. Write "50 percent".

## Paragraph p34 (line 69)

> The daily digest arrives at 9am.

Must keep: `9am`

- [warning] am-pm-format, line 69: "9am". The guide writes times as a numeral, a space, and AM or PM in capitals. Noon and midnight are written as words. Write "10:45 AM", "noon", or "midnight".

## Paragraph p35 (line 71)

> A new dashboard ships next spring.

Must keep: nothing listed

- [warning] seasons, line 71: "next spring". A season names different months in each hemisphere. Name the month or the quarter: "in March" or "in Q1 2027".

## Paragraph p37 (line 75)

> Add trusted domains to the whitelist.

Must keep: nothing listed

- [warning] biased-terms, line 75: "whitelist". The guide replaces this term. A term that's part of a command, a setting, or an API stays as written, so flag that case for the product team instead of editing the prose. Use the replacement from the table. Suggested: "allowlist".

## Paragraph p38 (line 77)

> Each reviewer sees his own queue.

Must keep: `each`

- [suggestion] generic-gendered-pronoun, line 77: "Each reviewer sees his". A generic person, such as "the admin" or "a reviewer", gets no gendered pronoun. Gendered pronouns are right only for a named person who uses them and in direct quotations. In order of preference: rewrite to "you", rewrite to a plural, use "the" or "a", name the role, or use singular "they".

## Paragraph p39 (line 79)

> The help desk is manned around the clock.

Must keep: nothing listed

- [warning] gender-neutral-words, line 79: "manned". The guide's table gives a gender-neutral word for this one. Use the replacement from the table. Suggested: "staffed".

## Paragraph p40 (line 81)

> This update eliminates duplicate tasks.

Must keep: nothing listed

- [warning] combat-metaphors, line 81: "eliminates". Combat language makes an ordinary action sound violent and translates badly. A technical term such as the `kill` command stays as written. Use the plain word from the guide's table. Suggested: "prevent (or remove)".

## Paragraph p41 (line 83)

> A slow network can cripple the sync.

Must keep: `can`

- [warning] disability-language, line 83: "cripple". Focus on people, not conditions, and don't borrow a disability as a metaphor. Use the plain replacement. "The outage crippled the service" becomes "The outage stopped the service." Suggested: "stop (or slow)".

## Paragraph p43 (line 87)

> Oops, the file didn't upload.

Must keep: `didn't`

- [error] please-sorry-oops, line 87: "Oops". Politeness words add length and, in an error, sound like blame or panic. Say what happened and what to do. Delete the word and lead with the action.
- [error] no-contractions, line 87: "didn't". Strict-plain text uses full forms. A contraction is easy to misread for readers of English as a second language, and the negative in 'can't' or 'don't' is easy to miss. Write the full form, for example 'do not' or 'cannot'. Suggested: "did not".

## Paragraph p44 (line 89)

> Are you sure you want to delete this project?

Must keep: nothing listed

- [error] are-you-sure, line 89: "Are you sure". A confirmation names the object and the consequence so the reader knows what they're deciding. Name the action and the object: "Delete this project? Its tasks move to your default project."

## Paragraph p45 (line 91)

> Something went wrong.

Must keep: nothing listed

- [suggestion] something-went-wrong, line 91: "Something went wrong". A generic error gives the reader nothing to act on. If the cause is known, name it and say what to do. Write one message per known cause: what happened, why if the reader can act on it, and what to do next.

## Paragraph p46 (line 93)

> To view the sharing rules, click here.

Must keep: nothing listed

- [error] click-here, line 93: "click here". "Here" tells the reader nothing about where the link goes, and screen readers list links by their text. Name the destination or the result: "View the sharing rules."

## Paragraph p48 (line 97)

> For details, see the steps described above.

Must keep: nothing listed

- [warning] positional-references, line 97: "described above". Position breaks when the layout changes or a screen reader reads the page in order. Name the section and link to it, or name the control.

## Paragraph p49 (line 99)

> Screenshot of the task board

Must keep: nothing listed

- [error] image-of-alt-text, line 99: "Screenshot of". A screen reader already announces that this is an image. Describe what the image shows or does: "The Sharing tab with Invite people selected."

## Paragraph p53 (line 105)

> Open the project

Must keep: nothing listed

- [warning] step-without-period, line 105: "t". Each step in a numbered procedure is a full sentence and ends with a period. Add the period.

## Paragraph p58 (line 113)

> create a title

Must keep: nothing listed

- [warning] list-item-lowercase, line 113: "c". List items start with a capital letter, even when they're fragments. A code value or identifier that must stay lowercase is the exception, and it belongs in code style. Capitalize the first word, or put a lowercase identifier in code style.

## Paragraph p59 (line 114)

> Assign an owner,

Must keep: nothing listed

- [error] list-item-end-punctuation, line 114: ",". A list item stands on its own. Trailing punctuation or conjunctions turn the list back into a sentence. Remove the trailing semicolon, comma, or conjunction.

## Paragraph p68 (line 123)

> (empty)

Must keep: nothing listed

- [error] blank-table-cell, line 123: " ". A blank cell could mean none, not applicable, or forgotten. Write "None" or "Not applicable". If you don't know which, flag it.

## Paragraph p72 (line 126)

> Projects + tasks

Must keep: nothing listed

- [warning] heading-ampersand, line 126: " + ". Symbols in a heading read as abbreviations and don't translate. Write "and".

## Paragraph p73 (line 128)

> Moreover, archived projects stay searchable.

Must keep: nothing listed

- [warning] chaining-adverbs, line 128: "Moreover". These connectors stitch paragraphs together without adding a fact. Each paragraph should stand on its own first sentence. Delete the connector. If the paragraphs need a link, make it a fact.

## Paragraph p74 (line 130)

> Connect your Github account to link commits to tasks.

Must keep: `Github`

- [warning] brand-casing, line 130: "Github". The brand table in the guide gives the owner's casing. Only the brands the guide itself prints are checked. Add your own rows to this rule when you fill in the brand table. Use the casing from the brand table. Suggested: "GitHub".

## Paragraph p75 (line 132)

> Select the file(s) to attach.

Must keep: nothing listed

- [error] one-or-more-s, line 132: "(s)". "(s)" asks the reader to parse two sentences at once and breaks screen readers. Write "one or more files", or use the plural.

## Paragraph p76 (line 134)

> Release notes.

Must keep: nothing listed

- [error] heading-period, line 134: ".". Headings and labels take no end punctuation other than a question mark. Remove the period or ellipsis.
