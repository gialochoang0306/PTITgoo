import type { RideStatus } from "../types";

export const rideLabels: Record<RideStatus, string> = {
  PENDING: "Chờ xử lý",
  SEARCHING: "Đang tìm tài xế",
  DRIVER_ASSIGNED: "Đã gán tài xế",
  DRIVER_ARRIVING: "Tài xế đang đến",
  DRIVER_ARRIVED: "Đã đến điểm đón",
  VEHICLE_HANDOVER: "Đã bàn giao xe",
  IN_PROGRESS: "Đang di chuyển",
  ARRIVED_DESTINATION: "Đã đến điểm trả",
  VEHICLE_RETURNED: "Đã trả xe",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
  NO_DRIVER_FOUND: "Chưa tìm được tài xế",
  EXPIRED: "Hết hạn",
};
export const activeStatuses = Object.keys(rideLabels)
  .filter(
    (s) =>
      !["COMPLETED", "CANCELLED", "NO_DRIVER_FOUND", "EXPIRED"].includes(s),
  )
  .join(",");
export const cancellableStatuses = new Set([
  "PENDING",
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "VEHICLE_HANDOVER",
  "NO_DRIVER_FOUND",
]);
export const assignableStatuses = new Set([
  "NO_DRIVER_FOUND",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
]);
export const labels: Record<string, string> = {
  ...rideLabels,
  ACTIVE: "Hoạt động",
  INACTIVE: "Tạm ngưng",
  BANNED: "Bị khóa",
  ONLINE: "Sẵn sàng",
  OFFLINE: "Ngoại tuyến",
  BUSY: "Đang bận",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  SUSPENDED: "Tạm đình chỉ",
  CAR: "Ô tô",
  MOTORCYCLE: "Xe máy",
  INSTANT: "Đặt ngay",
  SCHEDULED: "Đặt trước",
  CUSTOMER: "Khách hàng",
  DRIVER: "Tài xế",
  ADMIN: "Quản trị viên",
  SYSTEM: "Hệ thống",
  PICKUP: "Nhận xe",
  DROPOFF: "Trả xe",
  AUTOMATIC: "Số tự động",
  AUTO: "Số tự động",
  MANUAL: "Số sàn",
  CASH: "Tiền mặt",
  WALLET: "Ví",
  PAID: "Đã thanh toán",
  FRONT: "Phía trước",
  BACK: "Phía sau",
  LEFT: "Bên trái",
  RIGHT: "Bên phải",
  DASHBOARD: "Bảng điều khiển",
  CCCD: "Căn cước công dân",
  CCCD_BACK: "Mặt sau CCCD",
  SELFIE: "Ảnh chân dung",
  DRIVER_LICENSE: "Giấy phép lái xe",
  DRIVER_LICENSE_BACK: "Mặt sau giấy phép lái xe",
};
export const text = (value: unknown) =>
  value === null || value === undefined || value === "" ? "—" : String(value);
export const label = (value: string | null | undefined) =>
  value ? (labels[value] ?? value) : "—";
export const money = (value: number | null | undefined) =>
  value == null
    ? "—"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
        maximumFractionDigits: 0,
      }).format(value);
export function date(value: string | null | undefined) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.split("-").reverse().join("/");
  // Backend LocalDateTime has no offset and represents a local wall-clock value.
  if (!/[Zz]|[+-]\d{2}:\d{2}$/.test(value))
    return value
      .slice(0, 16)
      .replace("T", " ")
      .replace(/^(\d{4})-(\d{2})-(\d{2})/, "$3/$2/$1");
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
        timeStyle: "short",
      }).format(parsed);
}
export function safeImage(url: string | null | undefined) {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}
export function pricingError(v: {
  nightStart?: string | null;
  nightEnd?: string | null;
  nightSurchargePercent: number;
}) {
  if (!!v.nightStart !== !!v.nightEnd)
    return "Giờ bắt đầu và kết thúc phải đi cùng nhau.";
  if (v.nightSurchargePercent > 0 && !v.nightStart)
    return "Phụ thu đêm cần giờ bắt đầu và kết thúc.";
  if (v.nightStart && v.nightStart === v.nightEnd)
    return "Giờ bắt đầu và kết thúc phải khác nhau.";
  return null;
}
