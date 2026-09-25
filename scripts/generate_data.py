"""
Railway ETA Prediction System - Synthetic Data Generator
=========================================================
Generates realistic Indian Railways coaching train movement data
with cascading delays, weather effects, signal halts, and peak hour patterns.

Output: synthetic_railway_data.csv (~270,000 records for 180 days)
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import random
import os


class RealisticRailwayDataGenerator:
    """Generate realistic Indian Railways coaching train data"""

    def __init__(self, seed=42):
        random.seed(seed)
        np.random.seed(seed)

        # Major Indian Railway routes with realistic data
        self.routes = {
            'DEL-BOM': {
                'distance': 1400, 'stations': 32,
                'major_junctions': ['NDLS', 'MTJ', 'AGR', 'GWL', 'JHS', 'BPL', 'BRC', 'BOM'],
                'name': 'Delhi-Mumbai'
            },
            'DEL-KOL': {
                'distance': 1500, 'stations': 30,
                'major_junctions': ['NDLS', 'CNB', 'ALD', 'MGS', 'DDU', 'GAYA', 'DHN', 'HWH'],
                'name': 'Delhi-Kolkata'
            },
            'BOM-CHN': {
                'distance': 1270, 'stations': 28,
                'major_junctions': ['CSTM', 'PUNE', 'SUR', 'GR', 'WADI', 'RU', 'JTJ', 'MAS'],
                'name': 'Mumbai-Chennai'
            },
            'DEL-CHN': {
                'distance': 2180, 'stations': 35,
                'major_junctions': ['NDLS', 'AGC', 'JHS', 'BPL', 'NGP', 'BZA', 'MAS'],
                'name': 'Delhi-Chennai'
            },
            'BOM-DEL': {
                'distance': 1400, 'stations': 32,
                'major_junctions': ['CSTM', 'BRC', 'RTM', 'NAD', 'KOTA', 'NZM'],
                'name': 'Mumbai-Delhi (Western)'
            },
            'KOL-CHN': {
                'distance': 1660, 'stations': 30,
                'major_junctions': ['HWH', 'KGP', 'BBS', 'VSKP', 'BZA', 'MAS'],
                'name': 'Kolkata-Chennai'
            },
            'DEL-LKO': {
                'distance': 510, 'stations': 15,
                'major_junctions': ['NDLS', 'GZB', 'ALJN', 'BE', 'LKO'],
                'name': 'Delhi-Lucknow'
            },
            'BLR-CHN': {
                'distance': 350, 'stations': 12,
                'major_junctions': ['SBC', 'KPD', 'JTJ', 'MAS'],
                'name': 'Bangalore-Chennai'
            },
        }

        # Station database with coordinates (major stations)
        self.station_coords = {
            'NDLS': {'name': 'New Delhi', 'lat': 28.6419, 'lon': 77.2193},
            'MTJ': {'name': 'Mathura Junction', 'lat': 27.4924, 'lon': 77.6737},
            'AGR': {'name': 'Agra Cantt', 'lat': 27.1631, 'lon': 78.0081},
            'GWL': {'name': 'Gwalior', 'lat': 26.2183, 'lon': 78.1828},
            'JHS': {'name': 'Jhansi Junction', 'lat': 25.4484, 'lon': 78.5685},
            'BPL': {'name': 'Bhopal Junction', 'lat': 23.2687, 'lon': 77.4122},
            'BRC': {'name': 'Vadodara Junction', 'lat': 22.3098, 'lon': 73.1810},
            'BOM': {'name': 'Mumbai Central', 'lat': 18.9712, 'lon': 72.8199},
            'CSTM': {'name': 'Mumbai CST', 'lat': 18.9398, 'lon': 72.8355},
            'CNB': {'name': 'Kanpur Central', 'lat': 26.4535, 'lon': 80.3510},
            'ALD': {'name': 'Prayagraj Junction', 'lat': 25.4358, 'lon': 81.8463},
            'MGS': {'name': 'Mughal Sarai', 'lat': 25.2839, 'lon': 83.1179},
            'DDU': {'name': 'Pt. Deen Dayal Upadhyay', 'lat': 25.2833, 'lon': 83.1167},
            'GAYA': {'name': 'Gaya Junction', 'lat': 24.7914, 'lon': 85.0002},
            'DHN': {'name': 'Dhanbad Junction', 'lat': 23.7957, 'lon': 86.4304},
            'HWH': {'name': 'Howrah Junction', 'lat': 22.5839, 'lon': 88.3428},
            'PUNE': {'name': 'Pune Junction', 'lat': 18.5285, 'lon': 73.8740},
            'SUR': {'name': 'Solapur', 'lat': 17.6599, 'lon': 75.9064},
            'MAS': {'name': 'Chennai Central', 'lat': 13.0827, 'lon': 80.2707},
            'SBC': {'name': 'Bangalore City', 'lat': 12.9779, 'lon': 77.5662},
            'LKO': {'name': 'Lucknow', 'lat': 26.8467, 'lon': 80.9462},
            'NGP': {'name': 'Nagpur', 'lat': 21.1458, 'lon': 79.0882},
            'BZA': {'name': 'Vijayawada', 'lat': 16.5062, 'lon': 80.6480},
            'VSKP': {'name': 'Visakhapatnam', 'lat': 17.7215, 'lon': 83.2890},
            'BBS': {'name': 'Bhubaneswar', 'lat': 20.2671, 'lon': 85.8432},
            'KGP': {'name': 'Kharagpur', 'lat': 22.3460, 'lon': 87.3236},
            'GZB': {'name': 'Ghaziabad', 'lat': 28.6692, 'lon': 77.4538},
            'NZM': {'name': 'Hazrat Nizamuddin', 'lat': 28.5893, 'lon': 77.2507},
        }

        # Train database
        self.trains = [
            # Rajdhani Express trains
            {'id': '12301', 'name': 'Howrah Rajdhani', 'class': 'Rajdhani', 'speed': 130, 'route': 'DEL-KOL'},
            {'id': '12302', 'name': 'Rajdhani Express', 'class': 'Rajdhani', 'speed': 130, 'route': 'DEL-KOL'},
            {'id': '12303', 'name': 'Poorva Express', 'class': 'Rajdhani', 'speed': 120, 'route': 'DEL-KOL'},
            {'id': '12305', 'name': 'Kolkata Rajdhani', 'class': 'Rajdhani', 'speed': 130, 'route': 'DEL-KOL'},
            {'id': '12951', 'name': 'Mumbai Rajdhani', 'class': 'Rajdhani', 'speed': 130, 'route': 'DEL-BOM'},
            {'id': '12952', 'name': 'Delhi Rajdhani', 'class': 'Rajdhani', 'speed': 130, 'route': 'BOM-DEL'},
            {'id': '12953', 'name': 'August Kranti Rajdhani', 'class': 'Rajdhani', 'speed': 125, 'route': 'DEL-BOM'},
            # Express trains
            {'id': '12201', 'name': 'Mumbai LTT Garib Rath', 'class': 'Express', 'speed': 90, 'route': 'DEL-BOM'},
            {'id': '12203', 'name': 'Ambala Saharsa Express', 'class': 'Express', 'speed': 80, 'route': 'DEL-KOL'},
            {'id': '12205', 'name': 'Nanda Devi Express', 'class': 'Express', 'speed': 80, 'route': 'DEL-LKO'},
            {'id': '12209', 'name': 'Kanpur Garib Rath', 'class': 'Express', 'speed': 85, 'route': 'DEL-LKO'},
            {'id': '12213', 'name': 'Yesvantpur Duronto', 'class': 'Express', 'speed': 100, 'route': 'DEL-CHN'},
            {'id': '12615', 'name': 'Grand Trunk Express', 'class': 'Express', 'speed': 85, 'route': 'DEL-CHN'},
            {'id': '12621', 'name': 'Tamil Nadu Express', 'class': 'Express', 'speed': 90, 'route': 'DEL-CHN'},
            {'id': '12839', 'name': 'Chennai Mail', 'class': 'Express', 'speed': 85, 'route': 'BOM-CHN'},
            {'id': '12841', 'name': 'Coromandel Express', 'class': 'Express', 'speed': 90, 'route': 'KOL-CHN'},
            {'id': '12657', 'name': 'Bangalore Mail', 'class': 'Express', 'speed': 85, 'route': 'BLR-CHN'},
            {'id': '12625', 'name': 'Kerala Express', 'class': 'Express', 'speed': 80, 'route': 'DEL-CHN'},
            {'id': '12627', 'name': 'Karnataka Express', 'class': 'Express', 'speed': 85, 'route': 'DEL-CHN'},
            # Passenger/Mail trains (slower)
            {'id': '14007', 'name': 'Krishak Express', 'class': 'Passenger', 'speed': 55, 'route': 'DEL-LKO'},
            {'id': '14009', 'name': 'Champaran Express', 'class': 'Passenger', 'speed': 50, 'route': 'DEL-KOL'},
            {'id': '14011', 'name': 'Hoshiarpur Express', 'class': 'Passenger', 'speed': 55, 'route': 'DEL-LKO'},
            {'id': '14013', 'name': 'Sultanpur Express', 'class': 'Passenger', 'speed': 55, 'route': 'DEL-LKO'},
            {'id': '14015', 'name': 'Sadbhavna Express', 'class': 'Passenger', 'speed': 50, 'route': 'DEL-KOL'},
            {'id': '14017', 'name': 'Chitrakoot Express', 'class': 'Passenger', 'speed': 55, 'route': 'DEL-BOM'},
            {'id': '14019', 'name': 'Gorakhpur Express', 'class': 'Passenger', 'speed': 50, 'route': 'DEL-LKO'},
        ]

        # Peak hour delay multipliers
        self.peak_hour_multiplier = {
            6: 1.2, 7: 1.4, 8: 1.6, 9: 1.3,   # Morning rush
            12: 1.0, 13: 0.9,                    # Afternoon
            17: 1.1, 18: 1.4, 19: 1.2,          # Evening rush
        }

    def _interpolate_station_coords(self, route_id, station_num, total_stations):
        """Generate realistic lat/lon for intermediate stations along route"""
        route = self.routes[route_id]
        junctions = route['major_junctions']

        # Get start and end coordinates
        start_code = junctions[0]
        end_code = junctions[-1]

        start = self.station_coords.get(start_code, {'lat': 23.0, 'lon': 79.0})
        end = self.station_coords.get(end_code, {'lat': 20.0, 'lon': 80.0})

        # Linear interpolation + random offset
        t = station_num / max(total_stations - 1, 1)
        lat = start['lat'] + (end['lat'] - start['lat']) * t + np.random.normal(0, 0.2)
        lon = start['lon'] + (end['lon'] - start['lon']) * t + np.random.normal(0, 0.2)

        return round(lat, 4), round(lon, 4)

    def simulate_train_journey(self, train_info, date, initial_delay=0):
        """
        Simulate a realistic train journey with cascading delays

        Args:
            train_info: dict with id, name, class, speed, route
            date: datetime object
            initial_delay: starting delay in minutes

        Returns: List of station records with actual delays
        """
        route_id = train_info['route']
        route = self.routes[route_id]
        total_distance = route['distance']
        num_stations = route['stations']
        base_speed = train_info['speed']
        train_class = train_info['class']

        journey_records = []

        # Start conditions
        current_delay = max(0, initial_delay)
        accumulated_distance = 0
        departure_hour = np.random.choice([5, 6, 7, 8, 12, 15, 16, 17, 20, 22, 23])
        current_time = date.replace(hour=departure_hour, minute=np.random.randint(0, 60), second=0)

        for station_num in range(num_stations):
            # Distance to this station
            distance_segment = total_distance / num_stations
            # Add some variation to station spacing
            distance_segment *= (1 + np.random.uniform(-0.15, 0.15))
            accumulated_distance += distance_segment

            # Travel time without delays (minutes)
            effective_speed = base_speed * np.random.uniform(0.85, 1.05)
            travel_time = (distance_segment / effective_speed) * 60
            current_time += timedelta(minutes=travel_time)

            # ==================== DELAY SOURCES ====================

            # 1. Cascading delay (trains ahead blocking junction)
            if station_num > 3:
                block_probability = 0.20 * (station_num / num_stations)
                if np.random.random() < block_probability:
                    cascade_delay = np.random.normal(6, 3)
                    current_delay += max(0, cascade_delay)

            # 2. Weather impact (temperature)
            base_temp = 30 + 8 * np.sin(2 * np.pi * (date.month - 4) / 12)  # Seasonal
            temp = base_temp + np.random.normal(0, 3)
            if temp > 42:
                weather_delay = (temp - 42) * 0.6
                current_delay += weather_delay
            elif temp < 5:  # Fog in winter
                weather_delay = (5 - temp) * 0.8
                current_delay += weather_delay

            # 3. Rainfall (monsoon: June-September)
            rainfall = 0
            if 6 <= date.month <= 9:
                if np.random.random() < 0.35:
                    rainfall = np.random.exponential(15)
                    if rainfall > 20:
                        current_delay += rainfall * 0.15

            # 4. Signal halts (stochastic)
            if np.random.random() < 0.08:
                signal_delay = np.random.normal(8, 4)
                current_delay += max(0, signal_delay)

            # 5. Peak hour effect
            hour = current_time.hour
            if hour in self.peak_hour_multiplier:
                peak_delay = (self.peak_hour_multiplier[hour] - 1.0) * 2.5
                current_delay += peak_delay

            # 6. Cumulative distance effect
            cumulative_factor = (accumulated_distance / total_distance) * 0.02
            current_delay += cumulative_factor

            # 7. Recovery (trains sometimes make up time)
            recovery_prob = 0.08 if train_class == 'Rajdhani' else 0.05
            if np.random.random() < recovery_prob:
                recovery_amount = np.random.uniform(1, 4)
                current_delay = max(0, current_delay - recovery_amount)

            # Constraints
            current_delay = np.clip(current_delay, 0, 60)

            # Dwell time at station
            dwell_minutes = {'Rajdhani': 2, 'Express': 5, 'Passenger': 8}[train_class]
            if station_num == 0 or station_num == num_stations - 1:
                dwell_minutes = 0  # No dwell at origin/destination
            current_time += timedelta(minutes=dwell_minutes)

            # Station coordinates
            lat, lon = self._interpolate_station_coords(route_id, station_num, num_stations)

            # Station code
            junctions = route['major_junctions']
            if station_num < len(junctions):
                station_code = junctions[station_num]
            else:
                station_code = f"STN{station_num:02d}"

            station_name = self.station_coords.get(
                station_code, {'name': f'Station {station_num}'}
            )['name']

            # Record
            journey_records.append({
                'train_id': train_info['id'],
                'train_name': train_info['name'],
                'train_class': train_class,
                'route_id': route_id,
                'date': date.date(),
                'station_number': station_num,
                'station_code': station_code,
                'station_name': station_name,
                'latitude': lat,
                'longitude': lon,
                'scheduled_arrival': (date.replace(hour=departure_hour) +
                    timedelta(minutes=(distance_segment * station_num / base_speed) * 60)).isoformat(),
                'actual_arrival': current_time.isoformat(),
                'current_delay_minutes': round(max(0, current_delay), 2),
                'current_speed_kmh': round(effective_speed, 1),
                'distance_remaining_km': round(max(0, total_distance - accumulated_distance), 1),
                'distance_to_next_station_km': round(distance_segment, 1),
                'temperature_celsius': round(temp, 1),
                'rainfall_mm': round(rainfall, 1),
                'time_of_day_hour': current_time.hour,
                'day_of_week': date.weekday(),
                'track_type': 1 if np.random.random() > 0.3 else 2,  # 70% dedicated
                'level_crossings_ahead': np.random.randint(0, 6),
                'is_junction': 1 if station_code in [s for r in self.routes.values() for s in r['major_junctions']] else 0,
            })

        return journey_records

    def generate_dataset(self, num_days=180):
        """Generate specified number of days of data for all trains"""

        all_records = []
        start_date = datetime(2025, 1, 1)

        total_iterations = num_days * len(self.trains)
        count = 0

        print(f"Generating {num_days} days × {len(self.trains)} trains = {total_iterations} journeys...")

        for day_offset in range(num_days):
            current_date = start_date + timedelta(days=day_offset)

            for train in self.trains:
                # Generate journey with random initial delay
                initial_delay = max(0, np.random.normal(3, 2))
                journey = self.simulate_train_journey(train, current_date, initial_delay)
                all_records.extend(journey)

                count += 1
                if count % 1000 == 0:
                    print(f"  Progress: {count}/{total_iterations} journeys ({count/total_iterations*100:.1f}%)")

        df = pd.DataFrame(all_records)
        print(f"\n✓ Generated {len(df)} total records")
        return df


def main():
    print("=" * 60)
    print("Railway ETA Prediction - Synthetic Data Generator")
    print("=" * 60)

    # Create data directory
    os.makedirs('data', exist_ok=True)

    # Generate data
    generator = RealisticRailwayDataGenerator(seed=42)
    df = generator.generate_dataset(num_days=180)

    # Validation
    print(f"\n{'='*60}")
    print("DATA VALIDATION")
    print(f"{'='*60}")
    print(f"✓ Total records: {len(df):,}")
    print(f"✓ Unique trains: {df['train_id'].nunique()}")
    print(f"✓ Train classes: {df['train_class'].unique().tolist()}")
    print(f"✓ Routes: {df['route_id'].unique().tolist()}")
    print(f"✓ Date range: {df['date'].min()} to {df['date'].max()}")
    print(f"\n--- Delay Statistics ---")
    print(f"✓ Average delay: {df['current_delay_minutes'].mean():.1f} min")
    print(f"✓ Median delay: {df['current_delay_minutes'].median():.1f} min")
    print(f"✓ Delay std dev: {df['current_delay_minutes'].std():.1f} min")
    print(f"✓ Max delay: {df['current_delay_minutes'].max():.1f} min")
    print(f"\n--- Delay Distribution ---")
    print(f"  0-5 min (on-time):  {(df['current_delay_minutes'] <= 5).sum() / len(df) * 100:.1f}%")
    print(f"  5-15 min (mild):    {((df['current_delay_minutes'] > 5) & (df['current_delay_minutes'] <= 15)).sum() / len(df) * 100:.1f}%")
    print(f"  15-30 min (late):   {((df['current_delay_minutes'] > 15) & (df['current_delay_minutes'] <= 30)).sum() / len(df) * 100:.1f}%")
    print(f"  >30 min (critical): {(df['current_delay_minutes'] > 30).sum() / len(df) * 100:.1f}%")

    # By train class
    print(f"\n--- Average Delay by Train Class ---")
    for tc in ['Rajdhani', 'Express', 'Passenger']:
        class_df = df[df['train_class'] == tc]
        print(f"  {tc}: {class_df['current_delay_minutes'].mean():.1f} min (n={len(class_df):,})")

    # Save
    output_path = os.path.join('data', 'synthetic_railway_data.csv')
    df.to_csv(output_path, index=False)
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n✓ Saved to {output_path} ({file_size_mb:.1f} MB)")


if __name__ == '__main__':
    main()
