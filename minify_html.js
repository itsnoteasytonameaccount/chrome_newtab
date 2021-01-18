const fs = require("fs")

const argv = process.argv

while (argv.length > 2) {
  let arg = argv.pop()
  let buffer = fs.readFileSync(arg)
  let content = buffer.toString("utf-8")
  let path = arg.split(".")
  path.pop()
  path.push("min")
  path.push("html")
  path = path.join(".")
  content = content
    .replace(/>[\s\n\r]+</g, "><")
    .replace(/\{[\s\n\r]+/g, "{")
    .replace(/[\s\n\r]+\{/g, "{")
    .replace(/\}[\s\n\r]+/g, "}")
    .replace(/;[\s\n\r]+/g, ";")
    .replace(/,[\s\n\r]+/g, ",")
    .replace(/:[\s\n\r]+/g, ":")
    .replace(/[\s\n\r]+/g, " ")
  fs.writeFileSync(path, content)
}