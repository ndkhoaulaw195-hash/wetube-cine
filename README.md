# wetube ciné mini — Rạp Chiếu Phim Ảo 10 Ghế VIP (Clone choigivui.com)

Ứng dụng web xem video YouTube, nghe nhạc, bình chọn và trò chuyện cùng nhau trong không gian rạp chiếu phim 3D ảo. Được thiết kế tối ưu và thu nhỏ cho nhóm thân mật **khoảng 10 người xem**, giữ trọn vẹn 100% trải nghiệm và phong cách độc đáo của [choigivui.com](https://choigivui.com/).

---

## 🌟 1. Tính Năng Chi Tiết (Y Chang Choigivui.com)

### 🎬 Không Gian Rạp Chiếu Phim 3D (Three.js)
- **10 Ghế VIP Sang Trọng**: Thiết kế 2 hàng ghế bọc nhung/da cao cấp với bục nâng bậc cho hàng sau:
  - **Hàng A (Trước)**: Ghế `A01`, `A02`, `A03` (Chính diện), `A04`, `A05`.
  - **Hàng B (Sau - VIP)**: Ghế `B01`, `B02`, `B03` (Chính diện), `B04`, `B05`.
- **Tương tác ghế 3D**: Rê chuột (hover) để làm sáng ghế, bấm trực tiếp vào ghế trong không gian 3D để ngồi vào hoặc đổi chỗ.
- **Bot bạn bè đồng hành**: Khi phòng chưa đông, các nhân vật bot vui nhộn (*Mèo Béo, Bé Báo, Khứa Này*) sẽ ngồi xem cùng và tự động nhường ghế ngay khi người thật chọn!
- **4 Góc Quay Camera Điện Ảnh**:
  - `🌐 Toàn cảnh`: Góc máy toàn cảnh bao quát cả khán phòng và màn chiếu.
  - `💺 Ghế của tôi`: Góc nhìn thực tế từ đúng vị trí chiếc ghế bạn đang ngồi hướng thẳng lên màn chiếu.
  - `🎬 Màn hình`: Phóng to toàn màn hình rạp chiếu như trải nghiệm IMAX.
  - `👥 Khán giả`: Đặt góc máy từ sân khấu quay lại nhìn toàn bộ bạn bè trong phòng.
- **Sân Khấu Quẩy (Stage Dance)**: Nút **"Lên sân khấu"** cho phép nhân vật bước lên bục phía trước màn hình để nhảy múa quẩy theo điệu nhạc.
- **Quả Cầu Disco & Đèn Tiệc Laser**: Bật/tắt hiệu ứng tiệc tùng với quả cầu gương xoay trên trần, chùm đèn spotlight đa sắc và tia laser quét quanh rạp.

---

### 🎵 Đồng Bộ Video YouTube Thời Gian Thực (Sync Player)
- **Đồng bộ chuẩn xác theo Millisecond**: Sử dụng thuật toán đồng bộ Clock Offset giữa Server và Client. Dù người xem vào sau hay mạng lag, video sẽ tự động nhảy đến đúng giây hiện tại của phòng chiếu.
- **Dán Link Thêm Vào Hàng Chờ (Video Queue)**: Hỗ trợ mọi định dạng link YouTube (`youtube.com/watch?v=...`, `youtu.be/...`, ID video). Tự động lấy tiêu đề, ảnh thumbnail không cần API Key.
- **Bình Chọn Bỏ Qua Dân Chủ (Vote Skip)**: Bấm "Bỏ qua" để biểu quyết. Khi đủ $\ge 50\%$ người trong phòng đồng ý, hệ thống tự động chuyển ngay sang bài tiếp theo.
- **Chuyển bài tức thì**: Người đề xuất video hoặc chủ phòng có quyền chuyển bài ngay lập tức.
- **Xử lý chặn âm thanh tự động**: Nếu trình duyệt chặn phát âm thanh tự động (Autoplay Policy), giao diện hiện thanh thông báo 1 chạm để bật tiếng rạp ngay lập tức.

---

### 💬 Trò Chuyện & Hiệu Ứng Cảm Xúc Thời Gian Thực
- **Bong Bóng Thoại 3D (Speech Bubbles)**: Khi bất kỳ ai gửi tin nhắn trong khung chat, một bong bóng thoại hoạt hình sẽ hiện nổi trực tiếp trên đầu nhân vật 3D của người đó trong 5 giây.
- **Bắn Cảm Xúc Bay Lên 3D (Floating Emojis)**: Thanh dock biểu tượng cảm xúc (`❤️`, `🔥`, `👏`, `🍿`, `😂`, `🎉`, `🎵`). Khi bấm, biểu tượng sẽ bay lên từ ghế ngồi của bạn vào không trung kèm hiệu ứng âm thanh sống động (Web Audio API).
- **Chiếu Ảnh Lên Màn Rạp (Screen Photo Projection)**: Cho phép khán giả chọn ảnh từ điện thoại/máy tính hoặc dán URL kèm lời nhắn yêu thương để phóng to lên toàn màn hình rạp chiếu trong 12 giây với đồng hồ đếm ngược.

---

### 👤 Tùy Chỉnh Nhân Vật & Tủ Đồ
- Đổi tên hiển thị trong rạp.
- Chọn màu áo nhân vật 3D (Xanh Navy, Xanh Ngọc, Vàng Hổ Phách, Hồng Tươi, Tím Thạch Anh, Đỏ Ruby, Xanh Cyan, Trắng Sáng).
- Chọn danh hiệu VIP (*Khán Giả VIP, Chúa Hề, Trùm Bắp, Bé Báo, Đạo Diễn Mõm, Khứa Này*).

---

## 🛠️ 2. Cấu Trúc Mã Nguồn

```text
REA/
├── package.json              # Khai báo thông tin dự án & dependencies (express, ws)
├── server.js                 # Máy chủ Node.js + WebSocket Server điều phối phòng rạp
├── public/
│   ├── index.html            # Giao diện chính rạp phim (HUD, Modals, 3D Canvas)
│   ├── css/
│   │   └── style.css         # Phong cách rạp chiếu phim ban đêm (#111211, Neon Gold)
│   ├── js/
│   │   ├── cinema.js         # Khởi tạo không gian 3D Three.js, 10 ghế, sân khấu, disco ball
│   │   ├── player.js         # Trình phát YouTube IFrame API và thuật toán đồng bộ
│   │   └── app.js            # Điều phối WebSocket, Chat, Cảm xúc, Modals, Âm thanh
│   └── vendor/
│       ├── three.min.js      # Thư viện Three.js r128 (Local Offline)
│       ├── CSS3DRenderer.js  # Bộ kết xuất CSS3D để gắn màn hình YouTube vào không gian 3D
│       └── lucide.min.js     # Thư viện icon Lucide
└── README.md                 # Hướng dẫn chi tiết
```

---

## 🚀 3. Hướng Dẫn Cài Đặt & Chạy

### Cách 1: Chạy Trên Máy Tính (Localhost)

1. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```

2. Khởi động máy chủ:
   ```bash
   npm start
   ```

3. Mở trình duyệt và truy cập:
   ```text
   http://localhost:3000
   ```

*(Bạn có thể mở nhiều tab ẩn danh hoặc các thiết bị khác nhau trên cùng mạng WiFi để thử nghiệm tính năng đồng bộ và chọn ghế cùng lúc).*

---

### Cách 2: Triển Khai Miễn Phí Lên Internet (Cho bạn bè cùng vào xem)

Bạn có thể đưa trang web lên các dịch vụ hosting miễn phí như **Render**, **Railway**, hoặc **Fly.io** chỉ trong 2 phút:

- **Render.com**:
  - Tạo mới một **Web Service**.
  - Liên kết với Repository GitHub chứa mã nguồn này.
  - Build Command: `npm install`
  - Start Command: `node server.js`
  - Environment Variable: `PORT=3000` (hoặc để mặc định).

---

## 💡 4. Tùy Biến Thêm Theo Ý Muốn
- **Đổi danh sách bot**: Chỉnh sửa mảng `INITIAL_BOTS` trong file `server.js`.
- **Đổi video mặc định**: Chỉnh sửa trường `currentVideo` trong `server.js`.
- **Đổi màu sắc rạp**: Chỉnh sửa mã màu trong `public/css/style.css` và `public/js/cinema.js`.
