import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App as AntApp, ConfigProvider } from "antd";
import viVN from "antd/locale/vi_VN";
import { AdminApp } from "../App";
import { configureAuth } from "../lib/api";
import {
  profile,
  ride as rideFixture,
  driver as driverFixture,
  customer as customerFixture,
  pricing as pricingFixture,
  page,
  ok,
  fail,
} from "./fixtures";

vi.mock("../auth", () => ({
  useAuth: () => ({
    profile,
    loading: false,
    configError: null,
    sessionError: null,
    logout: vi.fn(),
  }),
}));
let ride = structuredClone(rideFixture);
let driver = structuredClone(driverFixture);
let customer = structuredClone(customerFixture);
let pricing = structuredClone(pricingFixture);
let assignmentConflict = false;
let verificationConflict = false;
const writes: {
  path: string;
  method: string;
  body: Record<string, unknown>;
  force: string | null;
}[] = [];
const reads: string[] = [];
function renderPage(path: string) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  render(
    <ConfigProvider locale={viVN} theme={{ token: { motion: false } }}>
      <AntApp>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <AdminApp />
          </MemoryRouter>
        </QueryClientProvider>
      </AntApp>
    </ConfigProvider>,
  );
  return { user: userEvent.setup({ pointerEventsCheck: 0 }), client };
}
beforeEach(() => {
  ride = structuredClone(rideFixture);
  driver = structuredClone(driverFixture);
  customer = structuredClone(customerFixture);
  pricing = structuredClone(pricingFixture);
  writes.length = 0;
  reads.length = 0;
  assignmentConflict = false;
  verificationConflict = false;
  configureAuth(
    async () => "test-token",
    () => {},
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = url.pathname;
      const method = init?.method ?? "GET";
      const body = init?.body
        ? (JSON.parse(String(init.body)) as Record<string, unknown>)
        : {};
      if (method !== "GET")
        writes.push({
          path,
          method,
          body,
          force: url.searchParams.get("force"),
        });
      else reads.push(path + url.search);
      if (path === "/api/admin/rides")
        return ok(
          page(
            [ride],
            url.searchParams.get("status") === "NO_DRIVER_FOUND" ? 9 : 42,
            Number(url.searchParams.get("page") || 0),
            Number(url.searchParams.get("size") || 20),
          ),
        );
      if (path === "/api/admin/rides/11") return ok(ride);
      if (path === "/api/admin/rides/11/chat")
        return ok({
          rideId: 11,
          messages: [
            {
              id: 91,
              senderRole: "CUSTOMER",
              messageType: "TEXT",
              content: "Tôi đang ở điểm đón.",
              attachmentUrl: null,
              createdAt: "2026-10-24T03:00:00Z",
              readAt: null,
            },
          ],
          hasMore: false,
        });
      if (path === "/api/admin/rides/11/cancel") {
        ride.status = "CANCELLED";
        ride.cancelReason = String(body.reason);
        return ok({});
      }
      if (path === "/api/admin/rides/11/assign") {
        if (assignmentConflict)
          return fail(409, "Tài xế đang có lời mời hoặc chuyến khác");
        ride.status = "DRIVER_ASSIGNED";
        ride.driverId = Number(body.driver_id);
        return ok({});
      }
      if (path === "/api/location/nearby-drivers")
        return ok([
          { driverId: 41, distanceKm: 1.25, location: { lat: 21, lng: 105 } },
        ]);
      if (path === "/api/admin/drivers") return ok(page([driver.driver]));
      if (path === "/api/admin/drivers/41") return ok(driver);
      if (path === "/api/admin/drivers/41/verification-status") {
        if (verificationConflict)
          return fail(409, "Chưa duyệt đủ giấy tờ bắt buộc: DRIVER_LICENSE");
        driver.driver.verificationStatus = String(body.status);
        return ok({});
      }
      if (path === "/api/admin/drivers/41/force-offline") {
        driver.driver.status = "OFFLINE";
        return ok({});
      }
      if (path === "/api/admin/driver-skills/61/verify") {
        driver.skills[0].verified = Boolean(body.verified);
        return ok({});
      }
      if (path === "/api/admin/driver-documents")
        return ok(
          page(
            [
              {
                document: driver.documents[0],
                driverName: driver.driver.fullName,
                driverPhone: driver.driver.phoneNumber,
              },
            ],
            8,
          ),
        );
      if (path === "/api/admin/driver-documents/51/review") {
        driver.documents[0].verificationStatus = String(body.status);
        return ok(driver.documents[0]);
      }
      if (path === "/api/admin/customers") return ok(page([customer], 3));
      if (path === "/api/admin/customers/21") return ok(customer);
      if (path === "/api/admin/customers/21/status") {
        customer.status = String(body.status);
        return ok({ id: 21, status: body.status });
      }
      if (path === "/api/admin/customers/21/flag") {
        customer.isFlagged = Boolean(body.flagged);
        return ok({ id: 21, flagged: body.flagged });
      }
      if (path === "/api/admin/customers/21/rides") return ok(page([ride]));
      if (path === "/api/admin/customers/21/wallet-transactions")
        return ok(
          page([
            {
              id: 81,
              rideId: 11,
              amount: -50000,
              type: "PAYMENT",
              status: "COMPLETED",
              walletType: "CUSTOMER",
              balanceAfter: 0,
              description: "Thanh toán chuyến",
              createdAt: "2026-10-24T03:00:00Z",
            },
          ]),
        );
      if (path === "/api/admin/pricing-rules" && method === "GET")
        return ok([pricing]);
      if (path === "/api/admin/pricing-rules" && method === "POST")
        return ok({ ...pricing, ...body });
      if (path === "/api/admin/pricing-rules/71" && method === "PUT") {
        pricing = { ...pricing, ...body };
        return ok(pricing);
      }
      if (path === "/api/admin/pricing-rules/71/activate") {
        pricing.active = true;
        return ok(pricing);
      }
      if (path === "/api/admin/pricing-rules/71/deactivate") {
        if (url.searchParams.get("force") !== "true")
          return fail(409, "Không thể tắt bảng giá active cuối cùng");
        pricing.active = false;
        return ok(pricing);
      }
      throw new Error(`Unhandled ${method} ${path}`);
    }),
  );
});

