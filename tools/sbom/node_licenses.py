#!/usr/bin/env python3
"""Извлечение лицензий Node-пакетов из node_modules (pnpm .pnpm layout).

Использование:
  python3 tools/sbom/node_licenses.py <frontend-or-node_modules-dir> [-o out.csv|csv]

Читает каждый пакет в node_modules/.pnpm/*/node_modules/<name>/package.json
и выводит CSV: package,version,license. Это дополняет SBOM (CycloneDX),
в котором лицензии JS-пакетов из pnpm-lock не всегда определяются.
"""
import sys, os, glob, json, csv

def parse_license(pkg):
    raw = pkg.get("license")
    if not raw:
        lics = pkg.get("licenses")
        if lics and isinstance(lics, list):
            return ";".join(
                l.get("type") if isinstance(l, dict) else str(l) for l in lics
            )
        return "UNKNOWN"
    if isinstance(raw, dict):
        return raw.get("type") or "UNKNOWN"
    return str(raw)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    base = args[0] if args else "."
    out = None
    if "-o" in sys.argv:
        out = sys.argv[sys.argv.index("-o") + 1]
    nm = base if base.endswith("node_modules") else os.path.join(base, "node_modules")
    pnpm = os.path.join(nm, ".pnpm")
    rows = []
    seen = set()
    if os.path.isdir(pnpm):
        for entry in os.listdir(pnpm):
            pkg_nm = os.path.join(pnpm, entry, "node_modules")
            if not os.path.isdir(pkg_nm):
                continue
            for name in os.listdir(pkg_nm):
                pj = os.path.join(pkg_nm, name, "package.json")
                if not os.path.exists(pj):
                    continue
                try:
                    pkg = json.load(open(pj))
                except Exception:
                    continue
                pname = pkg.get("name") or name
                ver = pkg.get("version") or ""
                key = (pname, ver)
                if key in seen:
                    continue
                seen.add(key)
                rows.append((pname, ver, parse_license(pkg)))
    else:
        # откат: просто node_modules/*/package.json
        for pj in glob.glob(os.path.join(nm, "*", "package.json")):
            try:
                pkg = json.load(open(pj))
            except Exception:
                continue
            rows.append((pkg.get("name", ""), pkg.get("version", ""), parse_license(pkg)))

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
