/**
 * Có nên tự đặt con trỏ vào ô nhập khi mở popup không: chỉ trên máy có chuột/bàn di (máy tính).
 * Trên điện thoại (nhất là iOS), tự focus khi popup vừa mở sẽ bật bàn phím, Safari phóng to/kéo lệch
 * trang để đưa ô vào tầm nhìn rồi không trả lại — popup "Thêm giao dịch" bị tràn khỏi màn hình.
 */
export function canAutoFocus(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}
