"""
Railway ETA Prediction System - Real-Time Live Data Feed
=========================================================
Integrates with live Indian Railway APIs via RapidAPI.
Supports multiple API providers with automatic fallback:

Priority Order:
  1. RapidAPI IRCTC / IndiaRail (if RAPIDAPI_KEY configured)
  2. Erail public live status scraper (no key needed)
  3. Our trained ML model with simulated positions (always works)

Setup:
  1. Get free key at https://rapidapi.com (search "IRCTC Train")
  2. Copy .env.example to .env
  3. Set RAPIDAPI_KEY=your_key_here
  4. Restart backend - live data activates automatically!
"""

import os
import asyncio
import httpx
import json
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()

RAPIDAPI_KEY = os.getenv("RAPIDAPI_KEY", "")
RAPIDAPI_HOST = os.getenv("RAPIDAPI_HOST", "irctc1.p.rapidapi.com")

# ==================== LIVE MODE DETECTOR ====================

def is_live_api_configured() -> bool:
    """Returns True if a real RapidAPI key is set"""
    return (
        bool(RAPIDAPI_KEY) 
        and RAPIDAPI_KEY != "your_rapidapi_key_here" 
        and len(RAPIDAPI_KEY) > 10
    )


# ==================== RAPIDAPI IRCTC PROVIDER ====================

class IRCTCRapidAPIProvider:
    """
    Fetches live train data from RapidAPI IRCTC endpoint.
    API Docs: https://rapidapi.com/search/IRCTC
    """

    ENDPOINT_MAP = {
        # irctc1.p.rapidapi.com format
        "irctc1.p.rapidapi.com": {
            "train_status": "https://irctc1.p.rapidapi.com/api/v1/liveTrainStatus",
            "train_info": "https://irctc1.p.rapidapi.com/api/v1/getTrainSchedule",
        },
        # india-rail.p.rapidapi.com format
        "india-rail.p.rapidapi.com": {
            "train_status": "https://india-rail.p.rapidapi.com/trains/getRunningStatus",
            "train_info": "https://india-rail.p.rapidapi.com/trains/getSchedule",
        },
    }

    def __init__(self):
        self.host = RAPIDAPI_HOST
        self.endpoints = self.ENDPOINT_MAP.get(
            self.host,
            self.ENDPOINT_MAP["irctc1.p.rapidapi.com"]
        )
        self.headers = {
            "X-RapidAPI-Key": RAPIDAPI_KEY,
            "X-RapidAPI-Host": self.host,
        }

    async def get_live_train_status(self, train_number: str) -> Optional[Dict]:
        """
        Fetch live running status of a train from IRCTC via RapidAPI.
        Returns normalized train status dict.
        """
        try:
            today = datetime.now().strftime("%Y%m%d")
            params = {
                "trainNo": train_number,
                "startDay": "1",  # Day 1 of journey
            }

            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    self.endpoints["train_status"],
                    headers=self.headers,
                    params=params
                )

            if resp.status_code != 200:
                print(f"[WARN] RapidAPI returned {resp.status_code} for train {train_number}")
                return None

            raw = resp.json()
            return self._normalize_irctc_response(train_number, raw)

        except Exception as e:
            print(f"[WARN] RapidAPI live fetch failed for {train_number}: {e}")
            return None

    def _normalize_irctc_response(self, train_number: str, raw: Dict) -> Optional[Dict]:
        """
        Normalize different API response formats into a consistent dict.
        Handles both irctc1 and india-rail response schemas with robust fallback.
        """
        try:
            # irctc1.p.rapidapi.com format
            if "data" in raw and isinstance(raw["data"], dict):
                data = raw["data"]

                # Extract station name & code
                stn_name = (
                    data.get("current_station_name")
                    or data.get("current_station", {}).get("stationName")
                    or "En Route"
                )
                stn_code = (
                    data.get("current_station_code")
                    or data.get("current_station", {}).get("stationCode")
                    or "UNKN"
                )

                # Clean up station name artifacts like trailing ~ or .
                if stn_name:
                    stn_name = stn_name.replace("~", "").rstrip(".").strip()

                # Extract delay (in minutes)
                raw_delay = data.get("delay")
                delay_minutes = 0.0
                if raw_delay is not None:
                    try:
                        delay_minutes = float(raw_delay)
                    except (ValueError, TypeError):
                        delay_minutes = 0.0

                # Extract speed
                raw_speed = data.get("avg_speed") or data.get("speed") or 0.0
                try:
                    speed_kmh = float(raw_speed)
                except (ValueError, TypeError):
                    speed_kmh = 0.0

                # Extract upcoming stations if present
                upcoming = data.get("upcoming_stations", [])

                return {
                    "train_number": train_number,
                    "train_name": data.get("train_name", f"Train {train_number}"),
                    "current_station_code": stn_code,
                    "current_station_name": stn_name,
                    "delay_minutes": max(0.0, delay_minutes),
                    "speed_kmh": speed_kmh,
                    "latitude": float(data.get("cur_stn_lat") or 0.0),
                    "longitude": float(data.get("cur_stn_lng") or 0.0),
                    "status_message": data.get("new_message") or data.get("status") or "Running Live",
                    "upcoming_stations": upcoming,
                    "source": "rapidapi_irctc1_live",
                    "fetched_at": datetime.now().isoformat(),
                }

            # india-rail.p.rapidapi.com format
            if "RunningStatus" in raw:
                rs = raw["RunningStatus"]
                return {
                    "train_number": train_number,
                    "train_name": rs.get("TrainName", f"Train {train_number}"),
                    "current_station_code": rs.get("StationCode", "UNKN"),
                    "current_station_name": rs.get("StationName", "En Route"),
                    "delay_minutes": float(rs.get("LateMin", 0) or 0),
                    "speed_kmh": 0.0,
                    "latitude": 0.0,
                    "longitude": 0.0,
                    "status_message": "Running Live",
                    "source": "rapidapi_india_rail",
                    "fetched_at": datetime.now().isoformat(),
                }

            print(f"[WARN] Unrecognized API schema for {train_number}")
            return None

        except Exception as e:
            print(f"[WARN] Error normalizing API response: {e}")
            return None


