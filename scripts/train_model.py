"""
Railway ETA Prediction System - Model Training
================================================
Trains separate XGBoost models for each train class (Rajdhani, Express, Passenger)
with hyperparameter tuning and comprehensive evaluation metrics.

Output: models/ directory with trained models and metadata
"""

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import json
import os
import pickle
import time


class XGBoostMultiModel:
    """Train and manage separate XGBoost models per train class"""

    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.feature_names = []
        self.feature_importances = {}
        self.metrics = {}

    def train(self, df, feature_cols, target_col='target_delay'):
        """
        Train 3 XGBoost models (one per train class)

        Args:
            df: DataFrame with features + target + train_class
            feature_cols: list of feature column names
            target_col: target column name
        """

        self.feature_names = list(feature_cols)

        # Class mapping
        classes = {
            1: 'Rajdhani',
            2: 'Express',
            3: 'Passenger'
        }

        for class_id, class_name in classes.items():
            print(f"\n{'='*60}")
            print(f"Training {class_name} Model (class_id={class_id})")
            print(f"{'='*60}")

            # Filter data for this class
            class_mask = df['train_class_encoded'] == class_id
            class_df = df[class_mask].copy()

            if len(class_df) < 100:
                print(f"  ⚠ Skipping {class_name}: only {len(class_df)} samples")
                continue

            print(f"  Samples: {len(class_df):,}")

            X = class_df[feature_cols].values
            y = class_df[target_col].values

            # Time-based split (preserve temporal order)
            split_idx = int(0.7 * len(X))
            val_idx = int(0.85 * len(X))

            X_train = X[:split_idx]
            y_train = y[:split_idx]
            X_val = X[split_idx:val_idx]
            y_val = y[split_idx:val_idx]
            X_test = X[val_idx:]
            y_test = y[val_idx:]

            print(f"  Train: {len(X_train):,} | Val: {len(X_val):,} | Test: {len(X_test):,}")

            # Scale features
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_val_scaled = scaler.transform(X_val)
            X_test_scaled = scaler.transform(X_test)

            # XGBoost hyperparameters (tuned for accuracy)
            xgb_params = {
                'n_estimators': 200,
                'max_depth': 7,
                'learning_rate': 0.08,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'min_child_weight': 3,
                'gamma': 1.0,
                'reg_alpha': 0.1,
                'reg_lambda': 1.0,
                'random_state': 42,
                'n_jobs': -1,
                'early_stopping_rounds': 15,
            }

            # Train
            print(f"\n  Training with {xgb_params['n_estimators']} trees...")
            start_time = time.time()

            model = xgb.XGBRegressor(**xgb_params)
            model.fit(
                X_train_scaled, y_train,
                eval_set=[(X_val_scaled, y_val)],
                verbose=50
            )

            train_time = time.time() - start_time

            # Evaluate
            y_pred_train = model.predict(X_train_scaled)
            y_pred_val = model.predict(X_val_scaled)
            y_pred_test = model.predict(X_test_scaled)

            # Metrics
            mae_train = mean_absolute_error(y_train, y_pred_train)
            mae_val = mean_absolute_error(y_val, y_pred_val)
            mae_test = mean_absolute_error(y_test, y_pred_test)
            rmse_test = np.sqrt(mean_squared_error(y_test, y_pred_test))
            p90_error = np.percentile(np.abs(y_pred_test - y_test), 90)

            print(f"\n  {class_name} Model Results:")
            print(f"  {'─'*40}")
            print(f"  Train MAE:  {mae_train:.2f} minutes")
            print(f"  Val MAE:    {mae_val:.2f} minutes")
            print(f"  Test MAE:   {mae_test:.2f} minutes")
            print(f"  Test RMSE:  {rmse_test:.2f} minutes")
            print(f"  90th %-ile: {p90_error:.2f} minutes")
            print(f"  Train time: {train_time:.1f} seconds")
            print(f"  Best iteration: {model.best_iteration}")

            # Feature importance
            importance_dict = {}
            for idx, name in enumerate(feature_cols):
                importance_dict[name] = float(model.feature_importances_[idx])

            # Sort by importance
            importance_sorted = sorted(importance_dict.items(), key=lambda x: x[1], reverse=True)
            print(f"\n  Top 10 Features:")
            for feat_name, feat_imp in importance_sorted[:10]:
                print(f"    {feat_name}: {feat_imp:.4f}")

            # Store
            self.models[class_name] = model
            self.scalers[class_name] = scaler
            self.feature_importances[class_name] = importance_dict
            self.metrics[class_name] = {
                'mae_train': mae_train,
                'mae_val': mae_val,
                'mae_test': mae_test,
                'rmse_test': rmse_test,
                'p90_error': p90_error,
                'samples': len(class_df),
                'train_time_seconds': train_time,
                'best_iteration': int(model.best_iteration),
            }

        return self.models

    def predict_eta(self, features_dict, train_class='Express'):
        """Predict ETA delay for a single train"""

        if train_class not in self.models:
            train_class = 'Express'  # Fallback

        feature_array = np.array([
            features_dict.get(f, 0) for f in self.feature_names
        ]).reshape(1, -1)

        feature_scaled = self.scalers[train_class].transform(feature_array)
        predicted_delay = self.models[train_class].predict(feature_scaled)[0]

        return max(0, float(predicted_delay))

    def save(self, path='./models'):
        """Save all models and metadata to disk"""
        os.makedirs(path, exist_ok=True)

        # Save XGBoost models
        for class_name, model in self.models.items():
            model_path = os.path.join(path, f'xgb_{class_name}.json')
            model.save_model(model_path)
            print(f"  ✓ Saved {class_name} model to {model_path}")

        # Save scalers
        scalers_path = os.path.join(path, 'scalers.pkl')
        with open(scalers_path, 'wb') as f:
            pickle.dump(self.scalers, f)
        print(f"  ✓ Saved scalers to {scalers_path}")

        # Save metadata
        metadata = {
            'feature_names': self.feature_names,
            'feature_importances': self.feature_importances,
            'metrics': self.metrics,
            'model_classes': list(self.models.keys()),
            'scaler_params': {
                k: {'mean': v.mean_.tolist(), 'scale': v.scale_.tolist()}
                for k, v in self.scalers.items()
            },
        }

        metadata_path = os.path.join(path, 'metadata.json')
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        print(f"  ✓ Saved metadata to {metadata_path}")

        print(f"\n✓ All models saved to {path}/")

    def load(self, path='./models'):
        """Load models and metadata from disk"""

        # Load metadata
        metadata_path = os.path.join(path, 'metadata.json')
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)

        self.feature_names = metadata['feature_names']
        self.feature_importances = metadata['feature_importances']
        self.metrics = metadata.get('metrics', {})

        # Load XGBoost models
        for class_name in metadata['model_classes']:
            model_path = os.path.join(path, f'xgb_{class_name}.json')
            if os.path.exists(model_path):
                model = xgb.XGBRegressor()
                model.load_model(model_path)
                self.models[class_name] = model
                print(f"  ✓ Loaded {class_name} model")

        # Load scalers
        scalers_path = os.path.join(path, 'scalers.pkl')
        if os.path.exists(scalers_path):
            with open(scalers_path, 'rb') as f:
                self.scalers = pickle.load(f)
            print(f"  ✓ Loaded scalers")
        else:
            # Reconstruct from metadata
            for class_name, params in metadata.get('scaler_params', {}).items():
                scaler = StandardScaler()
                scaler.mean_ = np.array(params['mean'])
                scaler.scale_ = np.array(params['scale'])
                scaler.var_ = scaler.scale_ ** 2
                scaler.n_features_in_ = len(params['mean'])
                self.scalers[class_name] = scaler

        print(f"\n✓ All models loaded from {path}/")
        return self


