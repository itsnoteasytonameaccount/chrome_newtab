@echo off
call terser scripts/background.js -m -o scripts/background.min.js --ie8
call terser scripts/index.js -m -o scripts/index.min.js --ie8
call node minify_html.js index.html