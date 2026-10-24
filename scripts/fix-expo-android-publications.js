// Compatibility fix for an Expo SDK 54 package config missing its Android
// Maven publication version. The Gradle autolinking settings plugin requires it.
// The installed npm package version is the authoritative version for this module.
const fs = require("node:fs");
const path = require("node:path");

const packagePath = path.join(process.cwd(), "node_modules", "expo-font", "package.json");
const configPath = path.join(process.cwd(), "node_modules", "expo-font", "expo-module.config.json");

if (!fs.existsSync(packagePath) || !fs.existsSync(configPath)) {
  console.log("Expo font publication workaround: package config not present; nothing to patch.");
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const publication = config.android && config.android.publication;

if (publication && !publication.version && pkg.version) {
  publication.version = pkg.version;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
  console.log(`Added missing expo-font Android publication version: ${pkg.version}`);
} else {
  console.log("Expo font publication metadata already complete; no change needed.");
}
