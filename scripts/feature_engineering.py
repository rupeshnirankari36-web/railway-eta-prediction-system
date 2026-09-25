"""
Railway ETA Prediction System - Feature Engineering
=====================================================
Engineers 22+ features from raw train movement data including:
- Core status features
- Upstream/cascading delay effects
- Speed trends and interactions
- Temporal features (peak hours, seasons)
- Weather impact features
- Route congestion indicators

Output: engineered_features.csv
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import os


class FeatureEngineering:
    """Engineer features for ML model"""

    def __init__(self, df):
        self.df = df.copy()
        self.scaler = StandardScaler()
        self.feature_names = None

    def create_features(self):
        """Create all 22+ features for model training"""

        df = self.df.copy()

        # ==================== CORE FEATURES ====================
        # Already in data, but ensure numeric types
        df['current_delay_minutes'] = pd.to_numeric(df['current_delay_minutes'], errors='coerce').fillna(0)
        df['current_speed_kmh'] = pd.to_numeric(df['current_speed_kmh'], errors='coerce').fillna(80)
        df['distance_remaining_km'] = pd.to_numeric(df['distance_remaining_km'], errors='coerce').fillna(500)
        df['distance_to_next_station_km'] = pd.to_numeric(df['distance_to_next_station_km'], errors='coerce').fillna(40)
        df['temperature_celsius'] = pd.to_numeric(df['temperature_celsius'], errors='coerce').fillna(30)
        df['rainfall_mm'] = pd.to_numeric(df.get('rainfall_mm', 0), errors='coerce').fillna(0)
        df['time_of_day_hour'] = pd.to_numeric(df['time_of_day_hour'], errors='coerce').fillna(12)
        df['day_of_week'] = pd.to_numeric(df['day_of_week'], errors='coerce').fillna(3)

        # Encode train class numerically
        df['train_class_encoded'] = df['train_class'].map({
            'Rajdhani': 1,
            'Express': 2,
            'Passenger': 3
        }).fillna(2)

        df['track_type'] = pd.to_numeric(df['track_type'], errors='coerce').fillna(1)
        df['level_crossings_ahead'] = pd.to_numeric(df['level_crossings_ahead'], errors='coerce').fillna(2)

        # ==================== ENGINEERED FEATURES ====================

        # 1. Upstream delay proxy (cascading effect from previous trains on same route/day)
        df['upstream_delay_minutes'] = (
            df.groupby(['route_id', 'date'])['current_delay_minutes']
            .shift(1).fillna(0) * 0.7
        )
        df['upstream_delay_minutes'] += (
            df.groupby(['route_id', 'date'])['current_delay_minutes']
            .shift(2).fillna(0) * 0.4
        )

        # 2. Speed trend (is train slowing down relative to average?)
        df['speed_trend'] = (
            df['current_speed_kmh'] -
            df.groupby('train_id')['current_speed_kmh'].transform('mean')
        )

        # 3. Cumulative distance percentage
        total_dist = df['distance_to_next_station_km'] + df['distance_remaining_km']
        total_dist = total_dist.replace(0, 1)  # Avoid division by zero
        df['cumulative_distance_pct'] = (
            (1 - df['distance_remaining_km'] / total_dist) * 100
        ).clip(0, 100)

        # 4. Time-based binary features
        df['is_morning_rush'] = (
            (df['time_of_day_hour'] >= 6) & (df['time_of_day_hour'] <= 9)
        ).astype(int)

        df['is_evening_rush'] = (
            (df['time_of_day_hour'] >= 17) & (df['time_of_day_hour'] <= 19)
        ).astype(int)

        df['is_peak_hour'] = (df['is_morning_rush'] | df['is_evening_rush']).astype(int)

        df['is_night'] = (
            (df['time_of_day_hour'] >= 22) | (df['time_of_day_hour'] <= 4)
        ).astype(int)

        # 5. Interaction features
        df['upstream_weather_interaction'] = (
            df['upstream_delay_minutes'] *
            (1 + np.maximum(0, df['temperature_celsius'] - 35) / 20)
        )

        # 6. Delay trend (current vs average for this train)
        df['delay_trend'] = (
            df['current_delay_minutes'] -
            df.groupby('train_id')['current_delay_minutes'].transform('mean')
        )

        # 7. Train class delay comparison
        class_avg_delays = df.groupby('train_class_encoded')['current_delay_minutes'].transform('mean')
        df['delay_vs_class_avg'] = df['current_delay_minutes'] - class_avg_delays

        # 8. Weather impact features
        df['heat_stress'] = np.maximum(0, df['temperature_celsius'] - 40)
        df['cold_fog_factor'] = np.maximum(0, 5 - df['temperature_celsius'])
        df['weather_delay_factor'] = (
            df['heat_stress'] * 0.3 +
            df['cold_fog_factor'] * 0.5 +
            df['rainfall_mm'] * 0.1 +
            df['level_crossings_ahead'] * 0.2
        )

        # 9. Occupancy proxy (trains ahead on same section, same day)
        df['trains_ahead_indicator'] = df.groupby(['route_id', 'date']).cumcount()

        # 10. Seasonal factor
        df['month'] = pd.to_datetime(df['date']).dt.month
        conditions = [
            (df['month'] >= 6) & (df['month'] <= 9),   # Monsoon
            (df['month'] >= 4) & (df['month'] <= 5),   # Summer
            (df['month'] >= 11) | (df['month'] <= 2),  # Winter/Fog
        ]
        choices = [1.3, 1.1, 1.15]
        df['seasonal_factor'] = np.select(conditions, choices, default=0.9)

        # 11. Is weekend
        df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

        # 12. Station progress (how far along the journey)
        df['station_progress'] = pd.to_numeric(df['station_number'], errors='coerce').fillna(0)

        # ==================== TARGET VARIABLE ====================
        # Target: delay at current station (what we want to predict)
        # For training: we use the delay at the NEXT station as target
        df['target_delay'] = df.groupby(['train_id', 'date'])['current_delay_minutes'].shift(-1)
        df['target_delay'] = df['target_delay'].fillna(df['current_delay_minutes'])

        # ==================== SELECT FINAL FEATURES ====================
        feature_cols = [
            'current_delay_minutes',
            'current_speed_kmh',
            'distance_remaining_km',
            'distance_to_next_station_km',
            'upstream_delay_minutes',
            'speed_trend',
            'temperature_celsius',
            'rainfall_mm',
            'time_of_day_hour',
            'day_of_week',
            'train_class_encoded',
            'track_type',
            'level_crossings_ahead',
            'is_morning_rush',
            'is_evening_rush',
            'is_peak_hour',
            'is_night',
            'upstream_weather_interaction',
            'delay_trend',
            'delay_vs_class_avg',
            'heat_stress',
            'cold_fog_factor',
            'weather_delay_factor',
            'cumulative_distance_pct',
            'trains_ahead_indicator',
            'seasonal_factor',
            'is_weekend',
            'station_progress',
        ]

        self.feature_names = feature_cols

        # Build final DataFrame
        result_df = df[feature_cols + ['target_delay', 'train_class']].copy()

        # Remove rows with NaN
        initial_len = len(result_df)
        result_df = result_df.dropna()
        dropped = initial_len - len(result_df)
        if dropped > 0:
            print(f"  Dropped {dropped} rows with NaN ({dropped/initial_len*100:.1f}%)")

        return result_df, feature_cols


def main():
    print("=" * 60)
    print("Railway ETA Prediction - Feature Engineering")
    print("=" * 60)

    # Load raw data
    data_path = os.path.join('data', 'synthetic_railway_data.csv')
    if not os.path.exists(data_path):
        print(f"ERROR: {data_path} not found!")
        print("Run generate_data.py first.")
        return

    print(f"Loading data from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"✓ Loaded {len(df):,} records")

    # Engineer features
    print("\nEngineering features...")
    fe = FeatureEngineering(df)
    features_df, feature_cols = fe.create_features()

    # Validation
    print(f"\n{'='*60}")
    print("FEATURE VALIDATION")
    print(f"{'='*60}")
    print(f"✓ Records: {len(features_df):,}")
    print(f"✓ Features: {len(feature_cols)}")
    print(f"✓ Feature names: {feature_cols}")

    print(f"\n--- Feature Statistics ---")
    for col in feature_cols[:10]:
        print(f"  {col}: mean={features_df[col].mean():.2f}, std={features_df[col].std():.2f}")
    print(f"  ... ({len(feature_cols) - 10} more features)")

    print(f"\n--- Target Variable ---")
    print(f"  Mean target delay: {features_df['target_delay'].mean():.2f} min")
    print(f"  Std target delay: {features_df['target_delay'].std():.2f} min")

    # Save
    output_path = os.path.join('data', 'engineered_features.csv')
    features_df.to_csv(output_path, index=False)
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n✓ Saved to {output_path} ({file_size_mb:.1f} MB)")


if __name__ == '__main__':
    main()
