# WxDecoder

### A Situational Awareness Tool for Pilots to Decode Weather & NOTAMs.

**WxDecoder** is a situational awareness support tool that aggregates real-time aviation data and uses OpenAI to generate plain-English condition reports. It deciphers raw METARs, TAFs, and NOTAMs based on your specific aircraft profile to help enhance your preflight situational awareness.

> **Note:** AI normalizes data and can make errors. Always verify with official sources.

### Try it yourself: **[Live Site](https://wxdecoder.conway.im/)**

**Current Version:** `v0.71`  
**GitHub:** [thebronway/WxDecoder](https://github.com/thebronway/WxDecoder)  


## The Problem

I am a pilot, and honestly, deciphering the raw text of NOTAMs, Airspace, METARs, and TAFs is a massive pain. It is tedious, easy to miss something important, and feels outdated. I wanted a tool that could quickly decode that raw data for me and aid in my normal preflight.

## My Goal

My main goal was to dive into AI engineering and learn how to interact with LLMs. I wanted to see if I could chain together **Live APIs** (FAA data), **LLMs** (OpenAI), and **Python** to solve a real problem I face during preflight. I wanted to build a decoder that reasons through data rather than just displaying it.

## Features

* **AI Summary:** Generates a Briefing Overview covering VFR/IFR status, crosswind components, and runway vectors based on your specific aircraft crosswind tolerance.
* **Smart Caching:** Intelligent caching strategy that respects METAR update cycles (clears at :50 past the hour) to ensure quality data freshness.
* **Smart NOTAMs:** Filters through hundreds of raw notices to identify and translate *critical* hazards (closures, lighting) into plain English.
* **Airspace Alerts:** Checks your proximity to permanent restricted zones (DC SFRA, P-40, Disney, etc.).
* **Vector Math:** Automatically calculates crosswind components and compares it to the available runways via onboard logic.
* **Contextual Reporting:** Integrated feedback tools allow pilots to flag hallucinations, automatically capturing the exact METAR/TAF snapshot for debugging.
* **Kiosk Mode:** A 16:9 full-screen display optimized for TVs in flight schools and FBOs. It automatically polls for new weather data every minute and refreshes the analysis instantly without user interaction.

## Important Notes

* **API Costs:** The app includes a custom rate limiter (5 requests / 30 minutes) to keep OpenAI costs manageable while in Active Development.
  * The rate limit will be normalized to 5 requests / 5 minutes in the future.