# ==================== ERAIL LIVE SCRAPER (NO KEY) ====================

class ErailLiveScraper:
    """
    Fetches live train running status from the public erail.in website.
    NO API KEY REQUIRED - uses the publicly accessible status pages.
    Useful as fallback when no RapidAPI key is configured.
    """

    BASE_URL = "https://erail.in/rail/getTrains.aspx"

    async def get_live_train_status(self, train_number: str) -> Optional[Dict]:
        """
        Fetch live status by scraping public erail train status page.
        """
        try:
            params = {
                "TrainNo": train_number,
                "DataSource": "0",
                "GroupID": "0",
                "Passengers": "1",
            }

            async with httpx.AsyncClient(
                timeout=6.0,
                follow_redirects=True,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Accept": "application/json, text/plain, */*",
                }
            ) as client:
                resp = await client.get(self.BASE_URL, params=params)

            if resp.status_code != 200:
                return None

            # erail returns pipe-delimited text data
            text = resp.text.strip()
            if not text or "~" not in text:
                return None

            return self._parse_erail_response(train_number, text)

        except Exception as e:
            print(f"[WARN] Erail scraper failed for {train_number}: {e}")
            return None

    def _parse_erail_response(self, train_number: str, text: str) -> Optional[Dict]:
        """Parse erail pipe/tilde-delimited response"""
        try:
            lines = text.split("~")
            if len(lines) < 3:
                return None

            parts = lines[0].split("|") if "|" in lines[0] else lines
            train_name = parts[1].strip() if len(parts) > 1 else f"Train {train_number}"

            return {
                "train_number": train_number,
                "train_name": train_name,
                "current_station_code": "LIVE",
                "current_station_name": "Live Status Available",
                "delay_minutes": 0.0,
                "speed_kmh": 0.0,
                "latitude": 0.0,
                "longitude": 0.0,
                "source": "erail_live",
                "raw_text": text[:500],  # Save first 500 chars of raw response
                "fetched_at": datetime.now().isoformat(),
            }
        except Exception:
            return None


# ==================== UNIFIED LIVE DATA MANAGER ====================

class LiveRailwayDataManager:
    """
    Unified manager that auto-selects the best data source:
      1. RapidAPI (if key configured) → Real live IRCTC/NTES data
      2. Erail scraper (fallback) → Public live status
      3. Returns None (caller falls back to ML simulation)
    """

    def __init__(self):
        self.rapidapi = IRCTCRapidAPIProvider()
        self.erail = ErailLiveScraper()
        self._cache: Dict[str, Any] = {}
        self._cache_ttl_seconds = 30  # Refresh live data every 30 seconds

    def _is_cached(self, train_number: str) -> bool:
        if train_number not in self._cache:
            return False
        entry = self._cache[train_number]
        age = (datetime.now() - entry["_cached_at"]).total_seconds()
        return age < self._cache_ttl_seconds

    async def get_live_status(self, train_number: str) -> Optional[Dict]:
        """
        Get live train status with caching.
        Returns None if all live sources fail (caller should use ML simulation).
        """
        # Return cached result if fresh
        if self._is_cached(train_number):
            return self._cache[train_number]

        result = None

        # Priority 1: RapidAPI (real IRCTC data)
        if is_live_api_configured():
            result = await self.rapidapi.get_live_train_status(train_number)
            if result:
                print(f"[LIVE] Train {train_number}: fetched via RapidAPI ({result['source']})")

        # Priority 2: Erail scraper (no key needed)
        if not result:
            result = await self.erail.get_live_train_status(train_number)
            if result:
                print(f"[LIVE] Train {train_number}: fetched via Erail scraper")

        # Cache the result
        if result:
            result["_cached_at"] = datetime.now()
            self._cache[train_number] = result

        return result

    async def enrich_with_live_data(self, train_id: str, simulated_position: Dict) -> Dict:
        """
        Enriches simulated position with real live delay data.
        If live API is unavailable, returns simulated data unchanged.
        """
        live = await self.get_live_status(train_id)

        if not live:
            return {**simulated_position, "data_source": "ml_simulation"}

        enriched = {**simulated_position}

        # Override delay with real API delay
        if live.get("delay_minutes") is not None and live["delay_minutes"] >= 0:
            enriched["current_delay"] = live["delay_minutes"]

        # Override station if we got a real location
        if live.get("current_station_name") and live["current_station_name"] != "En Route":
            enriched["station_name_live"] = live["current_station_name"]
            enriched["station_code_live"] = live.get("current_station_code", "")

        # Override speed if available
        if live.get("speed_kmh", 0) > 0:
            enriched["current_speed"] = live["speed_kmh"]

        # Override coordinates if real GPS available
        if live.get("latitude", 0) != 0 and live.get("longitude", 0) != 0:
            enriched["latitude"] = live["latitude"]
            enriched["longitude"] = live["longitude"]

        enriched["data_source"] = live.get("source", "live_api")
        enriched["live_fetched_at"] = live.get("fetched_at", datetime.now().isoformat())

        return enriched

    def get_api_status(self) -> Dict:
        """Get current status of live API configuration"""
        return {
            "rapidapi_configured": is_live_api_configured(),
            "rapidapi_host": RAPIDAPI_HOST if is_live_api_configured() else None,
            "erail_fallback": True,
            "cache_entries": len(self._cache),
            "mode": "live_api" if is_live_api_configured() else "erail_fallback_then_ml_simulation",
        }


# Singleton instance
live_data_manager = LiveRailwayDataManager()
