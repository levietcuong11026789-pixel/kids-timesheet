# ⭐ Bảng Chấm Công Bé Yêu

Ứng dụng web real-time giúp bé kiếm tiền thưởng qua học tập và làm việc nhà.

---

## 🚀 Hướng dẫn cài đặt (5 bước)

### Bước 1 — Tạo Firebase project (miễn phí)

1. Vào **https://console.firebase.google.com/**
2. Nhấn **"Add project"** → đặt tên (vd: `cham-cong-be`)
3. Tắt Google Analytics (không cần) → **Create project**

### Bước 2 — Thêm Realtime Database

1. Trong sidebar → **Build** → **Realtime Database**
2. Nhấn **"Create Database"**
3. Chọn vị trí (chọn Singapore - gần nhất)
4. Chọn **"Start in test mode"** → **Enable**

### Bước 3 — Lấy Firebase config

1. Vào ⚙️ **Project Settings** → tab **General**
2. Kéo xuống **"Your apps"** → nhấn **`</>`** (Web app)
3. Đặt tên app → nhấn **Register app**
4. **Copy toàn bộ đoạn `firebaseConfig = { ... }`**

### Bước 4 — Điền config vào file

Mở file **`firebase-config.js`** và thay thế các giá trị `REPLACE_WITH_...` bằng thông tin đã copy:

```js
const firebaseConfig = {
  apiKey:            "AIzaSy...",
  authDomain:        "cham-cong-be.firebaseapp.com",
  databaseURL:       "https://cham-cong-be-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "cham-cong-be",
  storageBucket:     "cham-cong-be.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

### Bước 5 — Deploy lên GitHub Pages (link vĩnh viễn)

1. Tạo tài khoản **https://github.com** (nếu chưa có)
2. Tạo repo mới tên `kids-timesheet` (chọn Public)
3. Upload 4 file: `index.html`, `style.css`, `app.js`, `firebase-config.js`
4. Vào **Settings** → **Pages** → chọn branch **main** → **Save**
5. Link sẽ là: `https://[username].github.io/kids-timesheet/`

---

## 💰 Bảng thưởng

| Việc | Tiền |
|------|------|
| ✏️ Học 4 môn (Anh + Toán + Viết + Từ mới) | +10,000 đ |
| 🧹 Quét nhà | +1,000 đ |
| 🫧 Lau nhà | +2,000 đ |
| 🛏️ Dọn phòng | +2,000 đ |
| 📖 Đọc sách (5 trang đầu) | +3,000 đ |
| 📖 Mỗi trang đọc thêm | +500 đ |
| 🏆 Điểm 10 | +5,000 đ |
| 🏆 Điểm 9 | +3,000 đ |
| 🏆 Điểm 8 | +1,000 đ |
| 🏆 Điểm 7 | −3,000 đ |
| 🏆 Điểm 6 | −5,000 đ |

---

## 🔐 Mã PIN mặc định

PIN mặc định: **`1234`**

Anh có thể đổi trong **Chế độ Ba/Mẹ → Cài đặt → Đổi PIN**

---

## 📱 Cách dùng

**Bé:**
1. Mở link trên điện thoại
2. Nhấn vào việc đã làm → "Gửi Ba/Mẹ duyệt"
3. Thấy số tiền tăng lên sau khi được duyệt 🎉

**Ba/Mẹ:**
1. Nhấn nút **"👨‍👩‍👧 Ba/Mẹ"** góc trên phải
2. Nhập PIN (mặc định: 1234)
3. Nhấn ✅ để duyệt, ❌ để từ chối
4. Xem báo cáo ngày/tháng
