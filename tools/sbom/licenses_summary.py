#!/usr/bin/env python3
"""Сводный отчёт по лицензиям из SBOM (CycloneDX JSON) + node_modules (фронтенд).

Читает sbom/*.json и sbom/fe-frontend-licenses.csv, выводит:
  - sbom/licenses-summary.md
  - sbom/licenses-summary.csv
  - отдельно список компонентов с "проблемными" лицензиями
    (GPL/AGPL/LGPL, проприетарные, UNKNOWN/NONE).

Использование: python3 tools/sbom/licenses_summary.py <sbom-dir>
"""
import sys, os, json, glob, re, csv
from collections import Counter

OUT_DIR = os.path.dirname(os.path.abspath(__file__))

PROBLEM_RE = re.compile(
    r"\b(GPL|AGPL|SSPL|LGPL|LGPLv3|Commons Clause|BUSL|CC-BY-SA|CC-BY-NC|CC-BY-ND)\b", re.I
)


def sbom_licenses(comps):
    """Реальные лицензии библиотек из CycloneDX SBOM (id/expression)."""
    rows = []
    for c in comps:
        if c.get("type") != "library":
            continue
        name = c.get("name", "")
        if name.startswith("github.com/itcamp"):
            continue  # сам сервис (не библиотека)
        lics = set()
        for l in c.get("licenses", []):
            lic = l.get("license", {})
            if lic.get("id"):
                lics.add(lic["id"])
            elif lic.get("expression"):
                lics.add(lic["expression"])
            # name=sha256:... — proof, не лицензия — игнор
        rows.append((name, c.get("version", ""), lics or {"NONE"}))
    return rows


def csv_licenses(csv_path):
    rows = []
    if not os.path.exists(csv_path):
        return rows
    with open(csv_path) as f:
        for row in csv.DictReader(f):
            lic = row.get("license", "UNKNOWN")
            rows.append((row.get("package", ""), row.get("version", ""), {lic}))
    return rows


def licenses_for(svc, bom_dir):
    """Лицензии сервиса: сначала отдельный CSV (<svc>-licenses.csv),
    иначе — из SBOM JSON (CycloneDX)."""
    csv_path = os.path.join(bom_dir, f"{svc}-licenses.csv")
    if os.path.exists(csv_path):
        return csv_licenses(csv_path)
    data = json.load(open(os.path.join(bom_dir, f"{svc}.json")))
    return sbom_licenses(data.get("components", []))


def main(bom_dir):
    files = sorted(glob.glob(os.path.join(bom_dir, "*.json")))
    if not files:
        print("Нет SBOM-файлов в", bom_dir)
        sys.exit(1)

    per_svc = {}     # svc -> Counter
    problems = []    # (svc, package, version, license)
    for f in files:
        svc = os.path.basename(f)[:-5]
        rows = licenses_for(svc, bom_dir)
        per_svc[svc] = Counter()
        for name, ver, lics in rows:
            for lic in lics:
                per_svc[svc][lic] += 1
                if PROBLEM_RE.search(lic) or lic in ("UNKNOWN", "NONE", "LicenseRef-Proprietary"):
                    problems.append((svc, name, ver, lic))

    # ---------- Markdown ----------
    md = []
    md.append("# Сводка по лицензиям зависимостей")
    md.append("")
    md.append(
        "Сформировано инструментом `tools/sbom/licenses_summary.py`. "
        "Источник — `sbom/*.json` (CycloneDX) и `sbom/fe-frontend-licenses.csv` "
        "(лицензии фронтенда из node_modules)."
    )
    md.append("")
    md.append("## Разбивка по сервисам")
    md.append("")
    md.append("| Сервис | Компонентов | Лицензии (число пакетов) |")
    md.append("|---|---|---|")
    for svc in sorted(per_svc):
        cnt = sum(per_svc[svc].values())
        parts = ", ".join(f"{k}: {v}" for k, v in per_svc[svc].most_common())
        md.append(f"| `{svc}` | {cnt} | {parts} |")
    md.append("")

    # Проблемные лицензии
    problem_lic = Counter(lic for _, _, _, lic in problems)
    md.append("## Компоненты с потенциально проблемными лицензиями")
    md.append("")
    if problem_lic:
        md.append("| Лицензия | Кол-во вхождений по пакетам |")
        md.append("|---|---|")
        for lic, v in problem_lic.most_common():
            md.append(f"| {lic} | {v} |")
        md.append("")
        md.append("### Детали")
        md.append("")
        md.append("| Сервис | Пакет | Версия | Лицензия |")
        md.append("|---|---|---|---|")
        for svc, name, ver, lic in sorted(problems):
            md.append(f"| {svc} | {name} | {ver} | {lic} |")
    else:
        md.append("Проблемных лицензий не обнаружено.")
    md.append("")
    md.append("## Примечания")
    md.append("")
    md.append(
        "- Источники лицензий: Go — SBOM (go.mod/go.sum + module info); Python — "
        "установленные пакеты (venv, `*-licenses.csv`); фронтенд — node_modules "
        "(`fe-frontend-licenses.csv`)."
    )
    md.append("- `NONE`/`UNKNOWN` — пакеты, у которых источник не содержит информации о лицензии;")
    md.append("  обычно это не лишний риск, но требует ручной проверки.")
    md.append("- Полный по-пакетный список — в `licenses-summary.csv`.")

    with open(os.path.join(bom_dir, "licenses-summary.md"), "w") as f:
        f.write("\n".join(md))
    print("Записан", os.path.join(bom_dir, "licenses-summary.md"))

    # ---------- CSV ----------
    csv_rows = []
    for f in files:
        svc = os.path.basename(f)[:-5]
        rows = licenses_for(svc, bom_dir)
        for name, ver, lics in rows:
            for lic in lics:
                csv_rows.append((svc, name, ver, lic))
    with open(os.path.join(bom_dir, "licenses-summary.csv"), "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["server", "package", "version", "license"])
        for r in sorted(csv_rows):
            w.writerow(r)
    print("Записан", os.path.join(bom_dir, "licenses-summary.csv"))

    # ---------- Консоль ----------
    print("\n=== Лицензии (агрегировано по всем сервисам) ===")
    agg = Counter()
    for s, cnt in per_svc.items():
        for lic, v in cnt.items():
            agg[lic] += v
    for lic, v in agg.most_common():
        print(f"  {v:5d}  {lic}")
    print(f"\nКомпонентов с проблемными/неизвестными лицензиями: {len(problems)}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else OUT_DIR)
