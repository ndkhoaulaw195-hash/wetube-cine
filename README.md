# 🎬 wetube ciné — Rạp Chiếu Phim Ảo 3D Thời Gian Thực (Three.js & Node.js WebSocket)

Dự án rạp chiếu phim ảo tương tác đa người dùng trực tuyến. Khán giả có thể vào phòng chiếu, chọn vị trí ngồi trong khán phòng 3D (ghế VIP bọc nhung đỏ hoặc ghế đôi Sweetbox lãng mạn), cùng xem video đồng bộ mili-giây, bật mic nói chuyện, trò chuyện trực tiếp, bình chọn và tặng quà cho chủ phòng.

* 🌐 **Trang web đang chạy trực tiếp trên Render**: [https://wetube-cine-bahv.onrender.com](https://wetube-cine-bahv.onrender.com)
* 📦 **Kho lưu trữ GitHub**: [https://github.com/ndkhoaulaw195-hash/wetube-cine](https://github.com/ndkhoaulaw195-hash/wetube-cine)

---

## 📂 Cấu Trúc Thư Mục Dự Án (Chỉ Gồm Các File Của Web Này)

```
Wetube-Cine/
├── server.js              # Máy chủ backend Node.js, Express & WebSocket real-time
├── data/
│   └── db.json            # Cơ sở dữ liệu JSON (Tài khoản, Kho phim, Danh mục, Thống kê)
├── public/                # Toàn bộ giao diện frontend của rạp chiếu phim
│   ├── index.html         # Khung HTML (Rạp 3D, Sảnh chờ, các cửa sổ modal)
│   ├── css/
│   │   └── style.css      # Toàn bộ style giao diện, ánh sáng rạp phim, responsive
│   ├── js/
│   │   ├── cinema.js      # Không gian 3D WebGL (Three.js): 16 ghế, loa Dolby Atmos, camera
│   │   ├── player.js      # Trình phát video đa nguồn (YouTube, MP4, HLS m3u8, Embed Proxy)
│   │   ├── app.js         # Quản lý WebSocket client, UI, tương tác ghế đôi, tài khoản
│   │   └── avatars.js     # Thuật toán vẽ nhân vật Chibi Pixel Art 2D Canvas
│   ├── vendor/            # Thư viện lõi offline (Three.js, CSS3DRenderer, Hls.js, Lucide)
│   ├── memes/             # Ảnh meme vui nhộn
│   └── stickers/          # Nhãn dán biểu cảm trong chat
├── scripts/
│   └── deploy.sh          # Script tự động đẩy code lên GitHub & kích hoạt Render deploy
├── render.yaml            # Cấu hình Render Cloud Blueprint
├── package.json           # Khai báo dependencies & lệnh npm
└── package-lock.json
```

---

## 🛠️ Hướng Dẫn Cài Đặt & Chạy Cục Bộ (Local)

1. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```

2. Khởi chạy máy chủ:
   ```bash
   npm start
   ```
   Hoặc:
   ```bash
   node server.js
   ```

3. Mở trình duyệt và truy cập:
   ```
   http://localhost:3000
   ```

---

## 🚀 Hướng Dẫn Cập Nhật & Deploy Lên Render

Mỗi khi chỉnh sửa mã nguồn xong, chỉ cần chạy lệnh:
```bash
npm run deploy
```
Script sẽ tự động:
1. `git add -A` và `git commit` các thay đổi.
2. `git push origin main` lên GitHub.
3. Kích hoạt Render Deploy Webhook để cập nhật website trên Render tự động.
