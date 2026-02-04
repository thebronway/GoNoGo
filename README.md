# GoNoGo AI

### A Preflight App for Pilots to Decode Weather, Airspace and NOTAMs.

**GoNoGo AI** is a decision support tool that aggregates real-time aviation data and uses OpenAI to generate plain-English risk assessments. It deciphers raw METARs, TAFs, and NOTAMs based on your specific aircraft profile to help you make faster, safer decisions.

> **Note:** AI normalizes data and can make errors. Always verify with official sources.

### Try it yourself: **[Live Site](https://gonogoai.conway.im/)**

**Current Version:** `v0.55`  
**GitHub:** [thebronway/GoNoGo](https://github.com/thebronway/GoNoGo)  


## The Problem

I am a pilot, and honestly, deciphering the raw text of NOTAMs, Airspace, METARs, and TAFs is a massive pain. It is tedious, easy to miss something important, and feels outdated. I wanted a tool that could decode that raw data for me and tell me if I am good to go or if there is a problem.

## My Goal

My main goal was to dive into AI engineering and learn how to interact with LLMs. I wanted to see if I could chain together **Live APIs** (FAA data), **LLMs** (OpenAI), and **Python** to solve a real problem I face during preflight. I wanted to build a decoder that reasons through data rather than just displaying it.

## Features

* **AI Summary:** Generates an Executive Summary covering VFR/IFR status, wind risk, and runway vectors based on your specific aircraft crosswind tolerance.
* **Smart Caching:** Intelligent caching strategy that respects METAR update cycles (clears at :50 past the hour) to ensure decision-quality data freshness.
* **Smart NOTAMs:** Filters through hundreds of raw notices to identify and translate *critical* hazards (closures, lighting) into plain English.
* **Airspace Alerts:** Checks your proximity to permanent restricted zones (DC SFRA, P-40, Disney, etc.).
* **Vector Math:** Automatically calculates crosswind components and suggests the best runway.
* **Contextual Reporting:** Integrated feedback tools allow pilots to flag hallucinations, automatically capturing the exact METAR/TAF snapshot for debugging.

## Important Notes

* **API Costs:** The app includes a custom rate limiter (5 requests / 30 minutes) to keep OpenAI costs manageable while in Active Development.
  * The rate limit will be normalized to 5 requests / 5 minutes in the future. 