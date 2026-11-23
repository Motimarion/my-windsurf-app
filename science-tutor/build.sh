#!/usr/bin/env bash
# בונה קובץ HTML יחיד ועצמאי: science-tutor/index.html
set -euo pipefail
cd "$(dirname "$0")"
python3 - <<'PY'
s=open('src/shell.html',encoding='utf-8').read()
for k,f in [('/*STYLE*/','src/style.css'),('/*QUESTIONS*/','src/questions.js'),('/*FOLLOWUP*/','src/followup.js'),('/*APP*/','src/app.js')]:
    s=s.replace(k,open(f,encoding='utf-8').read())
open('index.html','w',encoding='utf-8').write(s)
PY
echo "built index.html ($(wc -c < index.html) bytes)"
