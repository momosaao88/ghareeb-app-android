#!/usr/bin/env python3
"""Convert the official KFGQPC DOCX into a separately attributed source file.

The script preserves each extracted term and explanation. It only proposes a
word range when normalized matching finds exactly one occurrence and the app's
display-word count agrees with its searchable verse text.
"""
from __future__ import annotations

import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "references" / "MuyassarGhareeb.docx"
DATA_JS = ROOT / "data.js"
OUTPUT_JS = ROOT / "scripts" / "muyassar-meanings.js"
REVIEW_JSON = ROOT / "references" / "muyassar-mapping-review.json"

EXPECTED_MD5 = "ffd3c58f51f8a69340a205b71bf1e870"
EXPECTED_SHA1 = "1be35ad20c48b4d47dfa0bfc3d97ac7b0b3401ca"
W_NS = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def normalize(text: str, dagger_alif: bool) -> str:
    if dagger_alif:
        text = text.replace("\u0670", "ا")
    text = re.sub(r"[\u064b-\u065f\u0670\u06d6-\u06ed\u0640]", "", text)
    return (text.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
            .replace("ٱ", "ا").replace("ى", "ي").replace("ة", "ه")
            .replace("ؤ", "ي").replace("ئ", "ي").replace("ء", ""))


def load_app_data() -> list[dict]:
    source = DATA_JS.read_text(encoding="utf-8").strip()
    match = re.fullmatch(r"window\.DATA\s*=(.*);\s*", source, flags=re.S)
    if not match:
        raise ValueError("صيغة data.js غير متوقعة")
    return json.loads(match.group(1))


def document_paragraphs() -> list[str]:
    raw = DOCX.read_bytes()
    md5 = hashlib.md5(raw).hexdigest()
    sha1 = hashlib.sha1(raw).hexdigest()
    if md5 != EXPECTED_MD5 or sha1 != EXPECTED_SHA1:
        raise ValueError("بصمة DOCX لا تطابق البصمات المنشورة في منصة المجمع")
    with zipfile.ZipFile(DOCX) as archive:
        document = ET.fromstring(archive.read("word/document.xml"))
    result = []
    for paragraph in document.iter(W_NS + "p"):
        text = "".join(node.text or "" for node in paragraph.iter(W_NS + "t")).strip()
        if text:
            result.append(text)
    return result


def locate_word(term: str, verse: dict) -> tuple[int | None, int | None, str]:
    text_words = verse.get("e", "").split()
    display_words = verse.get("w", [])
    hits: set[int] = set()
    for dagger_alif in (False, True):
        words = normalize(verse.get("e", ""), dagger_alif).split()
        wanted = normalize(term, dagger_alif).split()
        if not wanted:
            continue
        hits.update(i for i in range(len(words) - len(wanted) + 1)
                    if words[i:i + len(wanted)] == wanted)
    if len(hits) > 1:
        return None, None, "ambiguous_occurrence"
    if not hits:
        return None, None, "no_exact_match"
    if len(text_words) != len(display_words):
        return None, None, "display_word_count_mismatch"
    start = next(iter(hits))
    term_length = len(normalize(term, False).split())
    if term_length < 1 or start + term_length > len(display_words):
        return None, None, "invalid_word_range"
    return start, start + term_length, "matched"


def main() -> int:
    data = load_app_data()
    paragraphs = document_paragraphs()
    records: list[dict] = []
    unmapped: list[dict] = []
    surah_number = 0
    surah_headings = 0

    for paragraph in paragraphs:
        heading = re.fullmatch(r"سورة\s+(.+)", paragraph)
        if heading:
            surah_number += 1
            surah_headings += 1
            continue

        verse_match = re.match(r"^\((\d+)\)\s*(.*)$", paragraph)
        if not verse_match or surah_number == 0:
            continue
        ayah_number = int(verse_match.group(1))
        if surah_number > len(data) or ayah_number > len(data[surah_number - 1]["v"]):
            raise ValueError(f"موضع خارج بيانات التطبيق: {surah_number}:{ayah_number}")

        verse = data[surah_number - 1]["v"][ayah_number - 1]
        parts = re.findall(r"﴿(.*?)﴾\s*:\s*(.*?)(?=﴿|$)", verse_match.group(2))
        for raw_term, raw_meaning in parts:
            term, meaning = raw_term.strip(), raw_meaning.strip()
            if not term or not meaning:
                raise ValueError(f"لفظ أو معنى فارغ في {surah_number}:{ayah_number}")
            start, end, status = locate_word(term, verse)
            item = {"s": surah_number, "v": ayah_number, "term": term,
                    "meaning": meaning, "sourceId": "muyassar"}
            if start is not None:
                item["wordStart"] = start
                item["wordEnd"] = end
            else:
                unmapped.append({"s": surah_number, "v": ayah_number,
                                 "term": term, "status": status})
            records.append(item)

    if surah_headings != 114:
        raise ValueError(f"عدد عناوين السور في DOCX هو {surah_headings}؛ المتوقع 114")
    if not records:
        raise ValueError("لم تُستخرج أي معانٍ؛ لم تُكتب ملفات الإخراج")

    generated = "/* مولّد من حزمة مجمع الملك فهد الرسمية؛ لا تعدّل يدويًا. */\n"
    generated += "(function(root){root.SIRAJ_MUYASSAR_MEANINGS="
    generated += json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    generated += ";})(typeof window!=='undefined'?window:globalThis);\n"
    OUTPUT_JS.write_text(generated, encoding="utf-8")
    REVIEW_JSON.write_text(json.dumps({
        "sourceFile": "MuyassarGhareeb.docx",
        "sourceMd5": EXPECTED_MD5,
        "sourceSha1": EXPECTED_SHA1,
        "surahHeadings": surah_headings,
        "meaningRecords": len(records),
        "wordAnchored": len(records) - len(unmapped),
        "unmappedForManualReview": len(unmapped),
        "unmapped": unmapped
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"استخراج {len(records)} شرحًا عبر {surah_headings} سورة")
    print(f"ربط كلمات فريد: {len(records) - len(unmapped)}؛ يحتاج مراجعة موضع: {len(unmapped)}")
    print(f"أنشئ {OUTPUT_JS.relative_to(ROOT)} و{REVIEW_JSON.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"تعذر استيراد المصدر الرسمي: {error}", file=sys.stderr)
        raise SystemExit(1)
