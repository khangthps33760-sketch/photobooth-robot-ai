
import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 3002;

// Khởi tạo WebSocket Server
const wss = new WebSocketServer({
  host: "0.0.0.0",
  port: PORT
});

console.log("----------------------------------");
console.log("   PHOTOBOOTH ROBOT AI SERVER");
console.log("----------------------------------");
console.log(`Server đang chạy tại port ${PORT}`);

// Khi có thiết bị kết nối
wss.on("connection", (socket) => {
  console.log("Một thiết bị vừa kết nối!");

  socket.send(JSON.stringify({
    type: "connected",
    message: "Robot Server connected!"
  }));

  // Nhận tín hiệu từ Camera AI hoặc Photobooth
  socket.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());

      console.log("Nhận tín hiệu:", message);

      // Chuyển tín hiệu đến tất cả thiết bị khác
      const payload = JSON.stringify(message);

      wss.clients.forEach((client) => {
        if (
          client !== socket &&
          client.readyState === 1
        ) {
          client.send(payload);
        }
      });

    } catch (error) {
      console.error("Lỗi xử lý dữ liệu:", error.message);
    }
  });

  socket.on("close", () => {
    console.log("Một thiết bị đã ngắt kết nối!");
  });

  socket.on("error", (error) => {
    console.error("WebSocket error:", error.message);
  });
});

wss.on("error", (error) => {
  console.error("Server error:", error.message);
});
