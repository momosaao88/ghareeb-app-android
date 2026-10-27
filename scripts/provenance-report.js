#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { validateData, loadData, loadAdditionalMeanings, validateAdditionalMeanings, PHASE2_DATA_SHA256 } = require('./validate-data.js');

const root = path.join(__dirname, '..');
const dataPath = path.join(root, 'data.js');
const manifestPath = path.join(root, 'DATA_PROVENANCE.json');

function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const data = loadData(dataPath);
  const structural = validateData(data);
  const sources = require('./sources.js');
  const extra = validateAdditionalMeanings(
    loadAdditionalMeanings(path.join(__dirname, 'additional-meanings.js')),
    data,
    sources.catalog
  );
  const officialPath = path.join(__dirname, 'muyassar-meanings.js');
  const official = fs.existsSync(officialPath)
    ? validateAdditionalMeanings(loadAdditionalMeanings(officialPath), data, sources.catalog)
    : { errors: ['لم تُستورد حزمة الميسّر'], records: 0 };
  const packagePath = path.join(root, 'references', 'MuyassarGhareeb.docx');
  const packageBytes = fs.existsSync(packagePath) ? fs.readFileSync(packagePath) : null;
  const officialMeta = manifest.projectData.muyassarMeanings;
  const packageMd5 = packageBytes && crypto.createHash('md5').update(packageBytes).digest('hex');
  const packageSha1 = packageBytes && crypto.createHash('sha1').update(packageBytes).digest('hex');
  const packageHashesMatch = packageMd5 === officialMeta.officialPackageMd5 && packageSha1 === officialMeta.officialPackageSha1;
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(dataPath)).digest('hex').toUpperCase();
  const structurallyValid = structural.errors.length === 0 && extra.errors.length === 0 && official.errors.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    status: structurallyValid ? 'structurally_valid_content_unverified' : 'structural_errors_found',
    dataset: {
      path: 'data.js',
      bytes: fs.statSync(dataPath).size,
      sha256,
      matchesPhase2Baseline: sha256 === PHASE2_DATA_SHA256,
      surahs: structural.surahs,
      verses: structural.verses
    },
    structuralValidation: {
      status: structural.errors.length ? 'failed' : 'passed',
      errors: structural.errors,
      warnings: structural.warnings
    },
    additionalMeaningsValidation: {
      status: extra.errors.length ? 'failed' : 'passed',
      records: extra.records,
      errors: extra.errors
    },
    officialMuyassarValidation: {
      status: official.errors.length ? 'failed' : 'passed', records: official.records,
      wordAnchored: manifest.projectData.muyassarMeanings.extraction.wordAnchored,
      unmappedForManualReview: manifest.projectData.muyassarMeanings.extraction.unmappedForManualReview,
      officialPackageMd5: packageMd5,
      officialPackageSha1: packageSha1,
      officialPackageHashesMatch: packageHashesMatch,
      errors: official.errors
    },
    contentValidation: {
      quranTextAgainstReference: 'not_performed',
      meaningsAgainstReference: 'not_performed',
      audioRightsReview: manifest.projectData.recitationAudio.rightsReview
    },
    provenance: manifest
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if (!structurallyValid || !report.dataset.matchesPhase2Baseline || !packageHashesMatch) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(`تعذر إنشاء تقرير المصدر: ${error.message}`);
  process.exitCode = 2;
}
