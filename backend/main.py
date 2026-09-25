"""
Railway ETA Prediction System - FastAPI Backend
=================================================
REST API for real-time ETA predictions with:
- Train status endpoint
- ETA predictions for next 5 stations
- Delay explanation with feature importance
- Event simulation
- Health check
- In-memory caching (Redis optional)
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
import json
import numpy as np
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.inference import InferenceEngine


# ==================== APP SETUP ====================

# Global inference engine
inference_engine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load models on startup"""
    global inference_engine
    models_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
    print(f"Loading models from {models_path}...")
    try:
        inference_engine = InferenceEngine(models_path)
        print("[OK] Models loaded successfully!")
    except Exception as e:
        print(f"[WARN] Models not found ({e}). Running in demo mode with simulated predictions.")
        inference_engine = None
    yield


app = FastAPI(
    title="Railway ETA Prediction API",
    description="Real-time ETA prediction for Indian Railways coaching trains. "
                "Provides delay forecasts with confidence intervals and explainability.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== TRAIN DATABASE ====================
# Simulated train database (in production: PostgreSQL)

TRAINS_DB = {
    '12301': {'name': 'Howrah Rajdhani', 'class': 'Rajdhani', 'route': 'DEL-KOL', 'route_distance': 1500, 'stations': 30, 'speed': 130},
    '12302': {'name': 'Rajdhani Express', 'class': 'Rajdhani', 'route': 'DEL-KOL', 'route_distance': 1500, 'stations': 30, 'speed': 130},
    '12951': {'name': 'Mumbai Rajdhani', 'class': 'Rajdhani', 'route': 'DEL-BOM', 'route_distance': 1400, 'stations': 32, 'speed': 130},
    '12952': {'name': 'Delhi Rajdhani', 'class': 'Rajdhani', 'route': 'BOM-DEL', 'route_distance': 1400, 'stations': 32, 'speed': 130},
    '12953': {'name': 'August Kranti Rajdhani', 'class': 'Rajdhani', 'route': 'DEL-BOM', 'route_distance': 1400, 'stations': 32, 'speed': 125},
    '12201': {'name': 'Mumbai LTT Garib Rath', 'class': 'Express', 'route': 'DEL-BOM', 'route_distance': 1400, 'stations': 32, 'speed': 90},
    '12203': {'name': 'Ambala Saharsa Express', 'class': 'Express', 'route': 'DEL-KOL', 'route_distance': 1500, 'stations': 30, 'speed': 80},
    '12205': {'name': 'Nanda Devi Express', 'class': 'Express', 'route': 'DEL-LKO', 'route_distance': 510, 'stations': 15, 'speed': 80},
    '12213': {'name': 'Yesvantpur Duronto', 'class': 'Express', 'route': 'DEL-CHN', 'route_distance': 2180, 'stations': 35, 'speed': 100},
    '12615': {'name': 'Grand Trunk Express', 'class': 'Express', 'route': 'DEL-CHN', 'route_distance': 2180, 'stations': 35, 'speed': 85},
    '12621': {'name': 'Tamil Nadu Express', 'class': 'Express', 'route': 'DEL-CHN', 'route_distance': 2180, 'stations': 35, 'speed': 90},
    '12839': {'name': 'Chennai Mail', 'class': 'Express', 'route': 'BOM-CHN', 'route_distance': 1270, 'stations': 28, 'speed': 85},
    '12841': {'name': 'Coromandel Express', 'class': 'Express', 'route': 'KOL-CHN', 'route_distance': 1660, 'stations': 30, 'speed': 90},
    '12657': {'name': 'Bangalore Mail', 'class': 'Express', 'route': 'BLR-CHN', 'route_distance': 350, 'stations': 12, 'speed': 85},
    '14007': {'name': 'Krishak Express', 'class': 'Passenger', 'route': 'DEL-LKO', 'route_distance': 510, 'stations': 15, 'speed': 55},
    '14009': {'name': 'Champaran Express', 'class': 'Passenger', 'route': 'DEL-KOL', 'route_distance': 1500, 'stations': 30, 'speed': 50},
    '14011': {'name': 'Hoshiarpur Express', 'class': 'Passenger', 'route': 'DEL-LKO', 'route_distance': 510, 'stations': 15, 'speed': 55},
    '14013': {'name': 'Sultanpur Express', 'class': 'Passenger', 'route': 'DEL-LKO', 'route_distance': 510, 'stations': 15, 'speed': 55},
    '14015': {'name': 'Sadbhavna Express', 'class': 'Passenger', 'route': 'DEL-KOL', 'route_distance': 1500, 'stations': 30, 'speed': 50},
    '14017': {'name': 'Chitrakoot Express', 'class': 'Passenger', 'route': 'DEL-BOM', 'route_distance': 1400, 'stations': 32, 'speed': 55},
}

# Station coordinates for simulation
STATION_COORDS = {
    'NDLS': {'name': 'New Delhi', 'lat': 28.6419, 'lon': 77.2193},
    'CNB': {'name': 'Kanpur Central', 'lat': 26.4535, 'lon': 80.3510},
    'ALD': {'name': 'Prayagraj Junction', 'lat': 25.4358, 'lon': 81.8463},
    'MGS': {'name': 'Mughal Sarai', 'lat': 25.2839, 'lon': 83.1179},
    'GAYA': {'name': 'Gaya Junction', 'lat': 24.7914, 'lon': 85.0002},
    'HWH': {'name': 'Howrah Junction', 'lat': 22.5839, 'lon': 88.3428},
    'BOM': {'name': 'Mumbai Central', 'lat': 18.9712, 'lon': 72.8199},
    'AGR': {'name': 'Agra Cantt', 'lat': 27.1631, 'lon': 78.0081},
    'JHS': {'name': 'Jhansi Junction', 'lat': 25.4484, 'lon': 78.5685},
    'BPL': {'name': 'Bhopal Junction', 'lat': 23.2687, 'lon': 77.4122},
    'BRC': {'name': 'Vadodara Junction', 'lat': 22.3098, 'lon': 73.1810},
    'MAS': {'name': 'Chennai Central', 'lat': 13.0827, 'lon': 80.2707},
    'SBC': {'name': 'Bangalore City', 'lat': 12.9779, 'lon': 77.5662},
    'LKO': {'name': 'Lucknow', 'lat': 26.8467, 'lon': 80.9462},
    'NGP': {'name': 'Nagpur', 'lat': 21.1458, 'lon': 79.0882},
    'BZA': {'name': 'Vijayawada', 'lat': 16.5062, 'lon': 80.6480},
    'PUNE': {'name': 'Pune Junction', 'lat': 18.5285, 'lon': 73.8740},
}

# Route station sequences for generating journey stations
ROUTE_STATIONS = {
    'DEL-KOL': ['NDLS', 'CNB', 'ALD', 'MGS', 'GAYA', 'HWH'],
    'DEL-BOM': ['NDLS', 'AGR', 'JHS', 'BPL', 'BRC', 'BOM'],
    'BOM-DEL': ['BOM', 'BRC', 'BPL', 'JHS', 'AGR', 'NDLS'],
    'BOM-CHN': ['BOM', 'PUNE', 'NGP', 'BZA', 'MAS'],
    'DEL-CHN': ['NDLS', 'AGR', 'JHS', 'BPL', 'NGP', 'BZA', 'MAS'],
    'KOL-CHN': ['HWH', 'BZA', 'MAS'],
    'DEL-LKO': ['NDLS', 'CNB', 'LKO'],
    'BLR-CHN': ['SBC', 'MAS'],
}

# Simple in-memory cache
_cache = {}


def _get_cache(key, ttl=30):
    """Simple in-memory cache with TTL"""
    if key in _cache:
        data, timestamp = _cache[key]
        if (datetime.now() - timestamp).seconds < ttl:
            return data
    return None


def _set_cache(key, value, ttl=30):
    """Set cache value"""
    _cache[key] = (value, datetime.now())


def _simulate_train_position(train_id: str, train_info: dict):
    """Simulate current train position based on time"""
    now = datetime.now()
    # Use time-based seed for consistent but changing positions
    seed = int(train_id) + now.hour * 100 + now.minute // 5
    rng = np.random.RandomState(seed)

    route = train_info['route']
    stations = ROUTE_STATIONS.get(route, ['NDLS', 'BOM'])
    total_stations = train_info['stations']

    # Current station index (changes every ~15 minutes)
    station_idx = (now.hour * 4 + now.minute // 15) % len(stations)
    station_code = stations[station_idx]
    station_info = STATION_COORDS.get(station_code, {'name': f'Station {station_idx}', 'lat': 23.0 + rng.randn() * 3, 'lon': 79.0 + rng.randn() * 3})

    # Simulate delay (varies with time of day)
    base_delay = rng.normal(8, 5)
    hour = now.hour
    if 7 <= hour <= 9 or 17 <= hour <= 19:
        base_delay *= 1.4  # Peak hours
    if train_info['class'] == 'Rajdhani':
        base_delay *= 0.7  # Rajdhani are faster/priority
    elif train_info['class'] == 'Passenger':
        base_delay *= 1.3  # Passenger trains delayed more

    current_delay = max(0, round(base_delay, 1))

    # Distance remaining
    progress = station_idx / max(len(stations) - 1, 1)
    distance_remaining = max(0, train_info['route_distance'] * (1 - progress))

    return {
        'station_code': station_code,
        'station_name': station_info['name'],
        'latitude': round(station_info['lat'] + rng.randn() * 0.1, 4),
        'longitude': round(station_info['lon'] + rng.randn() * 0.1, 4),
        'current_delay': current_delay,
        'current_speed': train_info['speed'] * rng.uniform(0.7, 1.0),
        'distance_remaining': round(distance_remaining, 1),
        'station_index': station_idx,
    }


# ==================== API ENDPOINTS ====================

@app.get("/")
async def root():
    """API root - service info"""
    return {
        "service": "Railway ETA Prediction System",
        "version": "1.0.0",
        "status": "operational",
        "description": "Real-time ETA prediction for Indian Railways coaching trains",
        "endpoints": {
            "trains": "/trains/{train_id}",
            "eta": "/trains/{train_id}/eta",
            "explain": "/trains/{train_id}/explain",
            "simulate": "/simulate/event",
            "all_trains": "/trains",
            "health": "/health",
        }
    }


@app.get("/trains")
async def get_all_trains():
    """Get status of all tracked trains"""
    cached = _get_cache("all_trains", ttl=15)
    if cached:
        return cached

    trains = []
    for train_id, info in TRAINS_DB.items():
        pos = _simulate_train_position(train_id, info)
        trains.append({
            "train_id": train_id,
            "train_name": info['name'],
            "train_class": info['class'],
            "route": info['route'],
            "current_station": {
                "code": pos['station_code'],
                "name": pos['station_name'],
                "latitude": pos['latitude'],
                "longitude": pos['longitude'],
            },
            "current_delay_minutes": pos['current_delay'],
            "current_speed_kmh": round(pos['current_speed'], 1),
            "distance_remaining_km": pos['distance_remaining'],
        })

    response = {
        "total_trains": len(trains),
        "trains": trains,
        "timestamp": datetime.now().isoformat(),
    }

    _set_cache("all_trains", response, ttl=15)
    return response


@app.get("/trains/{train_id}")
async def get_train_status(train_id: str):
    """Get current status of a specific train"""
    cached = _get_cache(f"train:{train_id}", ttl=30)
    if cached:
        return cached

    if train_id not in TRAINS_DB:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")

    info = TRAINS_DB[train_id]
    pos = _simulate_train_position(train_id, info)

    response = {
        "train_id": train_id,
        "train_name": info['name'],
        "train_class": info['class'],
        "route": info['route'],
        "route_distance_km": info['route_distance'],
        "total_stations": info['stations'],
        "current_station": {
            "code": pos['station_code'],
            "name": pos['station_name'],
            "latitude": pos['latitude'],
            "longitude": pos['longitude'],
        },
        "current_delay_minutes": pos['current_delay'],
        "current_speed_kmh": round(pos['current_speed'], 1),
        "distance_remaining_km": pos['distance_remaining'],
        "last_update": datetime.now().isoformat(),
    }

    _set_cache(f"train:{train_id}", response, ttl=30)
    return response


@app.get("/trains/{train_id}/eta")
async def get_train_eta(train_id: str):
    """Get ETA predictions for next 5 stations with confidence intervals"""
    cached = _get_cache(f"eta:{train_id}", ttl=60)
    if cached:
        return cached

    if train_id not in TRAINS_DB:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")

    info = TRAINS_DB[train_id]
    pos = _simulate_train_position(train_id, info)

    # Get upcoming stations
    route = info['route']
    stations = ROUTE_STATIONS.get(route, ['NDLS', 'BOM'])
    current_idx = pos['station_index']

    predictions = []
    accumulated_delay = pos['current_delay']
    now = datetime.now()

    for i in range(1, 6):
        next_idx = (current_idx + i) % len(stations)
        station_code = stations[next_idx]
        station_info = STATION_COORDS.get(station_code, {'name': f'Station {next_idx}'})

        # Build feature dict for prediction
        distance_to_station = info['route_distance'] / info['stations'] * i
        features = {
            'current_delay_minutes': accumulated_delay,
            'current_speed_kmh': pos['current_speed'],
            'distance_remaining_km': max(0, pos['distance_remaining'] - distance_to_station),
            'distance_to_next_station_km': info['route_distance'] / info['stations'],
            'upstream_delay_minutes': accumulated_delay * 0.7,
            'speed_trend': 0,
            'temperature_celsius': 32 + np.random.randn() * 3,
            'rainfall_mm': max(0, np.random.normal(5, 10)) if 6 <= now.month <= 9 else 0,
            'time_of_day_hour': (now + timedelta(hours=i)).hour,
            'day_of_week': now.weekday(),
            'train_class_encoded': {'Rajdhani': 1, 'Express': 2, 'Passenger': 3}[info['class']],
            'track_type': 1,
            'level_crossings_ahead': np.random.randint(1, 4),
            'is_morning_rush': 1 if 6 <= (now + timedelta(hours=i)).hour <= 9 else 0,
            'is_evening_rush': 1 if 17 <= (now + timedelta(hours=i)).hour <= 19 else 0,
            'is_peak_hour': 1 if (6 <= (now + timedelta(hours=i)).hour <= 9 or 17 <= (now + timedelta(hours=i)).hour <= 19) else 0,
            'is_night': 1 if (now + timedelta(hours=i)).hour >= 22 or (now + timedelta(hours=i)).hour <= 4 else 0,
            'upstream_weather_interaction': accumulated_delay * 0.1,
            'delay_trend': 0,
            'delay_vs_class_avg': 0,
            'heat_stress': 0,
            'cold_fog_factor': 0,
            'weather_delay_factor': 0,
            'cumulative_distance_pct': min(100, (i / 5) * 100),
            'trains_ahead_indicator': max(0, np.random.randint(0, 3)),
            'seasonal_factor': 1.0,
            'is_weekend': 1 if now.weekday() >= 5 else 0,
            'station_progress': current_idx + i,
        }

        # Predict using ML model or fallback
        if inference_engine and inference_engine.is_loaded():
            predicted_delay = inference_engine.predict(features, info['class'])
        else:
            # Demo fallback: simple heuristic
            predicted_delay = accumulated_delay * (1 + np.random.uniform(-0.1, 0.15))
            predicted_delay = max(0, predicted_delay)

        accumulated_delay = predicted_delay

        # Schedule times
        travel_time_hours = distance_to_station / info['speed']
        scheduled = now + timedelta(hours=travel_time_hours)
        predicted_arrival = scheduled + timedelta(minutes=predicted_delay)

        # Confidence decreases with distance
        confidence = max(0.55, 0.92 - (i * 0.06) + np.random.uniform(-0.03, 0.03))
        uncertainty_minutes = max(3, int(predicted_delay * 0.3 + i * 1.5))

        predictions.append({
            "station_code": station_code,
            "station_name": station_info.get('name', f'Station {next_idx}'),
            "latitude": station_info.get('lat', 23.0),
            "longitude": station_info.get('lon', 79.0),
            "scheduled_arrival": scheduled.isoformat(),
            "predicted_arrival": predicted_arrival.isoformat(),
            "predicted_delay_minutes": round(predicted_delay, 1),
            "confidence_score": round(confidence, 2),
            "uncertainty_range": {
                "lower": (predicted_arrival - timedelta(minutes=uncertainty_minutes)).isoformat(),
                "upper": (predicted_arrival + timedelta(minutes=uncertainty_minutes)).isoformat(),
                "minutes": uncertainty_minutes,
            }
        })

    response = {
        "train_id": train_id,
        "train_name": info['name'],
        "train_class": info['class'],
        "current_delay_minutes": pos['current_delay'],
        "predictions": predictions,
        "model_version": "1.0.0",
        "timestamp": now.isoformat(),
    }

    _set_cache(f"eta:{train_id}", response, ttl=60)
    return response


@app.get("/trains/{train_id}/explain")
async def explain_delay(train_id: str):
    """Explain why a train is delayed with feature breakdown"""
    if train_id not in TRAINS_DB:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")

    info = TRAINS_DB[train_id]
    pos = _simulate_train_position(train_id, info)
    delay = pos['current_delay']

    if delay < 1:
        return {
            "train_id": train_id,
            "train_name": info['name'],
            "current_delay_minutes": round(delay, 1),
            "status": "on-time",
            "delay_breakdown": {},
            "feature_importance": [],
        }

    # Rule-based delay breakdown (realistic)
    upstream_pct = np.random.uniform(0.35, 0.55)
    weather_pct = np.random.uniform(0.10, 0.25)
    congestion_pct = np.random.uniform(0.08, 0.18)
    signal_pct = 1.0 - upstream_pct - weather_pct - congestion_pct
    signal_pct = max(0.05, signal_pct)

    # Normalize
    total = upstream_pct + weather_pct + congestion_pct + signal_pct
    upstream_pct /= total
    weather_pct /= total
    congestion_pct /= total
    signal_pct /= total

    breakdown = {
        "upstream_delay": {
            "minutes": round(delay * upstream_pct, 1),
            "percentage": round(upstream_pct * 100),
            "description": "Trains ahead blocking junction",
            "icon": "🚂"
        },
        "weather_delay": {
            "minutes": round(delay * weather_pct, 1),
            "percentage": round(weather_pct * 100),
            "description": "Weather impact (temperature/rainfall)",
            "icon": "🌡️"
        },
        "congestion_delay": {
            "minutes": round(delay * congestion_pct, 1),
            "percentage": round(congestion_pct * 100),
            "description": "Mixed traffic section congestion",
            "icon": "🚦"
        },
        "signal_delay": {
            "minutes": round(delay * signal_pct, 1),
            "percentage": round(signal_pct * 100),
            "description": "Signal halts and section clearance",
            "icon": "🔴"
        }
    }

    # Feature importance (from model or defaults)
    feature_importance = [
        {"feature": "upstream_delay", "importance": 0.28, "description": "Delay of trains ahead on same section"},
        {"feature": "current_delay", "importance": 0.22, "description": "Current accumulated delay"},
        {"feature": "temperature", "importance": 0.13, "description": "Ambient temperature affecting track/loco"},
        {"feature": "time_of_day", "importance": 0.11, "description": "Peak vs off-peak hours"},
        {"feature": "distance_remaining", "importance": 0.09, "description": "Distance left to destination"},
        {"feature": "track_type", "importance": 0.06, "description": "Dedicated vs mixed traffic track"},
        {"feature": "rainfall", "importance": 0.05, "description": "Rainfall intensity"},
        {"feature": "level_crossings", "importance": 0.04, "description": "Number of level crossings ahead"},
        {"feature": "seasonal_factor", "importance": 0.02, "description": "Monsoon/summer/winter effects"},
    ]

    if inference_engine and inference_engine.is_loaded():
        model_importance = inference_engine.get_feature_importance(info['class'])
        if model_importance:
            feature_importance = model_importance

    return {
        "train_id": train_id,
        "train_name": info['name'],
        "current_delay_minutes": round(delay, 1),
        "status": "delayed" if delay < 15 else "critical",
        "delay_breakdown": breakdown,
        "feature_importance": feature_importance,
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/simulate/event")
async def simulate_event(
    train_id: str = Query(..., description="Train ID"),
    event_type: str = Query("signal_halt", description="Event type: signal_halt, congestion, weather"),
    severity_minutes: int = Query(10, description="Severity in minutes"),
):
    """Simulate a delay event and see how ETA changes"""
    if train_id not in TRAINS_DB:
        raise HTTPException(status_code=404, detail=f"Train {train_id} not found")

    info = TRAINS_DB[train_id]
    pos = _simulate_train_position(train_id, info)

    original_delay = pos['current_delay']
    new_delay = original_delay + severity_minutes

    # Cascading effect: affects next stations progressively
    route = info['route']
    stations = ROUTE_STATIONS.get(route, ['NDLS', 'BOM'])
    current_idx = pos['station_index']

    affected = []
    cascade_delay = severity_minutes
    for i in range(1, min(6, len(stations))):
        next_idx = (current_idx + i) % len(stations)
        station_code = stations[next_idx]
        station_name = STATION_COORDS.get(station_code, {}).get('name', f'Station {next_idx}')
        cascade_delay *= 0.85  # 15% recovery per station
        affected.append({
            "station_code": station_code,
            "station_name": station_name,
            "additional_delay_minutes": round(cascade_delay, 1),
        })

    return {
        "train_id": train_id,
        "train_name": info['name'],
        "event_type": event_type,
        "severity_minutes": severity_minutes,
        "original_delay_minutes": round(original_delay, 1),
        "new_delay_minutes": round(new_delay, 1),
        "eta_change_minutes": severity_minutes,
        "affected_stations": affected,
        "timestamp": datetime.now().isoformat(),
    }


# ==================== STATION FIDS BOARD ====================

@app.get("/stations")
async def get_all_stations():
    """Get list of all supported major railway stations"""
    stations = []
    for code, info in STATION_COORDS.items():
        stations.append({
            "code": code,
            "name": info["name"],
            "latitude": info["lat"],
            "longitude": info["lon"],
            "platforms": 10 if code in ['NDLS', 'HWH', 'BOM', 'MAS'] else 6,
        })
    return {"stations": stations}


@app.get("/stations/{station_code}/board")
async def get_station_board(station_code: str):
    """
    Flight/Train Information Display System (FIDS) Board
    Shows live arrivals, departures, assigned platforms, and AI predicted ETA for a station.
    """
    station_code = station_code.upper()
    if station_code not in STATION_COORDS:
        raise HTTPException(status_code=404, detail=f"Station {station_code} not found")

    station_info = STATION_COORDS[station_code]
    now = datetime.now()
    board_entries = []

    for train_id, info in TRAINS_DB.items():
        route = info['route']
        stations = ROUTE_STATIONS.get(route, [])
        if station_code not in stations:
            continue

        target_idx = stations.index(station_code)
        pos = _simulate_train_position(train_id, info)
        current_idx = pos['station_index']

        # Determine if train is arriving or departing
        is_origin = (target_idx == 0)
        is_destination = (target_idx == len(stations) - 1)
        movement_type = "Departure" if is_origin else "Arrival" if is_destination else "Transit"

        # Deterministic platform allocation (PF 1 to 8)
        platform_num = (int(train_id) % 8) + 1

        # Scheduled time calculation relative to journey progress
        hours_offset = (target_idx - current_idx) * 1.5
        scheduled_dt = now + timedelta(hours=hours_offset)
        delay_min = pos['current_delay']

        # AI Prediction calculation
        if inference_engine and inference_engine.is_loaded():
            features = {
                'current_delay_minutes': delay_min,
                'current_speed_kmh': pos['current_speed'],
                'distance_remaining_km': max(0, pos['distance_remaining']),
                'distance_to_next_station_km': 50.0,
                'upstream_delay_minutes': delay_min * 0.7,
                'speed_trend': 0,
                'temperature_celsius': 30.0,
                'rainfall_mm': 0.0,
                'time_of_day_hour': scheduled_dt.hour,
                'day_of_week': now.weekday(),
                'train_class_encoded': {'Rajdhani': 1, 'Express': 2, 'Passenger': 3}[info['class']],
                'track_type': 1,
                'level_crossings_ahead': 2,
                'is_morning_rush': 1 if 6 <= scheduled_dt.hour <= 9 else 0,
                'is_evening_rush': 1 if 17 <= scheduled_dt.hour <= 19 else 0,
                'is_peak_hour': 1 if (6 <= scheduled_dt.hour <= 9 or 17 <= scheduled_dt.hour <= 19) else 0,
                'is_night': 1 if (scheduled_dt.hour >= 22 or scheduled_dt.hour <= 4) else 0,
                'upstream_weather_interaction': 0.0,
                'delay_trend': 0,
                'delay_vs_class_avg': 0,
                'heat_stress': 0,
                'cold_fog_factor': 0,
                'weather_delay_factor': 0,
                'cumulative_distance_pct': 50.0,
                'trains_ahead_indicator': 1,
                'seasonal_factor': 1.0,
                'is_weekend': 1 if now.weekday() >= 5 else 0,
                'station_progress': target_idx,
            }
            predicted_delay = max(0, inference_engine.predict(features, info['class']))
        else:
            predicted_delay = delay_min

        predicted_dt = scheduled_dt + timedelta(minutes=predicted_delay)

        # Status text & category
        diff_from_now = (predicted_dt - now).total_seconds() / 60.0
        if current_idx == target_idx:
            status = f"At Platform {platform_num}"
            status_code = "AT_PLATFORM"
        elif diff_from_now < 0:
            status = "Departed"
            status_code = "DEPARTED"
        elif diff_from_now <= 15:
            status = f"Arriving Soon (PF {platform_num})"
            status_code = "ARRIVING"
        elif predicted_delay <= 5:
            status = "On Time"
            status_code = "ON_TIME"
        else:
            status = f"Delayed (+{round(predicted_delay)}m)"
            status_code = "DELAYED"

        origin_name = STATION_COORDS.get(stations[0], {}).get('name', stations[0])
        dest_name = STATION_COORDS.get(stations[-1], {}).get('name', stations[-1])

        board_entries.append({
            "train_id": train_id,
            "train_name": info['name'],
            "train_class": info['class'],
            "origin": origin_name,
            "destination": dest_name,
            "platform": f"PF {platform_num}",
            "movement_type": movement_type,
            "scheduled_time": scheduled_dt.strftime("%H:%M"),
            "predicted_time": predicted_dt.strftime("%H:%M"),
            "delay_minutes": round(predicted_delay, 1),
            "status": status,
            "status_code": status_code,
            "current_location": pos['station_name'],
            "confidence_score": 0.91 if info['class'] == 'Rajdhani' else 0.86,
        })

    # Sort board by predicted time
    board_entries.sort(key=lambda x: x['predicted_time'])

    return {
        "station_code": station_code,
        "station_name": station_info['name'],
        "total_trains": len(board_entries),
        "timestamp": now.isoformat(),
        "board": board_entries,
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "models_loaded": inference_engine is not None and inference_engine.is_loaded(),
        "model_classes": list(inference_engine.models.keys()) if inference_engine else [],
        "total_trains": len(TRAINS_DB),
        "cache_size": len(_cache),
    }


# ==================== RUN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
