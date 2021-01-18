@echo off
call terser scripts/background.js -m -o scripts/background.min.js
call terser scripts/index.js -m -o scripts/index.min.js
call node minify_html.js index.html