#!/usr/bin/env node
/**
 * Nordic Network — Photo Index Generator
 * 
 * Scans the photos/ folder and generates photos.json automatically.
 * Run with: node generate-photos.js
 * 
 * Folder structure:
 *   photos/
 *     Match 1 vs IES/
 *       img001.jpg
 *       img002.jpg
 *     Match 2 vs BSB/
 *       teamphoto.jpg   ← files with 'team' in the name get team_photo: {}
 *       img003.jpg
 * 
 * Each subfolder name becomes the "match" field.
 * Files are included in alphabetical order within each folder.
 * Supported formats: jpg, jpeg, png, webp, gif
 */

const fs   = require('fs');
const path = require('path');

const PHOTOS_DIR  = path.join(__dirname, 'photos');
const OUTPUT_FILE = path.join(__dirname, 'photos.json');
const IMG_EXTS    = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// Read existing photos.json so we can PRESERVE any manually set
// numbers / team_photo fields — we never overwrite data you've already added.
let existing = {};
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    const prev = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    prev.forEach(p => { existing[p.path] = p; });
    console.log(`  Loaded ${Object.keys(existing).length} existing entries to preserve.`);
  } catch (e) {
    console.warn('  Could not parse existing photos.json, starting fresh.');
  }
}

if (!fs.existsSync(PHOTOS_DIR)) {
  console.error('photos/ folder not found. Create it and add your match subfolders.');
  process.exit(1);
}

const results = [];
let added = 0, preserved = 0, skipped = 0;

// Get match folders, sorted alphabetically
const matchFolders = fs.readdirSync(PHOTOS_DIR)
  .filter(name => {
    const full = path.join(PHOTOS_DIR, name);
    return fs.statSync(full).isDirectory();
  })
  .sort();

for (const matchName of matchFolders) {
  const matchDir = path.join(PHOTOS_DIR, matchName);

  // Get image files, sorted
  const files = fs.readdirSync(matchDir)
    .filter(f => {
      const ext = path.extname(f).toLowerCase();
      // skip hidden files and non-images
      return !f.startsWith('.') && IMG_EXTS.has(ext);
    })
    .sort();

  for (const file of files) {
    const filePath = `photos/${matchName}/${file}`;

    // If we already have data for this path, preserve it entirely
    if (existing[filePath]) {
      results.push(existing[filePath]);
      preserved++;
      continue;
    }

    // New file — create a blank entry
    const entry = {
      match: matchName,
      path: filePath,
      numbers: []
      // team_photo is intentionally omitted — add manually when needed:
      // "team_photo": { "school": "SIS", "team": "Boys Senior" }
    };

    results.push(entry);
    added++;
  }
}

// Warn about entries in existing JSON whose files no longer exist
for (const p of Object.keys(existing)) {
  const full = path.join(__dirname, p);
  if (!fs.existsSync(full)) {
    console.warn(`  ⚠️  File no longer exists, removing from JSON: ${p}`);
    skipped++;
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2), 'utf8');

console.log('\n✅  photos.json updated:');
console.log(`   ${added} new photo${added !== 1 ? 's' : ''} added`);
console.log(`   ${preserved} existing entr${preserved !== 1 ? 'ies' : 'y'} preserved`);
if (skipped) console.log(`   ${skipped} missing file${skipped !== 1 ? 's' : ''} removed`);
console.log(`   ${results.length} total photos\n`);
console.log('Next steps:');
console.log('  • Open photos.json and fill in "numbers" for each photo');
console.log('  • Or add "team_photo": { "school": "SIS", "team": "Boys Senior" } for team shots');
console.log('  • Leave "numbers": [] for untagged photos — they still show in the gallery\n');