describe("Admin pages", () => {
  it.each([
    ["/dashboard", "Tổng quan vận hành"],
    ["/rides", "Quản lý chuyến đi"],
    ["/drivers", "Quản lý tài xế"],
    ["/driver-documents", "Duyệt hồ sơ tài xế"],
    ["/customers", "Quản lý khách hàng"],
    ["/pricing-rules", "Quản lý bảng giá"],
  ])("loads %s against the API", async (path, heading) => {
    renderPage(path);
    expect(
      await screen.findByRole("heading", { name: heading }),
    ).toBeInTheDocument();
    await waitFor(() => expect(reads.length).toBeGreaterThan(0));
  });
  it("uses backend totals rather than the number of visible rows", async () => {
    renderPage("/dashboard");
    const activeCard = await screen.findByRole("link", {
      name: /Chuyến đang hoạt động/,
    });
    await waitFor(() =>
      expect(within(activeCard).getByText("42")).toBeInTheDocument(),
    );
    expect(
      within(screen.getByRole("link", { name: /Giấy tờ chờ duyệt/ })).getByText(
        "8",
      ),
    ).toBeInTheDocument();
  });
  it("preserves filters when opening a ride and returning to its list", async () => {
    const { user } = renderPage("/rides?status=NO_DRIVER_FOUND&page=1&size=20");
    await user.click(await screen.findByRole("link", { name: "#11" }));
    expect(
      await screen.findByRole("heading", { name: "Chuyến đi #11" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Quay lại danh sách/ }));
    await screen.findByRole("heading", { name: "Quản lý chuyến đi" });
    expect(
      reads.some(
        (url) =>
          url.includes("page=1") && url.includes("status=NO_DRIVER_FOUND"),
      ),
    ).toBe(true);
  });
  it("requires a cancellation reason and refreshes status after success", async () => {
    const { user } = renderPage("/rides/11");
    await user.click(await screen.findByRole("button", { name: "Hủy chuyến" }));
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(
      await screen.findByText("Nhập lý do hủy chuyến."),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.type(screen.getByLabelText("Lý do hủy"), "Khách yêu cầu hủy");
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    await waitFor(() =>
      expect(
        writes.some(
          (w) =>
            w.path.endsWith("/cancel") && w.body.reason === "Khách yêu cầu hủy",
        ),
      ).toBe(true),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Hủy chuyến" }),
      ).not.toBeInTheDocument(),
    );
  });
  it("assigns a nearby driver and keeps a conflict visible for another choice", async () => {
    assignmentConflict = true;
    const { user } = renderPage("/rides/11");
    await user.click(await screen.findByRole("button", { name: "Gán tài xế" }));
    await user.click(
      await screen.findByRole("radio", { name: "Chọn tài xế 41" }),
    );
    await user.click(screen.getByRole("button", { name: "Xác nhận gán" }));
    await waitFor(() =>
      expect(
        screen.getAllByText("Tài xế đang có lời mời hoặc chuyến khác").length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    assignmentConflict = false;
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Xác nhận gán" }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: "Xác nhận gán" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(writes.filter((w) => w.path.endsWith("/assign"))).toHaveLength(2);
    expect(ride.driverId).toBe(41);
  });
  it("reads ride chat without offering message entry", async () => {
    renderPage("/rides/11?tab=chat");
    expect(await screen.findByText("Tôi đang ở điểm đón.")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("requires a rejection reason for documents", async () => {
    const { user } = renderPage("/driver-documents");
    await user.click(
      await screen.findByRole("button", { name: "Xem và duyệt" }),
    );
    await user.click(await screen.findByRole("button", { name: "Duyệt giấy tờ Căn cước công dân" }));
    const dialog = await screen.findByRole("form", { name: "Duyệt Căn cước công dân · #51" });
    await user.click(within(dialog).getByRole("combobox"));
    await user.click(
      await screen.findByText("Từ chối", {
        selector: ".ant-select-item-option-content",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Lưu kết quả" }));
    expect(
      await screen.findByText("Nhập lý do từ chối giấy tờ."),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.type(screen.getByLabelText("Lý do từ chối"), "Ảnh không rõ");
    await user.click(screen.getByRole("button", { name: "Lưu kết quả" }));
    await waitFor(() =>
      expect(writes[0]?.body).toEqual({
        status: "REJECTED",
        rejection_reason: "Ảnh không rõ",
      }),
    );
  });
  it("shows missing-document errors when approving a driver", async () => {
    verificationConflict = true;
    driver.driver.verificationStatus = "PENDING";
    const { user } = renderPage("/drivers/41");
    await user.click(
      await screen.findByRole("button", { name: "Xem và duyệt hồ sơ" }),
    );
    const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
    await user.click(within(dossier).getByRole("button", { name: "Duyệt tài khoản" }));
    await waitFor(() =>
      expect(
        screen.getAllByText("Chưa duyệt đủ giấy tờ bắt buộc: DRIVER_LICENSE")
          .length,
      ).toBeGreaterThan(0),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("verifies skills in the shared review window and confirms force offline", async () => {
    const { user } = renderPage("/drivers/41?tab=skills");
    await user.click(await screen.findByRole("button", { name: "Xem và duyệt hồ sơ" }));
    const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
    await user.click(await within(dossier).findByRole("button", { name: "Xác minh kỹ năng Ô tô · Số tự động · B2" }));
    await waitFor(() => expect(driver.skills[0].verified).toBe(true));
    await waitFor(() => expect(within(dossier).getByRole("button", { name: "Đóng hồ sơ" })).toBeEnabled());
    await user.click(within(dossier).getByRole("button", { name: "Đóng hồ sơ" }));
    await user.click(screen.getByRole("button", { name: "Ép offline" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Ép offline" }),
    );
    await waitFor(() => expect(driver.driver.status).toBe("OFFLINE"));
  });
  it("updates customer status only after a required reason and permits flagging", async () => {
    const { user } = renderPage("/customers/21");
    await user.click(
      await screen.findByRole("button", { name: "Đổi trạng thái" }),
    );
    await user.click(within(screen.getByRole("dialog")).getByRole("combobox"));
    await user.click(
      await screen.findByText("Bị khóa", {
        selector: ".ant-select-item-option-content",
      }),
    );
    await user.click(screen.getByRole("button", { name: "Xác nhận thay đổi" }));
    expect(
      await screen.findByText("Nhập lý do tạm ngưng hoặc khóa tài khoản."),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.type(screen.getByLabelText("Lý do"), "Vi phạm quy định");
    await user.click(screen.getByRole("button", { name: "Xác nhận thay đổi" }));
    await waitFor(() => expect(customer.status).toBe("BANNED"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Đánh dấu" }));
    await user.click(screen.getByRole("button", { name: "Lưu đánh dấu" }));
    await waitFor(() => expect(customer.isFlagged).toBe(true));
  });
  it("loads wallet history and rejects reversed ride date ranges", async () => {
    const { user } = renderPage("/customers/21?tab=wallet");
    expect(await screen.findByText("Thanh toán chuyến")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Chuyến đi" }));
    await user.type(screen.getByLabelText("Từ ngày"), "2026-10-24");
    await user.type(screen.getByLabelText("Đến ngày"), "2026-10-01");
    expect(
      await screen.findByText("Đến ngày phải cùng ngày hoặc sau Từ ngày."),
    ).toBeInTheDocument();
  });
  it("requires a separate confirmation before forcing the last active price off", async () => {
    const { user } = renderPage("/pricing-rules");
    await user.click(await screen.findByRole("button", { name: "Tắt" }));
    await user.click(
      await screen.findByRole("button", { name: "Tắt bảng giá" }),
    );
    expect(
      await screen.findByRole("button", { name: "Xác nhận tắt cưỡng chế" }),
    ).toBeInTheDocument();
    expect(writes.at(-1)?.force).toBe("false");
    await user.click(
      screen.getByRole("button", { name: "Xác nhận tắt cưỡng chế" }),
    );
    await waitFor(() => expect(pricing.active).toBe(false));
    expect(writes.at(-1)?.force).toBe("true");
  });
  it("validates night surcharge before sending an updated price", async () => {
    const { user } = renderPage("/pricing-rules");
    await user.click(await screen.findByRole("button", { name: "Sửa" }));
    await user.clear(screen.getByLabelText("Kết thúc phụ thu đêm"));
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    expect(
      await screen.findByText("Giờ bắt đầu và kết thúc phải đi cùng nhau."),
    ).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("creates an inactive price using integer amounts and backend vehicle_type", async () => {
    const { user } = renderPage("/pricing-rules");
    await user.click(
      await screen.findByRole("button", { name: "Tạo bảng giá" }),
    );
    const dialog = within(screen.getByRole("dialog"));
    for (const name of [
      "Giá cơ bản (VND)",
      "Giá mỗi km (VND)",
      "Giá mỗi phút chờ (VND)",
      "Giá tối thiểu (VND)",
    ])
      await user.type(dialog.getByLabelText(name), "10000");
    await user.click(dialog.getByRole("button", { name: "Tạo bảng giá" }));
    await waitFor(() =>
      expect(
        writes.some(
          (w) => w.path === "/api/admin/pricing-rules" && w.method === "POST",
        ),
      ).toBe(true),
    );
    expect(writes.at(-1)?.body).toMatchObject({
      vehicle_type: "CAR",
      active: false,
      baseFare: 10000,
      perKm: 10000,
      perMinuteWaiting: 10000,
      minFare: 10000,
      nightStart: null,
      nightEnd: null,
    });
  });
  it("edits price fees and confirms switching the active price", async () => {
    pricing.active = false;
    const { user } = renderPage("/pricing-rules");
    await user.click(await screen.findByRole("button", { name: "Sửa" }));
    await user.clear(screen.getByLabelText("Giá mỗi km (VND)"));
    await user.type(screen.getByLabelText("Giá mỗi km (VND)"), "25000");
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(pricing.perKm).toBe(25000));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(writes.at(-1)?.body).not.toHaveProperty("vehicle_type");
    await user.click(screen.getByRole("button", { name: "Kích hoạt" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.click(dialog.getByRole("button", { name: "Kích hoạt" }));
    await waitFor(() => expect(pricing.active).toBe(true));
  });
  it("falls back to driver search when pickup coordinates are unavailable", async () => {
    ride.pickup = { lat: null, lng: null };
    const { user } = renderPage("/rides/11");
    await user.click(await screen.findByRole("button", { name: "Gán tài xế" }));
    expect(
      await screen.findByText(
        "Chuyến chưa có tọa độ điểm đón. Hãy tìm theo tên hoặc số điện thoại.",
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("radio", { name: "Chọn tài xế 41" }),
    ).toBeEnabled();
    expect(
      reads.some((r) => r.startsWith("/api/location/nearby-drivers")),
    ).toBe(false);
  });
  it("keeps failed dashboard counts unknown instead of displaying false zeros", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderPage("/dashboard");
    expect(
      await screen.findByText(
        "Một số số liệu chưa tải được. Nhấn Làm mới để thử lại.",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("link", { name: /Chuyến đang hoạt động/ }),
      ).getByText("—"),
    ).toBeInTheDocument();
  });
});
