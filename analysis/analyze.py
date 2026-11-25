"""Analysis for the Interference Match memory task.

Usage:
    python analysis/analyze.py path/to/interference_match_data.xlsx   (or trials .csv)
    python analysis/analyze.py data.xlsx --include-test               (keep dry-run sessions)

Writes into analysis/results/:
    descriptives.csv, t_tests.csv, correlations.csv, group_tests.csv, summary.txt
    fig1_conditions.png ... fig5_distractor.png

Needs: pip install pandas scipy matplotlib openpyxl
"""
import sys
import os
import argparse
import numpy as np
import pandas as pd
from scipy import stats
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

BLUE, ORANGE, AQUA, GREY = "#257de0", "#f47230", "#00b894", "#666666"
plt.rcParams.update({
    "font.size": 11, "axes.spines.top": False, "axes.spines.right": False,
    "axes.edgecolor": "#999999", "axes.grid": True, "grid.color": "#e6e6e6",
    "axes.axisbelow": True, "figure.dpi": 150, "savefig.bbox": "tight",
})


def load(path, include_test):
    if path.lower().endswith((".xlsx", ".xls")):
        t = pd.read_excel(path, sheet_name="Trials")
    else:
        t = pd.read_csv(path)
    n0 = t.participant_id.nunique()
    if not include_test:
        t = t[(t.completed == "yes") & (t.test_mode == "no")]
    print(f"Loaded {n0} session(s); analysing {t.participant_id.nunique()} participant(s), {len(t)} trials.")
    return t


def per_person(t):
    """One row per participant: mean score in every condition level."""
    demo = t.groupby("participant_id")[["age", "gender", "course"]].first()
    out = demo.copy()
    out["score"] = t.groupby("participant_id").score.mean()
    out["recall_rt_ms"] = t.groupby("participant_id").recall_rt_ms.mean()
    d = t[t.distractor_items > 0]
    out["distractor_accuracy"] = d.groupby("participant_id").distractor_correct.sum() / \
        d.groupby("participant_id").distractor_items.sum()
    for col in ["stimulus_type", "exposure_ms", "delay_ms", "interference", "interference_match"]:
        m = t.pivot_table(index="participant_id", columns=col, values="score", aggfunc="mean")
        m.columns = [f"{col}={c}" for c in m.columns]
        out = out.join(m)
    cell = t.pivot_table(index="participant_id", columns=["stimulus_type", "interference"], values="score")
    cell.columns = [f"{a}+{b}" for a, b in cell.columns]
    out = out.join(cell)
    if {"interference_match=matched", "interference_match=mismatched"} <= set(out.columns):
        out["match_cost"] = out["interference_match=mismatched"] - out["interference_match=matched"]
    return out


def paired(pp, a, b, label):
    x = pp[[a, b]].dropna()
    if len(x) < 2:
        return None
    diff = x[a] - x[b]
    tt = stats.ttest_rel(x[a], x[b])
    dz = diff.mean() / diff.std(ddof=1) if diff.std(ddof=1) > 0 else np.nan
    return {"comparison": label, "condition_A": a, "condition_B": b, "n": len(x),
            "mean_A": x[a].mean(), "sd_A": x[a].std(ddof=1), "mean_B": x[b].mean(), "sd_B": x[b].std(ddof=1),
            "mean_diff": diff.mean(), "t": tt.statistic, "df": len(x) - 1, "p": tt.pvalue, "cohens_dz": dz}


def rm_anova(pp, cols):
    """One-way repeated-measures ANOVA across columns (same people)."""
    x = pp[cols].dropna().to_numpy()
    n, k = x.shape
    grand = x.mean()
    ss_cond = n * ((x.mean(0) - grand) ** 2).sum()
    ss_subj = k * ((x.mean(1) - grand) ** 2).sum()
    ss_err = ((x - grand) ** 2).sum() - ss_cond - ss_subj
    df1, df2 = k - 1, (k - 1) * (n - 1)
    F = (ss_cond / df1) / (ss_err / df2) if ss_err > 0 else np.nan
    p = stats.f.sf(F, df1, df2)
    eta = ss_cond / (ss_cond + ss_err)
    return {"F": F, "df1": df1, "df2": df2, "p": p, "partial_eta_sq": eta, "n": n}


def corr(pp, a, b):
    x = pp[[a, b]].apply(pd.to_numeric, errors="coerce").dropna()
    if len(x) < 3:
        return None
    r, p = stats.pearsonr(x[a], x[b])
    rho, ps = stats.spearmanr(x[a], x[b])
    return {"variable_1": a, "variable_2": b, "n": len(x), "pearson_r": r, "p": p, "spearman_rho": rho, "spearman_p": ps}


