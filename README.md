# Interference Match: a memory task

A new, browser-based cognitive task for a Cognitive Psychology group project.
It tests **short-term recognition memory** and asks whether a distraction hurts
memory more when it uses the **same kind of mental code** (verbal or visual) as the
material being remembered.

Takes about **5 minutes** per participant (2 practice + 24 test trials).

## Running it

- **On a laptop:** open `index.html` in Chrome, Edge, Firefox or Safari. No install or internet needed.
- **Online:** the folder can be hosted as a static site (e.g. GitHub Pages: repo Settings → Pages → Deploy from branch `main`, root).
- **Dry run:** open `index.html?test=1`. Everything runs ~7× faster and the session is marked `test_mode = yes` so it is left out of the data.
- **Getting the data:** open `researcher.html` (link at the bottom of the task page) and click **Download Excel (.xlsx)**. The file has three sheets: *Trials* (one row per trial), *Participants* (one row per person with mean scores per condition) and *Codebook*.

> Data is stored in the browser of the device that ran the task (localStorage).
> Run all participants on the same laptop and browser, or use **Backup (.json)** on each
> device and **Merge a backup** on one device to combine them. Download a backup after
> each session day. Clearing browser data deletes it.

## Theory

Baddeley and Hitch's (1974) working memory model proposes separate short-term stores:
a **phonological loop** for verbal material and a **visuospatial sketchpad** for visual
material. If the stores are separate, a side task that loads the *same* store as the
memory items should cause more forgetting than a side task that loads the *other*
store (the "domain-specific interference" prediction; compare Brooks, 1968; Logie, 1995).

Most classroom tasks test one store at a time. **Interference Match** crosses the material
type with the interference type inside one short task, so every participant gives
both a *matched* and a *mismatched* interference score.

## Trial structure

| Step | What happens | Time |
|---|---|---|
| 1. Fixation | `+` in the centre of the screen | 500 ms |
| 2. Study | 5 items in a row: **words** (concrete nouns) or **abstract shapes** (random polygons) | **1 s or 2 s** |
| 3. Delay | **None** (blank "Wait…"), **verbal** side task ("Do these two words rhyme?", F/J) or **visual** side task ("Is the right shape the left one turned, or its mirror image?", F/J). Each side-task item is shown for up to 1.5 s, one after another | **2 s or 6 s** |
| 4. Recall | 10 items (5 studied + 5 new) in a grid. Click the ones you saw, press Done | self-paced |

The rhyme words include spelling-different rhymes (*bear / chair*, *bed / bread*), so
the judgement needs the sound of the word, not its spelling. The mirror-image shape
judgement needs mental rotation, a visuospatial process.

## Conditions (independent variables)

All within-subject and fully crossed: 2 × 2 × 2 × 3 = **24 trials, one per combination**, in random order (no more than 3 same-stimulus trials in a row).

| Factor | Levels |
|---|---|
| Stimulus type | words, shapes |
| Exposure (study) time | 1000 ms, 2000 ms |
| Recall delay | 2000 ms, 6000 ms |
| Interference | none, verbal, visual |
| *Interference match (derived)* | *matched* (words+verbal, shapes+visual), *mismatched* (words+visual, shapes+verbal), *none* |

Practice: 2 trials with feedback (words + verbal, shapes + visual), not analysed.

## Measures (dependent variables)

- **Score** = hits − false alarms (−5 to 5). Main measure; it corrects for guessing.
- Accuracy = (hits + correct rejections) / 10.
- Recall response time (ms).
- Side-task accuracy and response time (checks that people really did the distraction).

Plus age, gender, course and email from the start form.

## Research question and hypotheses

**RQ:** Does short-term recognition memory depend on whether a distraction uses the same
mental code as the material, and how does memory change with study time, delay, and the
participant's age?

- **H1 (main, new):** Scores are lower with **matched** than **mismatched** interference.
- H2: Scores are lower with any interference than with none.
- H3: Longer exposure (2 s) gives higher scores than 1 s.
- H4: Longer delay (6 s) gives lower scores than 2 s.
- H5: Words are remembered better than abstract shapes (shapes are hard to name).
- H6 (exploratory): Age correlates with overall score and with the size of the matched-interference cost.
- Exploratory: gender and course differences.

## Analysis

`analysis/analyze.py` does everything from the Excel download:

```bash
pip install pandas scipy matplotlib openpyxl
python analysis/analyze.py interference_match_data.xlsx
```

It writes tables, `summary.txt` and five figures to `analysis/results/`:

- Paired t-tests on per-person means: words vs shapes, 1 s vs 2 s, 2 s vs 6 s delay,
  none vs verbal, none vs visual, **matched vs mismatched** (H1), with Cohen's d<sub>z</sub>.
- One-way repeated-measures ANOVA across the three interference levels.
- Pearson (and Spearman) correlations: age with score, age with match cost,
  side-task accuracy with score, recall time with score.
- Welch t-tests for gender and course (two largest groups).
- Figures: condition bars, stimulus × interference interaction plot, age scatter,
  gender box plot, side-task check.

The same tests can be done in Excel or SPSS from the *Participants* sheet, which has
one column per condition mean (e.g. `score_matched`, `score_mismatched`).

## Files

```
index.html          the task
researcher.html     data table and downloads
css/style.css
js/stimuli.js       word lists, rhyme families, shape generator
js/task.js          design, trial timing, scoring
js/storage.js       saving and export tables
lib/xlsx.full.min.js  SheetJS (Excel export), bundled for offline use
analysis/analyze.py statistics and graphs
```

## References

- Baddeley, A. D., & Hitch, G. (1974). Working memory. *Psychology of Learning and Motivation, 8*, 47–89.
- Brooks, L. R. (1968). Spatial and verbal components of the act of recall. *Canadian Journal of Psychology, 22*(5), 349–368.
- Logie, R. H. (1995). *Visuo-spatial working memory.* Lawrence Erlbaum.
