# Hướng dẫn Deploy lên Google Cloud Run (WP-MCP Service)

Để cập nhật phiên bản mới nhất cho MCP Server lên Google Cloud Run trơn tru và nhanh nhất, bạn chỉ cần thực hiện các bước đơn giản sau:

## 1. Di chuyển vào thư mục chứa server
Trên terminal (PowerShell, Command Prompt, v.v.), đảm bảo bạn đang đứng đúng thư mục mã nguồn chứa server (thư mục `WP-MCP_Service`):

```bash
cd WP-MCP_Service
```
*(Nếu bạn đã ở sẵn trong thư mục `WP-MCP_Service` thì có thể bỏ qua bước này).*

## 2. Chạy lệnh Deploy
Chỉ cần chạy 1 câu lệnh duy nhất dưới đây. Hệ thống sẽ tự động build lại image bằng Dockerfile và cập nhật nó lên Cloud Run của bạn:

```bash
gcloud run deploy wp-mcp-service --source . --project vanced-media-441614 --region asia-southeast1 --account caocv.work@gmail.com
```

**Giải thích lệnh:**
- `wp-mcp-service`: Tên dịch vụ trên Cloud Run (quy định phải viết thường và dùng dấu gạch ngang).
- `--source .`: Build mã nguồn từ thư mục hiện tại.
- `--project vanced-media-441614`: Project ID chứa dịch vụ (Chung project với LLM Agent).
- `--region asia-southeast1`: Khu vực host server (ở đây là Singapore).
- `--account caocv.work@gmail.com`: Tài khoản được sử dụng để thực thi lệnh.

---
⏳ **Đợi vài phút**, khi hệ thống hiển thị dòng `Service [wp-mcp-service] revision... has been deployed...` kèm với đường link URL tức là phiên bản source code của bạn đã được đẩy lên thành công!

## 3. Lưu ý: Cấu hình Biến môi trường (Chỉ cần làm ở lần Deploy đầu tiên)
Bởi vì file `.env` đã được chặn không cho upload lên bằng `.dockerignore` (để bảo mật mật khẩu), nên sau khi deploy thành công lần đầu tiên, bạn cần nạp biến môi trường cho Cloud Run:

1. Truy cập vào giao diện **Google Cloud Console** > **Cloud Run**.
2. Chọn service `wp-mcp-service`.
3. Bấm **Edit & Deploy New Revision**.
4. Chuyển sang tab **Variables & Secrets**, kéo xuống phần **Environment variables**.
5. Bấm **ADD VARIABLE** và thêm đủ 3 biến giống hệt nội dung file `.env` ở máy bạn:
   - `WP_BASE_URL`
   - `WP_APP_USER`
   - `WP_APP_PASS`
6. Bấm **Deploy** để server khởi động lại và nhận cấu hình.

*(Từ các lần cập nhật code tiếp theo, bạn chỉ cần chạy lệnh ở Bước 2, Cloud Run sẽ tự động giữ nguyên các biến môi trường này).*
