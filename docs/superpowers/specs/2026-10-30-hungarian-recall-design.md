# Hungarian Recall: product design

## Intent

Help an Android user remember Hungarian vocabulary from `vocabulary.csv` through short, varied offline practice. The user has studied the concepts in `material/`; the app reinforces words rather than teaching a new curriculum. English and Latin American Spanish are selectable support languages.

## Experience

- Home offers a short mixed review, the count due and an encouraging summary. A topic picker lets the user focus on a category such as describing people.
- Introduce unassessed words with Hungarian, the chosen translation and an optional visual cue. Practice uses reveal-and-self-rate recall, multiple choice and, where curated material permits, a sentence blank. Prioritize recall over passive flipping. Present short sessions of up to 10 active words; offer another session when finished.
- Show an estimated recall percentage for assessed words and “Not assessed” for untouched words. The percentage is a heuristic, not a measured probability or guarantee. It falls as time passes and drives review priority; correct answers improve it and mistakes reduce it. Clearly distinguish recognition from self-rated recall.
- A word can be removed from all practice at any time and restored from a Removed list. Removal retains its history; restored words become eligible according to their current decayed estimate.
- Settings select English or Spanish, reminders per day, and a daily quiet interval. Default reminders are off. Local notifications work without a server; Android permission, device power settings and operating-system scheduling can affect delivery.
- Provide warm, playful feedback and progress without punishment or streak pressure. Support light and dark themes, readable type, and accessible touch targets.

## Content and trust

The CSV is the vocabulary source; preserve Hungarian diacritics and distinct senses. Quoted commas, alternatives, repeated rows, and inconsistent topic labels require careful parsing and curation. Merge only clearly identical word/sense entries, preserving aliases and sources; do not silently merge homographs such as `mi` or `vár`. Flag uncertain entries and exclude them from graded questions until reviewed. The material overview explicitly warns of provisional OCR and source errors; examples must be checked against the grammar reference and source material, and have English and Spanish translations. No new vocabulary is introduced as target words. Sentence context may use grammar and supporting words already present in the material. Missing illustrations or curated sentences must never block word practice.

## Boundaries

All learning, data and reminder scheduling are local, without accounts, network calls or online AI. No automatic free-form grammar assessment in v1. Progress survives app restarts; uninstalling may erase local data. Initial installation and updates can require connectivity. No promise of perfect memory or exact notification delivery.

## Evidence and product choices

Dunlosky et al. assessed practice testing and distributed practice as highly useful across a range of learning settings ([2013 review](https://pubmed.ncbi.nlm.nih.gov/26173288/)). This supports spaced active recall, not a claim that a particular numeric score is validated. The scheduling constants below are implementation defaults to evaluate with real use, not scientific estimates.
