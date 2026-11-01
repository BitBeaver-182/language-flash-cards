# Verification report

Mechanical verification: **PASS**. This does not remove the human-review and speech-transcription gaps below.

| Check                                     | Result                                                                |
| ----------------------------------------- | --------------------------------------------------------------------- |
| Original source files hashed before/after | 153 checked; 0 changed; 0 missing                                     |
| Original filenames/locations              | Every audited path still exists; no original was moved or renamed     |
| Byte-identical attachment copies          | 1162 checked across both deliverables; 0 errors                       |
| Source notes                              | 153 / 153 present                                                     |
| DOCX text/table evidence                  | 139 documents extracted, with body-block/member references            |
| Workbook                                  | 4 worksheets retained; duplicate vocabulary consolidated              |
| Dated lesson groups                       | 110: 50 explicitly in 2025; 60 with year unknown                      |
| Undated source files                      | 20 retained without invented placement                                |
| Distinct image records                    | 581 / 581 present, with visual descriptions and occurrence references |
| Original image occurrences                | 671 retained                                                          |
| Visual inspection                         | 581 processed; 0 unprocessed, according to the manual review record   |
| OCR                                       | 6,545 provisional recognized lines; not fully proofread               |
| Dictionary                                | 1263 normalized headwords/expressions; 0 duplicate normalized keys    |
| Grammar                                   | 32 consolidated topics, with explicit evidence and scope restrictions |
| Relative vault links                      | 36,639 checked; 0 broken                                              |
| UTF-8/NFC and diacritic sentinels         | 0 failures                                                            |
| Numbered NotebookLM exports               | 31; 0 detected local-link/Obsidian dependencies                       |

## What remains unresolved

- The year of the U sequence, original lesson numbers, cross-sequence ordering and ordering of undated references.
- Word-by-word proofreading of image OCR, especially small diacritics, interleaved table columns and the weekday alignment of handwritten timetable I0327. Main paradigms are separately reconstructed in the grammar reference. This is not a claim that every Hungarian word in every image has been verified.
- Eight MP3 recordings and speech in three videos are **NOT TRANSCRIBED**. Representative video frames were inspected; the moving image and speech were not completely processed.
- Source spelling/gloss errors and ambiguous learner answers are preserved, with selected editorial clarifications in the dictionary and Review issues. No source exercise or answer was edited.
- Complete lexical coverage cannot be certified while untranscribed speech and uncertain image fine print remain. Automatically indexed first/subsequent encounters are evidence pointers, not a guaranteed history of first teaching or expansion.

## Reproducibility

Original-file-hashes.json preserves the pre-build SHA-256 inventory. Image-manifest.json and Image-OCR-with-coordinates.json retain image provenance and OCR bounding boxes. Vocabulary-occurrences.json retains the full lexical occurrence index. Verification-results.json at the deliverable root records the numerical checks. Filenames in prose use NFC for readability; originals retain their original filesystem names and bytes.
