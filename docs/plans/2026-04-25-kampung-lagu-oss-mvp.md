# Kampung Lagu OSS MVP Implementation Plan

> **For Hermes:** implement MVP in small, verifiable steps.

**Goal:** Build a Vercel-friendly web app inspired by Kampung Lagu with Create, Library, and Settings flows.

**Architecture:** Next.js 14 app router on Vercel. UI and history persist in browser localStorage for MVP. Real open-source music generation will be connected later through an external GPU inference endpoint because Vercel cannot run MusicGen-class models directly.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind, browser localStorage.

---

### Task 1: Replace starter app shell
- Add app metadata
- Create dark dashboard layout with sidebar and top status cards

### Task 2: Build Create flow
- Add mode/model/type/gender controls
- Add title/description/lyrics form
- Add validation and local draft persistence

### Task 3: Build Library flow
- Store generations in localStorage
- Render searchable track list and empty state

### Task 4: Build Settings flow
- Save endpoint URL, API key hint, and default model locally
- Show readiness badge when inference endpoint is not configured

### Task 5: Add generate action
- Validate required fields
- Create pending local generation item
- If endpoint exists later, wire request via API route/remote inference

### Task 6: Verify
- Run lint
- Run build
- Launch locally and visually verify desktop/mobile basics
