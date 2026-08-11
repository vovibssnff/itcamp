#!/usr/bin/env python3
"""Лицензии Python-пакетов из установленного виртуального окружения (site-packages).

Использование:
  python3 tools/sbom/py_licenses.py <venv>/lib/pythonX.Y/site-packages [-o out.csv]

Читает *.dist-info/METADATA каждого установленного пакета и извлекает
Name, Version и лицензию (поле License или Classifier "License :: ...").
Это дополнение к SBOM: в requirements.txt/pyproject лицензии не хранятся.
"""
import sys, os, glob, csv, re, email

LICENTRIES = os.path.dirname(os.path.abspath(__file__))


def extract_license(meta_text):
    # 0) новый стандарт PEP 639: License-Expression
    m = re.search(r"(?im)^License-Expression:\s*(.+)$", meta_text)
    if m and m.group(1).strip():
        v = m.group(1).strip()
        if v.lower() not in ("unknown", "none"):
            return v
    # 1) поле License:
    m = re.search(r"(?im)^License:\s*(.+)$", meta_text)
    if m and m.group(1).strip() and not m.group(1).strip().startswith("("):
        val = m.group(1).strip()
        if val.lower() not in ("unknown", "see below", "none"):
            return val
    # 2) Classifier: License :: ...
    cls = re.findall(r"(?im)^Classifier:\s*License\s*::\s*(.+)$", meta_text)
    if cls:
        return cls[0].strip()
    return "UNKNOWN"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    sp = args[0] if args else "."
    out = None
    if "-o" in sys.argv:
        out = sys.argv[sys.argv.index("-o") + 1]

    rows = []
    for meta in glob.glob(os.path.join(sp, "*.dist-info", "METADATA")):
        try:
            text = open(meta, encoding="utf-8", errors="replace").read()
        except Exception:
            continue
        name = re.search(r"(?im)^Name:\s*(.+)$", text)
        ver = re.search(r"(?im)^Version:\s*(.+)$", text)
        rows.append(
            (
                name.group(1).strip() if name else os.path.basename(meta),
                ver.group(1).strip() if ver else "",
                extract_license(text),
            )
        )

    rows.sort()
    if out:
        with open(out, "w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["package", "version", "license"])
            w.writerows(rows)
        print(f"Записан {out} ({len(rows)} пакетов)")
    else:
        for r in rows:
            print(",".join(r))


if __name__ == "__main__":
    main()
