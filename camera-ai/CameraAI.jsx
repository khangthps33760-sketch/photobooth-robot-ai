
import { useEffect, useRef, useState } from "react";
import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";
export default function CameraAI() {
  const videoRef = useRef(null);
  const landmarkerRef = useRef(null);
  const gestureDetectionEnabledRef = useRef(true);
  const gestureRecognizerRef = useRef(null);
  const socketRef = useRef(null);
  const streamRef = useRef(null);
  const voiceGreetingEnabledRef = useRef(false);
  const smileDetectionEnabledRef = useRef(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [gestureDetectionEnabled, setGestureDetectionEnabled] = useState(true);
  const [detectedGesture, setDetectedGesture] = useState("Chưa nhận diện");
  const [faceDetected, setFaceDetected] = useState(false);
  const [status, setStatus] = useState("Đang khởi tạo...");
  const [expression, setExpression] = useState("neutral");
  const [direction, setDirection] = useState("Chưa nhận diện");
  const [voiceGreetingEnabled, setVoiceGreetingEnabled] = useState(false);
  const [smileDetectionEnabled, setSmileDetectionEnabled] = useState(true);
  // Robot Control Mode
  const [controlMode, setControlMode] = useState("auto");
  const controlModeRef = useRef("auto");
  const gestureCandidateRef = useRef("");
  const gestureFramesRef = useRef(0);
  const lastGestureRef = useRef("");
  useEffect(() => {
  voiceGreetingEnabledRef.current = voiceGreetingEnabled;
}, [voiceGreetingEnabled]);
  useEffect(() => {
  smileDetectionEnabledRef.current = smileDetectionEnabled;
}, [smileDetectionEnabled]);
  useEffect(() => {
  gestureDetectionEnabledRef.current = gestureDetectionEnabled;
}, [gestureDetectionEnabled]);
  useEffect(() => {
  controlModeRef.current = controlMode;
}, [controlMode]);
  useEffect(() => {
    let active = true;
    let animationId;

    let lastPresence = null;
    let lastExpression = null;
    let lastTrackingSent = 0;
    // Kiểm soát Robot chỉ chào một lần khi khách xuất hiện
    let greetingPlayed = false;
    // Khóa nhận diện cảm xúc trong lúc Robot đang chào
    let greetingInProgress = false;
    // Thời điểm tương tác cử chỉ tay gần nhất
    let lastGestureInteraction = 0;
    // Thời gian ưu tiên phản ứng cử chỉ tay
    const GESTURE_PRIORITY_DURATION = 2500;
    let expressionCandidate = "neutral";
    let expressionFrames = 0;
    let expressionCandidateSince = 0;
    // Thời điểm Robot đổi biểu cảm gần nhất
    let lastExpressionChange = 0;
    // Khoảng nghỉ tối thiểu giữa hai lần đổi biểu cảm
    const EXPRESSION_COOLDOWN = 800;
    // Lưu cảm xúc mới nhất đang chờ xử lý
    let pendingExpression = null;
    // Lưu điểm Blendshapes đã được làm mượt
    let smoothedScores = {};
    const SMOOTHING_FACTOR = 0.25;
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
    function sendExpression(mood, force = false) {
  // Không cho AI ghi đè khi đang điều khiển thủ công
  if (controlModeRef.current === "manual") return;

  // Nếu cảm xúc đã giống trạng thái hiện tại,
  // hủy cảm xúc đang chờ nếu có
  if (mood === lastExpression) {
    pendingExpression = null;
    return;
  }

  // Lưu cảm xúc mới nhất
  pendingExpression = mood;

  const now = performance.now();

  // Kiểm tra Cooldown
  if (
  !force &&
  lastExpressionChange > 0 &&
  now - lastExpressionChange < EXPRESSION_COOLDOWN
) {
  return;
}

  // Lấy cảm xúc mới nhất trong hàng đợi
  const nextExpression = pendingExpression;

  if (!nextExpression) return;

  pendingExpression = null;
  lastExpressionChange = now;
  lastExpression = nextExpression;

  setExpression(nextExpression);

  sendMessage({
    type: "expression",
    expression: nextExpression,
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
        greetingPlayed = false;
        lookingAway = false;
        awayFrames = 0;
        towardFrames = 0;
        setDirection("Không thấy khuôn mặt");
        sendExpression("neutral", true);
        setStatus("Đang tìm kiếm khuôn mặt...");
      } else {
  setDirection("Đang quan sát hướng nhìn");
  setStatus("Đã nhận diện khách!");

// Chỉ chào một lần khi khách mới xuất hiện
if (
  voiceGreetingEnabledRef.current &&
  !greetingPlayed
) {
  greetingPlayed = true;
  greetingInProgress = true;
  sendExpression("happy", true);
  const speech = new SpeechSynthesisUtterance(
    "Xin chào! Chào mừng bạn đến với Next Level. Rất vui được gặp bạn! Hãy cùng mình lưu lại những khoảnh khắc thật tuyệt vời nhé!"
  );
  speech.lang = "vi-VN";
  speech.rate = 0.95; // Giảm nhẹ tốc độ (0.95) giúp câu chào nghe tự nhiên và thân thiện hơn
  speech.pitch = 1;
  speech.volume = 1;

  // Lấy danh sách giọng đọc và lọc ra tiếng Việt
  const voices = window.speechSynthesis.getVoices();
  const viVoices = voices.filter((voice) => voice.lang.includes("vi"));

  // Ưu tiên chọn giọng đọc tự nhiên (Edge Natural -> Google -> Giọng tiếng Việt đầu tiên)
  const bestVoice =
    viVoices.find((v) => v.name.includes("HoaiMy") || v.name.includes("Natural")) ||
    viVoices.find((v) => v.name.includes("Google")) ||
    viVoices[0];

  if (bestVoice) {
    speech.voice = bestVoice;
  }

  window.speechSynthesis.cancel();
  speech.onstart = () => {
  window.robotTalking = true;
};

speech.onend = () => {
  window.robotTalking = false;
  greetingInProgress = false;
};
speech.onerror = () => {
  window.robotTalking = false;
  greetingInProgress = false;
};

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
      function classifyExpression(categories, smileEnabled = true) {
  const scores = {};

  categories.forEach((item) => {
    const name = item.categoryName;
    const currentScore = item.score;

    const previousScore = smoothedScores[name] ?? currentScore;

    // Exponential Moving Average
    smoothedScores[name] =
      previousScore +
      SMOOTHING_FACTOR * (currentScore - previousScore);

    scores[name] = smoothedScores[name];
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
  // 1. Cười lớn: nụ cười mạnh và hàm mở rộng
if (smileEnabled && smile > 0.65 && jawOpen > 0.45) {
  return "laugh";
}

// 2. Ngạc nhiên: hàm mở nhưng không cười
if (jawOpen > 0.55 && smile < 0.25) {
  return "surprised";
}

// 3. Cười vui: nụ cười rõ rệt
if (smileEnabled && smile > 0.45) {
  return "happy";
}

// 4. Cười nhẹ: nụ cười vừa phải
if (smileEnabled && smile > 0.25) {
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
      // Nhận diện cử chỉ tay
if (
  controlModeRef.current === "auto" &&
  gestureDetectionEnabledRef.current &&
  gestureRecognizerRef.current
) {
  const gestureResult = gestureRecognizerRef.current.recognizeForVideo(
    videoRef.current,
    now
  );

  const gesture = gestureResult.gestures?.[0]?.[0];

    if (gesture && gesture.score > 0.65) {
  const gestureName = gesture.categoryName;

  if (gestureCandidateRef.current === gestureName) {
    gestureFramesRef.current += 1;
  } else {
    gestureCandidateRef.current = gestureName;
    gestureFramesRef.current = 1;
  }

  if (
    gestureFramesRef.current >= 5 &&
    lastGestureRef.current !== gestureName
  ) {
    lastGestureRef.current = gestureName;
    // Đánh dấu thời điểm khách vừa tương tác
    lastGestureInteraction = now;
    const gestureLabels = {
      Open_Palm: "Giơ bàn tay",
      Thumb_Up: "Thích",
      Thumb_Down: "Không thích",
      Victory: "Ký hiệu chữ V",
      Closed_Fist: "Nắm tay",
      Pointing_Up: "Chỉ tay",
      ILoveYou: "I Love You",
    };

    const gestureExpressions = {
      Open_Palm: "happy",
      Thumb_Up: "excited",
      Thumb_Down: "sad",
      Victory: "love",
      Closed_Fist: "angry",
      Pointing_Up: "curious",
      ILoveYou: "love",
    };

    setDetectedGesture(gestureLabels[gestureName] || gestureName);

    const newExpression = gestureExpressions[gestureName];

    if (newExpression) {
      setExpression(newExpression);

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(
          JSON.stringify({
            type: "expression",
            expression: newExpression,
          })
        );
      }
    }
  }
} else {
  gestureCandidateRef.current = "";
  gestureFramesRef.current = 0;
  lastGestureRef.current = "";
  setDetectedGesture("Chưa nhận diện");
}
}
      const result = landmarkerRef.current.detectForVideo(
        videoRef.current,
        now
      );

      const landmarks = result.faceLandmarks?.[0];
      const detected = Boolean(landmarks);
      // Gửi vị trí khuôn mặt sang Robot LED
if (landmarks && now - lastTrackingSent > 50) {
  const nose = landmarks[1];

  const trackingX = (0.5 - nose.x) * 2;
  const trackingY = (0.5 - nose.y) * 2;

  sendMessage({
    type: "tracking",
    x: Math.max(-1, Math.min(1, trackingX)),
    y: Math.max(-1, Math.min(1, trackingY)),
  });

  lastTrackingSent = now;
}

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

    if (
  blendshapes &&
  !greetingInProgress &&
  now - lastGestureInteraction > GESTURE_PRIORITY_DURATION
) {
    const detectedExpression = classifyExpression(
  blendshapes,
  smileDetectionEnabledRef.current
);
  // Emotion Stability: yêu cầu cảm xúc ổn định trước khi đổi
if (detectedExpression === expressionCandidate) {
  expressionFrames++;
} else {
  expressionCandidate = detectedExpression;
  expressionFrames = 1;
  expressionCandidateSince = now;
}

// Chỉ xác nhận khi cảm xúc duy trì ít nhất 300ms
if (
  expressionFrames >= 5 &&
  now - expressionCandidateSince >= 300
) {
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
        const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
    delegate: "GPU",
  },
  runningMode: "VIDEO",
  numHands: 1,
});

gestureRecognizerRef.current = gestureRecognizer;
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
      gestureRecognizerRef.current?.close();
      gestureRecognizerRef.current = null;
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
    focused: "Tập trung",
    curious: "Tò mò",
    love: "Yêu thích",
  };
function handleManualExpression(mood) {
  if (controlModeRef.current !== "manual") return;

  setExpression(mood);

  if (socketRef.current?.readyState === WebSocket.OPEN) {
    socketRef.current.send(
      JSON.stringify({
        type: "expression",
        expression: mood,
      })
    );
  }
}

return (
  <div style={styles.container}>
    {/* HEADER */}
    <header style={styles.header}>
      <div>
        <div style={styles.brand}>NEXT LEVEL</div>
        <h2 style={styles.heading}>ROBOT AI CONTROL CENTER</h2>
        <p style={styles.subheading}>PHOTOBOOTH INTELLIGENT SYSTEM</p>
      </div>

      <div style={styles.systemBadge}>
        <span style={{
          ...styles.systemDot,
          background: cameraReady ? "#00E5A0" : "#FFB020",
        }} />
        {cameraReady ? "SYSTEM ONLINE" : "INITIALIZING"}
      </div>
    </header>

    {/* CAMERA */}
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <span style={styles.sectionNumber}>01 / MONITOR</span>
          <h3 style={styles.sectionTitle}>Camera Monitor</h3>
        </div>
        <span style={styles.liveBadge}>LIVE CAMERA</span>
      </div>

      <div style={styles.cameraBox}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          style={styles.video}
        />

        {!cameraReady && (
          <div style={styles.cameraOverlay}>
            <div style={styles.loadingDot} />
            Đang khởi tạo camera...
          </div>
        )}
      </div>

      <div style={styles.statusBar}>
        <span style={{
          ...styles.systemDot,
          background: faceDetected ? "#00E5A0" : "#FFB020",
        }} />
        <span>{status}</span>
      </div>
    </section>

    {/* AI SETTINGS */}
    <section style={styles.section}>

{/* ROBOT EXPRESSION STUDIO */}
<section style={styles.section}>
  <div style={styles.sectionHeader}>
    <div>
      <span style={styles.sectionNumber}>02 / ROBOT CONTROL</span>
      <h3 style={styles.sectionTitle}>Expression Studio</h3>
    </div>
  </div>

  <div style={styles.settingsPanel}>
    <div style={styles.settingRow}>
      <div style={styles.settingInfo}>
        <strong>Chế độ điều khiển</strong>
        <p>
          {controlMode === "auto"
            ? "Robot tự động nhận diện biểu cảm"
            : "Bạn đang điều khiển biểu cảm thủ công"}
        </p>
      </div>

      <button
        onClick={() => {
          const nextMode =
            controlMode === "auto" ? "manual" : "auto";

          controlModeRef.current = nextMode;
          setControlMode(nextMode);

          if (nextMode === "auto") {
            setExpression("neutral");

            if (socketRef.current?.readyState === WebSocket.OPEN) {
              socketRef.current.send(JSON.stringify({
                type: "expression",
                expression: "neutral",
              }));
            }
          }
        }}
        style={{
          ...styles.toggleButton,
          background: controlMode === "auto"
            ? "#00C78B"
            : "#F47721",
          minWidth: 90,
        }}
      >
        {controlMode === "auto" ? "AUTO" : "MANUAL"}
      </button>
    </div>
  </div>

  {controlMode === "manual" && (
    <div style={{
      ...styles.settingsPanel,
      marginTop: 14,
    }}>
      <div style={{ marginBottom: 16 }}>
        <strong>Chọn biểu cảm Robot</strong>
        <p style={styles.subheading}>
          Nhấn để hiển thị trực tiếp trên Robot LED
        </p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 10,
      }}>
        {[
          { id: "neutral", label: "Bình thường", icon: "😐" },
          { id: "happy", label: "Vui vẻ", icon: "😊" },
          { id: "sad", label: "Buồn", icon: "😢" },
          { id: "angry", label: "Giận dữ", icon: "😠" },
          { id: "laugh", label: "Cười", icon: "😂" },
          { id: "excited", label: "Hào hứng", icon: "🤩" },
          { id: "sleepy", label: "Buồn ngủ", icon: "😴" },
          { id: "curious", label: "Tò mò", icon: "🤔" },
          { id: "surprised", label: "Ngạc nhiên", icon: "😲" },
          { id: "wink", label: "Nháy mắt", icon: "😉" },
          { id: "focused", label: "Tập trung", icon: "🧐" },
          { id: "love", label: "Yêu thích", icon: "🥰" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => handleManualExpression(item.id)}
            style={{
              padding: "14px 6px",
              borderRadius: 12,
              border: expression === item.id
                ? "2px solid #F47721"
                : "1px solid #334155",
              background: expression === item.id
                ? "rgba(244,119,33,0.15)"
                : "#0F1B2D",
              color: "#FFFFFF",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 7,
            }}
          >
            <span style={{ fontSize: 25 }}>{item.icon}</span>
            <span style={{ fontSize: 12 }}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )}
</section>

      <div style={styles.sectionHeader}>
        <div>
          <span style={styles.sectionNumber}>02 / CONFIGURATION</span>
          <h3 style={styles.sectionTitle}>AI Control Center</h3>
        </div>
      </div>

      <div style={styles.settingsPanel}>
        <div style={styles.settingRow}>
          <div style={styles.settingInfo}>
            <strong>Chào khách bằng giọng nói</strong>
            <p>Tự động chào khi phát hiện khách mới</p>
          </div>
          <button
            onClick={() => setVoiceGreetingEnabled(prev => !prev)}
            style={{
              ...styles.toggleButton,
              background: voiceGreetingEnabled ? "#00C78B" : "#334155",
            }}
          >
            {voiceGreetingEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div style={styles.settingDivider} />

        <div style={styles.settingRow}>
          <div style={styles.settingInfo}>
            <strong>Nhận diện nụ cười</strong>
            <p>Robot tự động vui vẻ khi khách cười</p>
          </div>
          <button
            onClick={() => setSmileDetectionEnabled(prev => !prev)}
            style={{
              ...styles.toggleButton,
              background: smileDetectionEnabled ? "#00C78B" : "#334155",
            }}
          >
            {smileDetectionEnabled ? "ON" : "OFF"}
          </button>
        </div>

        <div style={styles.settingDivider} />

        <div style={styles.settingRow}>
          <div style={styles.settingInfo}>
            <strong>Nhận diện cử chỉ tay</strong>
            <p>Điều khiển biểu cảm Robot bằng bàn tay</p>
          </div>
          <button
            onClick={() => {
              setGestureDetectionEnabled(prev => !prev);
              gestureCandidateRef.current = "";
              gestureFramesRef.current = 0;
              lastGestureRef.current = "";
              setDetectedGesture("Chưa nhận diện");
            }}
            style={{
              ...styles.toggleButton,
              background: gestureDetectionEnabled ? "#00C78B" : "#334155",
            }}
          >
            {gestureDetectionEnabled ? "ON" : "OFF"}
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
        style={styles.testVoiceButton}
      >
        TEST GIỌNG NÓI
      </button>
    </section>

    {/* RECOGNITION STATUS */}
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <span style={styles.sectionNumber}>03 / INTELLIGENCE</span>
          <h3 style={styles.sectionTitle}>Recognition Status</h3>
        </div>
      </div>

      <div style={styles.statusGrid}>
        <div style={styles.statusCard}>
          <span style={styles.cardLabel}>FACE DETECTION</span>
          <strong style={styles.cardValue}>
            {faceDetected ? "Đã nhận diện" : "Chưa nhận diện"}
          </strong>
        </div>

        <div style={styles.statusCard}>
          <span style={styles.cardLabel}>HEAD DIRECTION</span>
          <strong style={styles.cardValue}>{direction}</strong>
        </div>

        <div style={styles.statusCard}>
          <span style={styles.cardLabel}>HAND GESTURE</span>
          <strong style={styles.cardValue}>
            {gestureDetectionEnabled ? detectedGesture : "Đã tắt"}
          </strong>
        </div>

        <div style={styles.statusCard}>
          <span style={styles.cardLabel}>ROBOT EXPRESSION</span>
          <strong style={styles.cardValue}>
            {expressionLabels[expression] || expression}
          </strong>
        </div>
      </div>
    </section>

    <footer style={styles.footer}>
      NEXT LEVEL EVENT · ROBOT AI SYSTEM
    </footer>
  </div>
);

}


const styles = {
  container: {
    minHeight: "100vh",
    background: "#07111F",
    color: "#F4F8FF",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "Arial, sans-serif",
    gap: "26px",
    padding: "32px 20px",
    boxSizing: "border-box",
  },

  header: {
    width: "100%",
    maxWidth: "900px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    flexWrap: "wrap",
    borderBottom: "1px solid #20364D",
    paddingBottom: "22px",
  },

  brand: {
    color: "#35D9FF",
    fontSize: "13px",
    fontWeight: "bold",
    letterSpacing: "4px",
  },

  heading: {
    fontSize: "24px",
    letterSpacing: "1px",
    margin: "8px 0",
  },

  subheading: {
    color: "#71869D",
    fontSize: "11px",
    letterSpacing: "2px",
    margin: 0,
  },

  systemBadge: {
    display: "flex",
    alignItems: "center",
    gap: "9px",
    background: "#10243A",
    border: "1px solid #24415B",
    borderRadius: "30px",
    padding: "11px 15px",
    fontSize: "11px",
    fontWeight: "bold",
    letterSpacing: "1px",
  },

  systemDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    display: "inline-block",
    flexShrink: 0,
    boxShadow: "0 0 10px currentColor",
  },

  section: {
    width: "100%",
    maxWidth: "900px",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "14px",
    gap: "12px",
  },

  sectionNumber: {
    color: "#35D9FF",
    fontSize: "10px",
    letterSpacing: "2px",
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: "19px",
    margin: "6px 0 0",
  },

  liveBadge: {
    color: "#35D9FF",
    border: "1px solid #23617A",
    borderRadius: "20px",
    padding: "7px 12px",
    fontSize: "10px",
    letterSpacing: "1px",
  },

  cameraBox: {
    width: "100%",
    aspectRatio: "16 / 9",
    background: "#02060C",
    border: "1px solid #24415B",
    borderRadius: "16px",
    overflow: "hidden",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)",
  },

  cameraOverlay: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#B8F7FF",
    fontSize: "13px",
  },

  loadingDot: {
    width: "9px",
    height: "9px",
    borderRadius: "50%",
    background: "#35D9FF",
  },

  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginTop: "12px",
    color: "#A9BCD0",
    fontSize: "12px",
  },

  settingsPanel: {
    background: "#10243A",
    border: "1px solid #24415B",
    borderRadius: "16px",
    padding: "8px 22px",
    boxSizing: "border-box",
  },

  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    padding: "19px 0",
  },

  settingInfo: {
    flex: 1,
  },

  settingInfoTitle: {
    color: "#FFFFFF",
  },

  settingInfoText: {
    color: "#8FA5BA",
  },

  settingRowTitle: {
    fontSize: "14px",
    fontWeight: "bold",
  },

  settingDivider: {
    height: "1px",
    background: "#263E55",
  },

  toggleButton: {
    width: "68px",
    minWidth: "68px",
    padding: "10px 12px",
    border: "1px solid #ffffff18",
    borderRadius: "30px",
    color: "white",
    fontWeight: "bold",
    fontSize: "12px",
    cursor: "pointer",
    transition: "0.2s",
  },

  testVoiceButton: {
    marginTop: "14px",
    background: "#087EA4",
    border: "1px solid #35D9FF",
    color: "#FFFFFF",
    padding: "12px 20px",
    borderRadius: "9px",
    fontWeight: "bold",
    letterSpacing: "1px",
    cursor: "pointer",
  },

  statusGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "12px",
  },

  statusCard: {
    background: "#10243A",
    border: "1px solid #24415B",
    borderRadius: "13px",
    padding: "18px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    minWidth: 0,
  },

  cardLabel: {
    color: "#35D9FF",
    fontSize: "10px",
    fontWeight: "bold",
    letterSpacing: "1.5px",
  },

  cardValue: {
    color: "#E8F4FF",
    fontSize: "14px",
    overflowWrap: "anywhere",
  },

  footer: {
    width: "100%",
    maxWidth: "900px",
    borderTop: "1px solid #20364D",
    paddingTop: "18px",
    textAlign: "center",
    color: "#526A82",
    fontSize: "10px",
    letterSpacing: "2px",
  },
};

