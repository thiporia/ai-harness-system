import fs from "fs";

const PACKAGE_JSON_PATH = "./package.json";

function bumpPatch(version) {
  const [major, minor, patchWithTag] = version.split(".");
  const patch = Number((patchWithTag || "0").split("-")[0]);
  if (Number.isNaN(patch)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return `${major}.${minor}.${patch + 1}`;
}

function run() {
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf-8"));
  const current = pkg.version || "1.0.0";
  const next = bumpPatch(current);
  pkg.version = next;
  fs.writeFileSync(PACKAGE_JSON_PATH, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`Version bumped: ${current} -> ${next}`);
}

run();

