"""
Railway ETA Prediction - Inference Engine
==========================================
Loads trained XGBoost models and provides fast inference.
"""

import numpy as np
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
import json
import os
import pickle


class InferenceEngine:
    """Load and serve trained ML models for ETA prediction"""

    def __init__(self, models_path='./models'):
        self.models = {}
        self.scalers = {}
        self.feature_names = []
        self.feature_importances = {}
        self._loaded = False

        if os.path.exists(models_path):
            self.load(models_path)

    def load(self, path):
        """Load all models and metadata"""
        try:
            # Load metadata
            metadata_path = os.path.join(path, 'metadata.json')
            if not os.path.exists(metadata_path):
                print(f"  [WARN] No metadata.json found in {path}")
                return

            with open(metadata_path, 'r') as f:
                metadata = json.load(f)

            self.feature_names = metadata['feature_names']
            self.feature_importances = metadata.get('feature_importances', {})

            # Load XGBoost models
            for class_name in metadata.get('model_classes', ['Rajdhani', 'Express', 'Passenger']):
                model_path = os.path.join(path, f'xgb_{class_name}.json')
                if os.path.exists(model_path):
                    model = xgb.XGBRegressor()
                    model.load_model(model_path)
                    self.models[class_name] = model
                    print(f"  [OK] Loaded {class_name} model")

            # Load scalers
            scalers_path = os.path.join(path, 'scalers.pkl')
            if os.path.exists(scalers_path):
                with open(scalers_path, 'rb') as f:
                    self.scalers = pickle.load(f)
                print(f"  [OK] Loaded scalers")
            elif 'scaler_params' in metadata:
                for class_name, params in metadata['scaler_params'].items():
                    scaler = StandardScaler()
                    scaler.mean_ = np.array(params['mean'])
                    scaler.scale_ = np.array(params['scale'])
                    scaler.var_ = scaler.scale_ ** 2
                    scaler.n_features_in_ = len(params['mean'])
                    self.scalers[class_name] = scaler

            self._loaded = len(self.models) > 0
            if self._loaded:
                print(f"  [OK] Inference engine ready ({len(self.models)} models)")

        except Exception as e:
            print(f"  [WARN] Error loading models: {e}")
            self._loaded = False

    def is_loaded(self):
        """Check if models are loaded and ready"""
        return self._loaded

    def predict(self, features_dict, train_class='Express'):
        """
        Predict delay for a single train

        Args:
            features_dict: dict of feature name -> value
            train_class: "Rajdhani" | "Express" | "Passenger"

        Returns: predicted delay in minutes
        """
        if not self._loaded:
            return features_dict.get('current_delay_minutes', 0) * 1.05

        if train_class not in self.models:
            train_class = 'Express'

        # Build feature array in correct order
        feature_array = np.array([
            features_dict.get(f, 0) for f in self.feature_names
        ]).reshape(1, -1)

        # Scale
        if train_class in self.scalers:
            feature_array = self.scalers[train_class].transform(feature_array)

        # Predict
        prediction = self.models[train_class].predict(feature_array)[0]
        return max(0, float(prediction))

    def get_feature_importance(self, train_class='Express'):
        """Get sorted feature importance"""
        if train_class not in self.feature_importances:
            return []

        importance = self.feature_importances[train_class]
        sorted_imp = sorted(importance.items(), key=lambda x: x[1], reverse=True)
        total = sum(v for _, v in sorted_imp) or 1

        return [
            {
                "feature": name,
                "importance": round(value / total, 3),
                "description": self._feature_description(name),
            }
            for name, value in sorted_imp[:10]
        ]

    @staticmethod
    def _feature_description(feature_name):
        """Human-readable description for features"""
        descriptions = {
            'current_delay_minutes': 'Current accumulated delay',
            'current_speed_kmh': 'Current train speed',
            'distance_remaining_km': 'Distance to destination',
            'distance_to_next_station_km': 'Distance to next station',
            'upstream_delay_minutes': 'Delay of trains ahead',
            'speed_trend': 'Speed trend (acceleration/deceleration)',
            'temperature_celsius': 'Ambient temperature',
            'rainfall_mm': 'Rainfall intensity',
            'time_of_day_hour': 'Time of day',
            'day_of_week': 'Day of week',
            'train_class_encoded': 'Train class priority',
            'track_type': 'Track type (dedicated/mixed)',
            'level_crossings_ahead': 'Level crossings ahead',
            'is_morning_rush': 'Morning rush hour indicator',
            'is_evening_rush': 'Evening rush hour indicator',
            'is_peak_hour': 'Peak hour indicator',
            'is_night': 'Night time indicator',
            'upstream_weather_interaction': 'Upstream delay × weather',
            'delay_trend': 'Delay trend vs average',
            'delay_vs_class_avg': 'Delay vs class average',
            'heat_stress': 'Heat stress factor',
            'cold_fog_factor': 'Cold/fog factor',
            'weather_delay_factor': 'Combined weather impact',
            'cumulative_distance_pct': 'Journey progress percentage',
            'trains_ahead_indicator': 'Track occupancy indicator',
            'seasonal_factor': 'Seasonal delay factor',
            'is_weekend': 'Weekend indicator',
            'station_progress': 'Station progress along route',
        }
        return descriptions.get(feature_name, feature_name.replace('_', ' ').title())
