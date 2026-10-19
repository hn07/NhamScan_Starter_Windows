# NhamScan — Quét tài liệu nhiều trang trên Windows

Luồng chính: **Mở camera một lần → chụp liên tiếp nhiều tờ (ví dụ 20) → Hoàn tất → Lưu PDF** thành một tệp PDF nhiều trang.

## Tính năng
- Camera mở một lần cho cả phiên chụp; chụp trang không đóng camera.
- Nút **Hoàn tất** dừng camera và quay về danh sách trang.
- Hiển thị số trang, xem trước và chọn từng trang.
- Xoay trang, chọn bộ lọc màu, xóa trang, thêm ảnh từ máy.
- **Lưu PDF** ghép tất cả trang theo đúng thứ tự thành một file.
- Xử lý ảnh trong trình duyệt, không tải ảnh lên máy chủ ứng dụng.

## Chạy trên Windows
1. Tải/giải nén project.
2. Cài Python 3 nếu chưa có.
3. Nhấp đúp `run.bat`.
4. Trình duyệt mở `http://localhost:8080`.
5. Bấm **Mở camera**, cấp quyền camera, chụp các trang liên tiếp.
6. Bấm **Hoàn tất**, kiểm tra danh sách trang, rồi bấm **Lưu PDF**.

Hoặc chạy trong Terminal tại thư mục project:
```bash
python -m http.server 8080
```

## Lưu ý
- Camera cần `localhost` hoặc HTTPS; không mở trực tiếp bằng `file://`.
- jsPDF được tải từ CDN nên cần Internet khi xuất PDF.
- Bản khởi đầu chưa có tự động dò mép giấy/chỉnh phối cảnh nâng cao.
