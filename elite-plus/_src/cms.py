#!/usr/bin/env python3
"""Generates .pages.yml (Pages CMS: https://pagescms.org) from the content model, so staff can edit
branches, doctors, results, treatments, company details and legal texts in a web form.
Run after changing the content model:  python3 elite-plus/_src/cms.py"""
import json
L = [("en", "English"), ("ar", "العربية"), ("tr", "Türkçe"), ("de", "Deutsch"), ("es", "Español")]
C = "elite-plus/_content"

def f(name, label, type="string", **kw):
    d = {"name": name, "label": label, "type": type}; d.update(kw); return d
def per_lang(name, label, fields, desc=None):
    d = {"name": name, "label": label, "type": "object", "fields": [{"name": code, "label": lbl, "type": "object", "fields": fields} if isinstance(fields, list) else {"name": code, "label": lbl, "type": fields} for code, lbl in L]}
    if desc: d["description"] = desc
    return d
img = lambda name, label, **kw: f(name, label, "image", **kw)
BR = {"type": "select", "options": {"values": [{"value": "turkey", "label": "Türkiye"}, {"value": "egypt", "label": "Egypt"}]}}

doctor = [
  f("slug", "Web address name (e.g. dr-ahmet-yilmaz)", required=True, pattern={"regex": "^[a-z0-9-]+$", "message": "lowercase letters, numbers and dashes only"}),
  {"name": "branch", "label": "Clinic", **BR, "required": True},
  f("name", "Full name", required=True), img("photo", "Portrait photo", required=True),
  f("lead", "Lead doctor of this clinic", "boolean"), f("order", "Order (1 = first)", "number"),
  f("yearsExperience", "Years of experience", "number"), f("licence", "Licence / syndicate number (shown on profile)"),
  f("languages", "Languages spoken (codes: ar, en, tr, de, es, fr, ru)", list=True),
  per_lang("content", "Profile text", [f("title", "Title shown under the name"), f("short", "Two-line summary", "text"), f("bio", "Biography", "text"),
    f("education", "Education", list=True), f("experience", "Experience", list=True), f("specialties", "Specialties", list=True), f("credentials", "Memberships & certificates", list=True)]),
]
result = [
  f("id", "Case ID (e.g. EG-001)", required=True),
  {"name": "branch", "label": "Clinic", **BR, "required": True},
  {"name": "service", "label": "Treatment (file name without .json, e.g. hair-transplant)", "type": "string", "required": True},
  img("before", "Before photo", required=True), img("after", "Final after photo", required=True),
  f("months", "Months after treatment (final photo)", "number"),
  {"name": "timeline", "label": "In-between photos (optional)", "type": "object", "list": True, "fields": [f("month", "Month", "number"), img("image", "Photo")]},
  f("consentRef", "Signed consent form reference (never published)", required=True),
  f("order", "Order", "number"), per_lang("caption", "Caption (optional)", "string"),
]
branch = [
  f("countryCode", "Country code", readonly=True), per_lang("country", "Country name", "string"), per_lang("city", "City", "string"),
  f("street", "Street"), f("district", "District"), f("postalCode", "Postal code"),
  f("lat", "Latitude", "number"), f("lng", "Longitude", "number"), f("mapsUrl", "Google Maps link"), f("mapEmbedUrl", "Google Maps embed link (Share → Embed a map → src)"),
  f("licenceNumber", "Health licence number"), f("phone", "Phone (+country code)"), f("whatsapp", "WhatsApp (digits only, with country code)"), f("email", "Email"),
  f("hours", "Opening hours (e.g. Mo-Sa 09:00-19:00)", list=True),
  {"name": "stats", "label": "Google rating", "type": "object", "fields": [f("googleRating", "Rating (e.g. 4.8)", "number"), f("googleReviewCount", "Number of reviews", "number")]},
  f("googleBusinessUrl", "Google Business Profile link"), f("reviewsWidget", "Reviews widget embed link"), f("bookingUrl", "Video consultation booking link (Cal.com / Calendly)"),
  img("heroPhoto", "Clinic photo"), per_lang("story", "Short clinic story", "text"),
]
service = [
  f("category", "Category", "select", options={"values": ["transplant", "treatment"]}, readonly=True), f("order", "Order", "number"),
  f("priceFrom", "Starting price (number only)", "number"), img("image", "Photo"),
  per_lang("content", "Text", [f("name", "Name"), f("short", "Two-line summary", "text"), f("intro", "Intro paragraph", "text"),
    f("whoFor", "Who it is for", list=True), {"name": "steps", "label": "Procedure steps", "type": "object", "list": True, "fields": [f("t", "Title"), f("d", "Description", "text")]},
    f("stay", "Usual stay"), {"name": "faq", "label": "FAQ", "type": "object", "list": True, "fields": [f("q", "Question"), f("a", "Answer", "text")]}]),
]
company = [
  {"name": "entities", "label": "Legal entities", "type": "object", "fields": [{"name": k, "label": lbl, "type": "object", "fields": [f("legalName", "Legal name"), f("tradeRegistryNo", "Trade registry no."), f("taxId", "Tax ID"), f("representative", "Legal representative"), f("registeredAddress", "Registered address", "text")]} for k, lbl in (("turkey", "Türkiye"), ("egypt", "Egypt"))]},
  f("email", "Main email"), f("whatsapp", "Main WhatsApp (digits only)"),
  {"name": "social", "label": "Social media", "type": "object", "fields": [f("instagram", "Instagram"), f("facebook", "Facebook"), f("youtube", "YouTube"), f("tiktok", "TikTok")]},
  f("languagesSpoken", "Languages the team speaks (codes)", list=True), f("foundedYear", "Founded (year)", "number"),
  f("currency", "Currency of prices (EUR, USD, …)"),
  {"name": "package", "label": "Package", "type": "object", "fields": [f("hotelNights", "Hotel nights", "number"), f("followUpMonths", "Follow-up months", "number")]},
  {"name": "stats", "label": "Trust bar", "type": "object", "fields": [f("patientsTreated", "Patients treated (real number)", "number"), f("yearsOpen", "Years open", "number"), f("ministryLicensed", "Licensed by the Ministry of Health", "boolean")]},
  per_lang("story", "Company story", "text"),
]
legal = [per_lang(k, lbl, "text", desc="Lawyer-approved text. '## ' starts a heading, '- ' a list item, blank line = new paragraph.") for k, lbl in (("privacy", "Privacy policy"), ("kvkk", "KVKK notice (Türkiye)"), ("pdpl", "Data protection notice (Egypt)"), ("cookies", "Cookie policy"), ("terms", "Terms of use"))]