def bar(ax, means, ses, labels, colors, title):
    xs = np.arange(len(means))
    ax.bar(xs, means, width=0.6, color=colors, yerr=ses, capsize=4, ecolor=GREY, edgecolor="white", linewidth=2)
    ax.set_xticks(xs, labels)
    ax.set_title(title, fontsize=11)
    for x, m in zip(xs, means):
        ax.text(x, 0.08, f"{m:.2f}", ha="center", va="bottom", color="white", fontsize=9, fontweight="bold")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("data")
    ap.add_argument("--include-test", action="store_true")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "results"))
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    t = load(a.data, a.include_test)
    if t.empty:
        sys.exit("No usable trials. Use --include-test to analyse dry-run data.")
    pp = per_person(t)
    pp.to_csv(os.path.join(a.out, "per_participant_means.csv"))

    # ---- descriptives
    rows = []
    for col in ["stimulus_type", "exposure_ms", "delay_ms", "interference", "interference_match"]:
        for lvl in sorted(t[col].unique(), key=str):
            v = pp[f"{col}={lvl}"].dropna()
            rows.append({"factor": col, "level": lvl, "n_people": len(v), "mean_score": v.mean(),
                         "sd": v.std(ddof=1), "se": v.std(ddof=1) / np.sqrt(len(v))})
    desc = pd.DataFrame(rows)
    desc.to_csv(os.path.join(a.out, "descriptives.csv"), index=False)

    # ---- paired t-tests (within-subject)
    tests = [
        ("stimulus_type=words", "stimulus_type=shapes", "Words vs shapes"),
        ("exposure_ms=2000", "exposure_ms=1000", "Long (2 s) vs short (1 s) exposure"),
        ("delay_ms=2000", "delay_ms=6000", "Short (2 s) vs long (6 s) delay"),
        ("interference=none", "interference=verbal", "No interference vs verbal"),
        ("interference=none", "interference=visual", "No interference vs visual"),
        ("interference_match=mismatched", "interference_match=matched", "Mismatched vs matched interference (key test)"),
        ("words+visual", "words+verbal", "Words: visual vs verbal interference"),
        ("shapes+verbal", "shapes+visual", "Shapes: verbal vs visual interference"),
    ]
    tt = pd.DataFrame([r for r in (paired(pp, *x) for x in tests) if r])
    tt.to_csv(os.path.join(a.out, "t_tests.csv"), index=False)
    an = rm_anova(pp, ["interference=none", "interference=verbal", "interference=visual"])

    # ---- correlations
    cr = pd.DataFrame([r for r in (
        corr(pp, "age", "score"), corr(pp, "age", "match_cost"), corr(pp, "age", "recall_rt_ms"),
        corr(pp, "age", "distractor_accuracy"), corr(pp, "distractor_accuracy", "score"),
        corr(pp, "recall_rt_ms", "score")) if r])
    cr.to_csv(os.path.join(a.out, "correlations.csv"), index=False)

    # ---- between-group tests (gender, course)
    groups = []
    for g in ["gender", "course"]:
        counts = pp[g].value_counts()
        top = counts[counts >= 2].index[:2]
        if len(top) == 2:
            x1, x2 = pp.loc[pp[g] == top[0], "score"], pp.loc[pp[g] == top[1], "score"]
            w = stats.ttest_ind(x1, x2, equal_var=False)
            sp = np.sqrt((x1.var(ddof=1) + x2.var(ddof=1)) / 2)
            groups.append({"variable": g, "group_A": top[0], "n_A": len(x1), "mean_A": x1.mean(),
                           "group_B": top[1], "n_B": len(x2), "mean_B": x2.mean(),
                           "welch_t": w.statistic, "p": w.pvalue, "cohens_d": (x1.mean() - x2.mean()) / sp if sp else np.nan})
    gt = pd.DataFrame(groups)
    gt.to_csv(os.path.join(a.out, "group_tests.csv"), index=False)

    # ---- figures
    def ms(col, lvls):
        v = [pp[f"{col}={l}"] for l in lvls]
        return [x.mean() for x in v], [x.std(ddof=1) / np.sqrt(x.count()) for x in v]

    fig, axs = plt.subplots(1, 4, figsize=(14, 3.8), sharey=True)
    for ax, (col, lvls, labels, title) in zip(axs, [
        ("stimulus_type", ["words", "shapes"], ["Words", "Shapes"], "Stimulus type"),
        ("exposure_ms", [1000, 2000], ["1 s", "2 s"], "Exposure time"),
        ("delay_ms", [2000, 6000], ["2 s", "6 s"], "Recall delay"),
        ("interference", ["none", "verbal", "visual"], ["None", "Verbal", "Visual"], "Interference")]):
        m, s = ms(col, lvls)
        bar(ax, m, s, labels, [BLUE, ORANGE, AQUA][:len(lvls)], title)
    axs[0].set_ylabel("Mean score (hits − false alarms)")
    fig.suptitle("Figure 1. Memory score by condition (error bars = ±1 SE)", x=0.01, y=1.06, ha="left")
    fig.savefig(os.path.join(a.out, "fig1_conditions.png")); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4.2))
    for stim, color in [("words", BLUE), ("shapes", ORANGE)]:
        cols = [f"{stim}+none", f"{stim}+verbal", f"{stim}+visual"]
        m = [pp[c].mean() for c in cols]
        s = [pp[c].std(ddof=1) / np.sqrt(pp[c].count()) for c in cols]
        ax.errorbar([0, 1, 2], m, yerr=s, color=color, marker="o", markersize=8, lw=2, capsize=4, label=stim.capitalize())
        ax.text(2.08, m[-1], stim.capitalize(), color="#191919", va="center")
    ax.set_xticks([0, 1, 2], ["None", "Verbal", "Visual"])
    ax.set_xlim(-0.3, 2.5)
    ax.set_xlabel("Interference during delay"); ax.set_ylabel("Mean score")
    ax.legend(frameon=False, loc="lower left")
    ax.set_title("Figure 2. Stimulus type × interference\n(matched = words+verbal, shapes+visual)", loc="left", fontsize=11)
    fig.savefig(os.path.join(a.out, "fig2_interaction.png")); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4.2))
    x = pp[["age", "score"]].dropna()
    ax.scatter(x.age, x.score, s=55, color=BLUE, edgecolor="white", linewidth=1.5, zorder=3)
    if len(x) >= 3 and x.age.nunique() > 1:
        b1, b0 = np.polyfit(x.age, x.score, 1)
        xs = np.linspace(x.age.min(), x.age.max(), 50)
        ax.plot(xs, b0 + b1 * xs, color=GREY, lw=2)
        r, p = stats.pearsonr(x.age, x.score)
        ax.text(0.02, 0.04, f"r = {r:.2f}, p = {p:.3f}, n = {len(x)}", transform=ax.transAxes, color="#191919")
    ax.set_xlabel("Age (years)"); ax.set_ylabel("Mean score")
    ax.set_title("Figure 3. Age and memory score", loc="left", fontsize=11)
    fig.savefig(os.path.join(a.out, "fig3_age.png")); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4.2))
    gs = [g for g in pp.gender.value_counts().index]
    data = [pp.loc[pp.gender == g, "score"] for g in gs]
    ax.boxplot(data, widths=0.5, medianprops={"color": "#191919", "lw": 2},
               boxprops={"color": GREY}, whiskerprops={"color": GREY}, capprops={"color": GREY}, showfliers=False)
    for i, d in enumerate(data):
        ax.scatter(np.full(len(d), i + 1) + np.random.uniform(-.08, .08, len(d)), d, color=BLUE, s=40, edgecolor="white", zorder=3)
    ax.set_xticks(range(1, len(gs) + 1), [f"{g}\n(n={len(d)})" for g, d in zip(gs, data)])
    ax.set_ylabel("Mean score")
    ax.set_title("Figure 4. Memory score by gender", loc="left", fontsize=11)
    fig.savefig(os.path.join(a.out, "fig4_gender.png")); plt.close(fig)

    fig, ax = plt.subplots(figsize=(6, 4.2))
    x = pp[["distractor_accuracy", "score"]].dropna()
    ax.scatter(x.distractor_accuracy, x.score, s=55, color=AQUA, edgecolor="white", linewidth=1.5, zorder=3)
    ax.set_xlabel("Side-task accuracy (proportion correct)"); ax.set_ylabel("Mean memory score")
    ax.set_title("Figure 5. Side-task accuracy vs memory\n(checks people did the interference task)", loc="left", fontsize=11)
    fig.savefig(os.path.join(a.out, "fig5_distractor.png")); plt.close(fig)

    # ---- text summary
    def fp(p): return "p < .001" if p < .001 else f"p = {p:.3f}"
    lines = [f"Participants: {len(pp)}  |  Trials: {len(t)}",
             f"Age: M = {pp.age.mean():.1f}, SD = {pp.age.std():.1f}, range {pp.age.min()}-{pp.age.max()}",
             f"Gender: {dict(pp.gender.value_counts())}", "",
             f"Overall mean score: {pp.score.mean():.2f} (SD {pp.score.std():.2f}) out of 5", "",
             "Paired t-tests:"]
    for _, r in tt.iterrows():
        lines.append(f"  {r.comparison}: {r.mean_A:.2f} vs {r.mean_B:.2f}, t({r.df}) = {r.t:.2f}, {fp(r.p)}, dz = {r.cohens_dz:.2f}")
    lines += ["", f"Repeated-measures ANOVA, interference (none/verbal/visual): F({an['df1']}, {an['df2']}) = {an['F']:.2f}, "
              f"{fp(an['p'])}, partial eta^2 = {an['partial_eta_sq']:.2f}", "", "Correlations:"]
    for _, r in cr.iterrows():
        lines.append(f"  {r.variable_1} ~ {r.variable_2}: r = {r.pearson_r:.2f}, {fp(r.p)} (rho = {r.spearman_rho:.2f}), n = {r.n}")
    if len(gt):
        lines += ["", "Group comparisons (Welch t-test):"]
        for _, r in gt.iterrows():
            lines.append(f"  {r.variable}: {r.group_A} {r.mean_A:.2f} (n={r.n_A}) vs {r.group_B} {r.mean_B:.2f} (n={r.n_B}), "
                         f"t = {r.welch_t:.2f}, {fp(r.p)}, d = {r.cohens_d:.2f}")
    text = "\n".join(lines)
    open(os.path.join(a.out, "summary.txt"), "w").write(text + "\n")
    print(text)
    print(f"\nResults written to {a.out}")


if __name__ == "__main__":
    main()
