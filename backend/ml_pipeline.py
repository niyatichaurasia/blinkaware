import keras
import tensorflow as tf
import cv2
import numpy as np
from typing import Dict, Any, Optional
import logging
from collections import deque
from keras.layers import Dense
# Patch Dense to ignore quantization_config
original_init = Dense.__init__
def patched_init(self, *args, **kwargs):
    kwargs.pop("quantization_config", None)
    original_init(self, *args, **kwargs)

Dense.__init__ = patched_init

logger = logging.getLogger(__name__)


class BlinkDetectionModel:
    def __init__(self, model_path: Optional[str] = None):
        if model_path:
            self.model = keras.models.load_model(
            model_path,
            compile=False,
            safe_mode=False
            )
            self.model.trainable = False
            logger.info(f"Model loaded from {model_path}")
        else:
            raise RuntimeError("Model path required for TensorFlow model")

        # ---- Blink logic state ----
        self.prev_state = "open"
        self.closed_frames = 0
        self.history = deque(maxlen=5)

        # ---- Config ----
        self.CONF_THRESHOLD = 0.6
        self.MIN_CLOSED_FRAMES = 2

    def preprocess(self, frame: np.ndarray):
        # EXACT match with training
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        frame = cv2.resize(frame, (64, 64))
        frame = frame / 255.0
        frame = np.expand_dims(frame, axis=-1)
        frame = np.expand_dims(frame, axis=0)
        return frame

    def predict(self, frame: np.ndarray) -> Dict[str, Any]:
        img = self.preprocess(frame)

        pred = self.model.predict(img, verbose=0)[0][0]

        # ---- Confidence filtering ----
        if pred > self.CONF_THRESHOLD:
            state = "open"
        elif pred < (1 - self.CONF_THRESHOLD):
            state = "closed"
        else:
            state = self.prev_state

        # ---- Smoothing ----
        self.history.append(state)
        smoothed_state = max(set(self.history), key=self.history.count)

        # ---- Blink detection ----
        blink = False

        if smoothed_state == "closed":
            self.closed_frames += 1

        if self.prev_state == "closed" and smoothed_state == "open":
            if self.closed_frames >= self.MIN_CLOSED_FRAMES:
                blink = True
            self.closed_frames = 0

        self.prev_state = smoothed_state

        return {
            "is_blink": blink,
            "confidence": float(pred),
            "eye_state": smoothed_state
        }


class MLPipeline:
    def __init__(self, model_path: Optional[str] = None,
                 sampling_rate: int = 5):

        self.model = BlinkDetectionModel(model_path)
        self.sampling_rate = sampling_rate
        self.frame_count = 0

        logger.info(f"ML Pipeline initialized (sampling_rate={sampling_rate})")

    def should_process_frame(self) -> bool:
        self.frame_count += 1
        return self.frame_count % self.sampling_rate == 0

    def process_frame(self, frame_data: bytes) -> Optional[Dict[str, Any]]:
        if not self.should_process_frame():
            return None

        try:
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                logger.error("Frame decode failed")
                return None

            result = self.model.predict(frame)
            return result

        except Exception as e:
            logger.error(f"ML error: {e}")
            return None

    def reset(self):
        self.frame_count = 0


# -------- GLOBAL INSTANCE --------
ml_pipeline: Optional[MLPipeline] = None


def initialize_ml_pipeline(model_path: Optional[str] = None):
    global ml_pipeline
    ml_pipeline = MLPipeline(model_path=model_path)
    logger.info("ML Pipeline initialized")


def get_ml_pipeline() -> MLPipeline:
    if ml_pipeline is None:
        raise RuntimeError("ML Pipeline not initialized")
    return ml_pipeline

