const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const sizes = [16, 48, 128];
const svgPath = path.join(__dirname, "../icons/icon.svg");
const iconsDir = path.join(__dirname, "../icons");

async function generateIcons() {
  console.log("Generating extension icons...\n");

  if (!fs.existsSync(svgPath)) {
    throw new Error("icons/icon.svg was not found.");
  }

  fs.mkdirSync(iconsDir, { recursive: true });

  for (const size of sizes) {
    const outputPath = path.join(iconsDir, `icon-${size}.png`);
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Created ${path.basename(outputPath)}`);
  }

  console.log("\nIcon generation complete.");
}

generateIcons().catch((error) => {
  console.error("Failed to generate icons:", error.message);
  process.exit(1);
});