cfg = {
  "media": {"input": "elite-plus/assets/img/uploads", "output": "uploads"},
  "content": [
    {"name": "doctors", "label": "Doctors", "type": "collection", "path": f"{C}/doctors", "format": "json", "filename": "{fields.slug}.json", "view": {"fields": ["name", "branch"], "primary": "name"}, "fields": doctor},
    {"name": "results", "label": "Before & after results", "type": "collection", "path": f"{C}/results", "format": "json", "filename": "{fields.id}.json", "view": {"fields": ["id", "branch", "service"], "primary": "id"}, "fields": result},
    {"name": "turkey", "label": "Clinic – Türkiye", "type": "file", "path": f"{C}/branches/turkey.json", "format": "json", "fields": branch},
    {"name": "egypt", "label": "Clinic – Egypt", "type": "file", "path": f"{C}/branches/egypt.json", "format": "json", "fields": branch},
    {"name": "services", "label": "Treatments", "type": "collection", "path": f"{C}/services", "format": "json", "subfolders": False, "view": {"fields": ["order"]}, "fields": service},
    {"name": "company", "label": "Company & contact", "type": "file", "path": f"{C}/company.json", "format": "json", "fields": company},
    {"name": "legal", "label": "Legal texts", "type": "file", "path": f"{C}/legal.json", "format": "json", "fields": legal},
  ],
}
# JSON is valid YAML; Pages CMS reads .pages.yml as YAML.
open(".pages.yml", "w").write("# Generated by elite-plus/_src/cms.py – edit that file, not this one.\n" + json.dumps(cfg, ensure_ascii=False, indent=2) + "\n")
print("wrote .pages.yml")