def main():
    print("=" * 60)
    print("Railway ETA Prediction - Model Training")
    print("=" * 60)

    # Load engineered features
    data_path = os.path.join('data', 'engineered_features.csv')
    if not os.path.exists(data_path):
        print(f"ERROR: {data_path} not found!")
        print("Run feature_engineering.py first.")
        return

    print(f"Loading features from {data_path}...")
    df = pd.read_csv(data_path)
    print(f"✓ Loaded {len(df):,} records")

    # Feature columns (exclude target and train_class)
    feature_cols = [col for col in df.columns
                    if col not in ['target_delay', 'train_class']]

    print(f"✓ Using {len(feature_cols)} features")

    # Train
    model_manager = XGBoostMultiModel()
    models = model_manager.train(df, feature_cols, target_col='target_delay')

    # Save
    models_dir = os.path.join('models')
    model_manager.save(models_dir)

    # Summary
    print(f"\n{'='*60}")
    print("TRAINING SUMMARY")
    print(f"{'='*60}")
    for class_name, metrics in model_manager.metrics.items():
        print(f"\n  {class_name}:")
        print(f"    MAE: {metrics['mae_test']:.2f} min")
        print(f"    RMSE: {metrics['rmse_test']:.2f} min")
        print(f"    90th %-ile Error: {metrics['p90_error']:.2f} min")
        print(f"    Samples: {metrics['samples']:,}")

    # Test single prediction
    print(f"\n{'='*60}")
    print("TEST INFERENCE")
    print(f"{'='*60}")

    test_features = {col: float(df[col].median()) for col in feature_cols}
    test_features['current_delay_minutes'] = 8.0

    for tc in ['Rajdhani', 'Express', 'Passenger']:
        if tc in model_manager.models:
            test_features['train_class_encoded'] = {'Rajdhani': 1, 'Express': 2, 'Passenger': 3}[tc]
            pred = model_manager.predict_eta(test_features, tc)
            print(f"  {tc} prediction (8 min current delay): {pred:.1f} min")

    print("\n✓ Training complete! Models saved to ./models/")


if __name__ == '__main__':
    main()
