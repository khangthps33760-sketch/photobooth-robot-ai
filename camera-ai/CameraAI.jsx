
import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

export default function CameraAI() {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const voiceGreetingEnabledRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [faceDetected, setFaceDetected] = useState(false);
  const [status, setStatus] = useState("Đang khởi tạo...");
  const [expression, setExpression] = useState("neutral");
  const [direction, setDirection] = useState("Chưa nhận diện");
  const [voiceGreetingEnabled, setVoiceGreetingEnabled] = useState(false);
  useEffect(() => {
  voiceGreetingEnabledRef.current = voiceGreetingEnabled;
}, [voiceGreetingEnabled]);
  useEffect(() => {
    let active = true;
    let animationId;

    let lastPresence = null;
    let lastExpression = null;
    let expressionCandidate = "neutral";
    let expressionFrames = 0;
    let positiveFrames = 0;
    let negativeFrames = 0;

    let lookingAway = false;
    let awayFrames = 0;
    let towardFrames = 0;
    let awaySince = null;

    function sendMessage(message) {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify(message));
      }
    }

    function sendExpression(mood) {
      if (mood === lastExpression) return;

      lastExpression = mood;
      setExpression(mood);

      sendMessage({
        type: "expression",
        expression: mood,
      });
    }

    function updatePresence(present) {
      if (present === lastPresence) return;

      lastPresence = present;
      setFaceDetected(present);

      sendMessage({
        type: "presence",
        present,
      });

      if (!present) {
        awaySince = null;
        lookingAway = false;
        awayFrames = 0;
        towardFrames = 0;
        setDirection("Không thấy khuôn mặt");
        sendExpression("neutral");
        setStatus("Đang tìm kiếm khuôn mặt...");
      } else {
  setDirection("Đang quan sát hướng nhìn");
  setStatus("Đã nhận diện khách!");

  // Chào khách nếu chức năng giọng nói đang bật
  if (voiceGreetingEnabledRef.current) {
    const speech = new SpeechSynthesisUtterance(
      "Xin chào! Chào mừng bạn đến với Photobooth. Bạn có muốn chụp một tấm ảnh thật đẹp không?"
    );

    speech.lang = "vi-VN";
    speech.rate = 0.9;
    speech.pitch = 1.3;
    speech.volume = 1;

    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(speech);
  }
}
    }

    function estimateHeadTurn(landmarks) {
      // Hai khóe mắt và đầu mũi
      const leftEye = landmarks[33];
      const rightEye = landmarks[263];
      const nose = landmarks[1];

      const eyeCenter = (leftEye.x + rightEye.x) / 2;
      const eyeDistance = Math.abs(rightEye.x - leftEye.x);

      if (eyeDistance < 0.001) return 0;

      // Độ lệch đầu mũi so với tâm hai mắt
      return Math.abs(nose.x - eyeCenter) / eyeDistance;
    }
    function classifyExpression(categories) {
  const scores = {};

  categories.forEach((item) => {
    scores[item.categoryName] = item.score;
  });

  const smile =
    ((scores.mouthSmileLeft || 0) +
      (scores.mouthSmileRight || 0)) / 2;

  const jawOpen = scores.jawOpen || 0;

  const browDown =
    ((scores.browDownLeft || 0) +
      (scores.browDownRight || 0)) / 2;

  const mouthFrown =
    ((scores.mouthFrownLeft || 0) +
      (scores.mouthFrownRight || 0)) / 2;

  if (jawOpen > 0.5 && smile > 0.4) {
    return "laugh";
  }

  if (jawOpen > 0.55 && smile < 0.25) {
    return "surprised";
  }

  if (smile > 0.35) {
    return "happy";
  }

  if (browDown > 0.5 && smile < 0.2) {
    return "angry";
  }

  if (mouthFrown > 0.35) {
    return "sad";
  }

  return "neutral";
}
    function detectFrame() {
      if (!active || !videoRef.current || !landmarkerRef.current) {
        return;
      }

      const now = performance.now();

      const result = landmarkerRef.current.detectForVideo(
        videoRef.current,
        now
      );

      const landmarks = result.faceLandmarks?.[0];
      const detected = Boolean(landmarks);

      // Lọc nhận diện khuôn mặt để tránh chập chờn
      if (detected) {
        positiveFrames++;
        negativeFrames = 0;
      } else {
        negativeFrames++;
        positiveFrames = 0;
      }

      if (positiveFrames >= 3) {
        updatePresence(true);
      }

      if (negativeFrames >= 10) {
        updatePresence(false);
      }

      if (lastPresence === true && landmarks) {
        const headTurn = estimateHeadTurn(landmarks);

        // Ngưỡng vào và ra khác nhau để tránh đổi trạng thái liên tục
        if (!lookingAway) {
          if (headTurn > 0.20) {
            awayFrames++;
          } else {
            awayFrames = 0;
          }

          if (awayFrames >= 4) {
            lookingAway = true;
            awaySince = now;
            awayFrames = 0;
            towardFrames = 0;
            setDirection("Đang nhìn đi chỗ khác");
          }
        } else {
          if (headTurn < 0.13) {
            towardFrames++;
          } else {
            towardFrames = 0;
          }

          if (towardFrames >= 4) {
            lookingAway = false;
            awaySince = null;
            towardFrames = 0;
            awayFrames = 0;

            setDirection("Đang nhìn camera");
          }
        }
        if (!lookingAway) {
  setDirection("Đang nhìn camera");

  const blendshapes = result.faceBlendshapes?.[0]?.categories;

  if (blendshapes) {
    const detectedExpression = classifyExpression(blendshapes);

    if (detectedExpression === expressionCandidate) {
      expressionFrames++;
    } else {
      expressionCandidate = detectedExpression;
      expressionFrames = 1;
    }

    if (expressionFrames >= 5) {
      sendExpression(detectedExpression);
    }
  }
}
        
        else if (awaySince !== null) {
          // Giữ biểu cảm thân thiện khi khách quay mặt đi.
          sendExpression("happy");
        }
      }

      animationId = requestAnimationFrame(detectFrame);
    }

    async function startAI() {
      try {
        // 1. Kết nối Robot Server
        const socket = new WebSocket(
  "wss://photobooth-robot-ai.onrender.com"
);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log("Đã kết nối Robot Server");

          if (lastPresence !== null) {
            sendMessage({
              type: "presence",
              present: lastPresence,
            });
          }

          if (lastExpression) {
            sendMessage({
              type: "expression",
              expression: lastExpression,
            });
          }
        };

        socket.onerror = () => {
          console.error("Không kết nối được Robot Server");
        };

        // 2. Khởi tạo MediaPipe
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });

        if (!active) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;

        // 3. Mở camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: 640,
            height: 480,
          },
          audio: false,
        });

        streamRef.current = stream;

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        videoRef.current.srcObject = stream;
        await videoRef.current.play();

        if (!active) return;

        setCameraReady(true);
        setStatus("Camera đang hoạt động");

        // 4. Bắt đầu nhận diện
        detectFrame();
      } catch (error) {
        console.error("Camera AI error:", error);
        setStatus("Lỗi: " + error.message);
      }
    }

    startAI();

    return () => {
      active = false;

      cancelAnimationFrame(animationId);

      landmarkerRef.current?.close();
      landmarkerRef.current = null;

      socketRef.current?.close();
      socketRef.current = null;

      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  const expressionLabels = {
    neutral: "Bình thường",
    happy: "Vui vẻ",
    sad: "Buồn",
    angry: "Giận dữ",
    excited: "Hào hứng",
    laugh: "Cười",
    surprised: "Ngạc nhiên",
  };

  return (
    <div style={styles.container}>
      <h2>PHOTOBOOTH ROBOT AI 2.0</h2>

      <div style={styles.cameraBox}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={styles.video}
        />

        {!cameraReady && <p>Đang mở camera...</p>}
      </div>

      <div style={styles.info}>
                <div style={styles.settingsPanel}>
          <h3>CÀI ĐẶT ROBOT AI</h3>

          <div style={styles.settingRow}>
            <div>
              <strong>Chào khách bằng giọng nói</strong>
              <p>Tự động chào khi phát hiện khách mới</p>
            </div>

            <button
              onClick={() =>
                setVoiceGreetingEnabled((prev) => !prev)
              }
              style={{
                ...styles.toggleButton,
                background: voiceGreetingEnabled ? "#00c781" : "#475569",
              }}
            >
              {voiceGreetingEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
        <button
  onClick={() => {
    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(
      "Hello! Xin chàooo! Chào mừng bạn đến với Photobooth nha!"
    );

    speech.lang = "vi-VN";
    speech.rate = 0.9;
    speech.pitch = 1.3;
    speech.volume = 1;

    window.speechSynthesis.speak(speech);
  }}
  style={{
    ...styles.toggleButton,
    background: "#087ea4",
    marginTop: "12px",
  }}
>
  TEST GIỌNG NÓI
</button>
        <div style={styles.status}>
          <span
            style={{
              ...styles.dot,
              background: faceDetected ? "#00ff88" : "#ffaa00",
            }}
          />
          {status}
        </div>

        <div style={styles.panel}>
          <p>
            <strong>Khuôn mặt:</strong>{" "}
            {faceDetected ? "Đã nhận diện" : "Chưa nhận diện"}
          </p>

          <p>
            <strong>Hướng đầu:</strong> {direction}
          </p>

          <p>
            <strong>Biểu cảm Robot:</strong>{" "}
            {expressionLabels[expression] || expression}
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "#07111f",
    color: "white",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    gap: "16px",
    padding: "20px",
  },
  cameraBox: {
    width: "100%",
    maxWidth: "640px",
    minHeight: "240px",
    background: "#000",
    borderRadius: "16px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  video: {
    width: "100%",
    display: "block",
    transform: "scaleX(-1)",
  },
  info: {
    width: "100%",
    maxWidth: "640px",
  },
  status: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    fontSize: "15px",
  },
  dot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
  },
  panel: {
    marginTop: "14px",
    padding: "12px 18px",
    background: "#10243b",
    borderRadius: "12px",
    fontSize: "14px",
    lineHeight: 1.5,
  },
  settingsPanel: {
    width: "100%",
    maxWidth: "640px",
    padding: "16px",
    background: "#10243b",
    border: "1px solid #24415f",
    borderRadius: "12px",
    boxSizing: "border-box",
  },

  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },

  toggleButton: {
    minWidth: "65px",
    padding: "10px 16px",
    border: "none",
    borderRadius: "20px",
    color: "white",
    fontWeight: "bold",
    cursor: "pointer",
  },
};
