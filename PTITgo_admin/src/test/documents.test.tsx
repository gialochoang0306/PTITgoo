import { beforeEach, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App, ConfigProvider } from "antd";
import { Documents } from "../pages/Drivers";
import { api } from "../lib/api";
import { driver as fixture, page } from "./fixtures";
import type { DriverDetail, DocumentQueue } from "../types";

vi.mock("../lib/api", async importOriginal => {
  const original = await importOriginal<typeof import("../lib/api")>();
  return { ...original, api: { ...original.api, documents: vi.fn(), drivers: vi.fn(), driver: vi.fn(), review: vi.fn(), verifyDriver: vi.fn(), verifySkill: vi.fn() } };
});

let driver: DriverDetail;
let rows: DocumentQueue[];
let failDetail = false;
let failSecondPage = false;

beforeEach(() => {
  failDetail = false;
  failSecondPage = false;
  driver = structuredClone(fixture);
  driver.driver.verificationStatus = "PENDING";
  driver.documents = ["CCCD", "CCCD_BACK", "SELFIE", "DRIVER_LICENSE", "DRIVER_LICENSE_BACK"].map((documentType, index) => ({
    ...fixture.documents[0], id: 51 + index, documentType,
  }));
  rows = driver.documents.map(document => ({ document, driverName: driver.driver.fullName, driverPhone: driver.driver.phoneNumber }));
  vi.mocked(api.drivers).mockResolvedValue(page([]));
  vi.mocked(api.documents).mockImplementation(async params => {
    const index = Number(params?.page ?? 0);
    if (failSecondPage && index === 1) throw new Error("Không tải được trang giấy tờ tiếp theo");
    const filtered = rows.filter(row => row.document.verificationStatus === params?.status);
    // A driver's documents deliberately span multiple server pages.
    return page(filtered.slice(index * 2, (index + 1) * 2), filtered.length, index, 2);
  });
  vi.mocked(api.driver).mockImplementation(async () => {
    if (failDetail) throw new Error("Không tải được hồ sơ tài xế");
    return structuredClone(driver);
  });
  vi.mocked(api.review).mockImplementation(async (id, status, reason) => {
    const doc = driver.documents.find(document => document.id === id)!;
    doc.verificationStatus = status;
    doc.rejectionReason = reason ?? null;
    return doc;
  });
  vi.mocked(api.verifyDriver).mockImplementation(async (_id, status) => {
    const approved = new Set(driver.documents.filter(doc => doc.isCurrent && doc.verificationStatus === "APPROVED").map(doc => doc.documentType));
    if (status === "APPROVED" && (!approved.has("CCCD") || !approved.has("DRIVER_LICENSE"))) {
      throw new Error("Chưa duyệt đủ giấy tờ bắt buộc: CCCD, DRIVER_LICENSE");
    }
    driver.driver.verificationStatus = status;
    return {};
  });
  vi.mocked(api.verifySkill).mockImplementation(async (id, verified) => {
    driver.skills.find(skill => skill.id === id)!.verified = verified;
    return {};
  });
});

function renderDocuments(path = "/driver-documents?status=PENDING") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<ConfigProvider theme={{ token: { motion: false } }}><App><QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Documents /></MemoryRouter></QueryClientProvider></App></ConfigProvider>);
  return userEvent.setup({ pointerEventsCheck: 0 });
}

it("groups all five documents across server pages into one driver application", async () => {
  renderDocuments();
  expect(await screen.findAllByRole("button", { name: "Xem và duyệt" })).toHaveLength(1);
  expect(screen.getByText("5 giấy tờ")).toBeInTheDocument();
  expect(screen.getByText("1 kết quả")).toBeInTheDocument();
  expect(api.documents).toHaveBeenCalledTimes(3);
});

it("keeps drivers with the same name separate and paginates by drivers", async () => {
  rows = Array.from({ length: 21 }, (_, index) => ({
    ...rows[0], document: { ...rows[0].document, driverId: index + 1, id: index + 101 },
  }));
  const user = renderDocuments();
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Xem và duyệt" })).toHaveLength(20));
  expect(screen.getByText("21 kết quả")).toBeInTheDocument();
  await user.click(screen.getByTitle("Next Page"));
  await waitFor(() => expect(screen.getAllByRole("button", { name: "Xem và duyệt" })).toHaveLength(1));
  expect(screen.getByRole("link", { name: driver.driver.fullName! })).toHaveAttribute("href", "/drivers/21");
});

it("opens the whole current dossier and reviews only the selected document", async () => {
  driver.documents[1].verificationStatus = "APPROVED";
  driver.documents.push({ ...driver.documents[0], id: 99, isCurrent: false, documentNumber: "OLD-DOCUMENT" });
  const user = renderDocuments();
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  expect(await within(dossier).findAllByRole("button", { name: /Duyệt giấy tờ/ })).toHaveLength(5);
  expect(within(dossier).getByText("Mặt sau CCCD")).toBeInTheDocument();
  expect(within(dossier).getByText("Ảnh chân dung")).toBeInTheDocument();
  expect(within(dossier).queryByText("OLD-DOCUMENT")).not.toBeInTheDocument();
  await user.click(within(dossier).getByRole("button", { name: "Duyệt giấy tờ Căn cước công dân" }));
  const review = await within(dossier).findByRole("form", { name: "Duyệt Căn cước công dân · #51" });
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  await user.click(within(review).getByRole("button", { name: "Lưu kết quả" }));
  await waitFor(() => expect(api.review).toHaveBeenCalledExactlyOnceWith(51, "APPROVED", undefined));
  await waitFor(() => expect(within(dossier).queryByRole("form", { name: "Duyệt Căn cước công dân · #51" })).not.toBeInTheDocument());
  expect(screen.getByRole("dialog", { name: /Duyệt hồ sơ tài xế/ })).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText("3 giấy tờ")).toBeInTheDocument());
  expect(driver.documents[2].verificationStatus).toBe("PENDING");
  expect(api.verifyDriver).not.toHaveBeenCalled();
});

it("reports a failed later page instead of showing a partial application count", async () => {
  failSecondPage = true;
  renderDocuments();
  expect(await screen.findByText("Không tải được trang giấy tờ tiếp theo")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem và duyệt" })).not.toBeInTheDocument();
});

it("retries a failed dossier read without approving any document", async () => {
  failDetail = true;
  const user = renderDocuments();
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  const dossier = screen.getByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  expect(await within(dossier).findByText("Không tải được hồ sơ tài xế")).toBeInTheDocument();
  failDetail = false;
  await user.click(within(dossier).getByRole("button", { name: "Thử lại" }));
  expect(await within(dossier).findAllByRole("button", { name: /Duyệt giấy tờ/ })).toHaveLength(5);
  expect(api.review).not.toHaveBeenCalled();
});

it("filters driver applications by document status", async () => {
  rows[0].document.verificationStatus = "REJECTED";
  renderDocuments("/driver-documents?status=REJECTED");
  expect(await screen.findByRole("button", { name: "Xem và duyệt" })).toBeInTheDocument();
  expect(screen.getByText("1 giấy tờ")).toBeInTheDocument();
  expect(api.documents).toHaveBeenCalledWith({ status: "REJECTED", page: 0, size: 100 });
});

it("shows the empty state when no driver has documents matching the filter", async () => {
  rows = [];
  renderDocuments();
  expect(await screen.findByText("Không có dữ liệu phù hợp")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Xem và duyệt" })).not.toBeInTheDocument();
});

it("approves the last paper and then the driver account in the same window", async () => {
  driver.documents.slice(1).forEach(doc => { doc.verificationStatus = "APPROVED"; });
  const user = renderDocuments();
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  await user.click(await within(dossier).findByRole("button", { name: "Duyệt giấy tờ Căn cước công dân" }));
  const paper = within(dossier).getByRole("form", { name: "Duyệt Căn cước công dân · #51" });
  await user.click(within(paper).getByRole("button", { name: "Lưu kết quả" }));
  await waitFor(() => expect(driver.documents[0].verificationStatus).toBe("APPROVED"));
  const account = within(dossier).getByRole("region", { name: "Quyết định tài khoản" });
  await waitFor(() => expect(within(account).getByRole("button", { name: "Duyệt tài khoản" })).toBeEnabled());
  expect(api.verifyDriver).not.toHaveBeenCalled();
  await user.click(within(account).getByRole("button", { name: "Duyệt tài khoản" }));
  await waitFor(() => expect(api.verifyDriver).toHaveBeenCalledExactlyOnceWith(41, "APPROVED", undefined));
  await waitFor(() => expect(within(account).getByRole("status", { name: "Trạng thái tài khoản" })).toHaveTextContent("Đã duyệt"));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(within(dossier).queryByRole("link", { name: "Mở hồ sơ tài xế" })).not.toBeInTheDocument();
});

it("keeps backend account-approval errors beside the papers in the same window", async () => {
  const user = renderDocuments();
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  const account = await within(dossier).findByRole("region", { name: "Quyết định tài khoản" });
  await user.click(within(account).getByRole("button", { name: "Duyệt tài khoản" }));
  expect(await within(account).findByText("Chưa duyệt đủ giấy tờ bắt buộc: CCCD, DRIVER_LICENSE")).toBeInTheDocument();
  expect(driver.driver.verificationStatus).toBe("PENDING");
  expect(within(dossier).getAllByRole("button", { name: /Duyệt giấy tờ/ })).toHaveLength(5);
  expect(api.review).not.toHaveBeenCalled();
});

it("verifies a driving skill without leaving the review window or approving the account", async () => {
  const user = renderDocuments();
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  await user.click(await within(dossier).findByRole("button", { name: "Xác minh kỹ năng Ô tô · Số tự động · B2" }));
  await waitFor(() => expect(api.verifySkill).toHaveBeenCalledExactlyOnceWith(61, true));
  expect(await within(dossier).findByText("Đã xác minh")).toBeInTheDocument();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
  expect(api.verifyDriver).not.toHaveBeenCalled();
});

it("blocks duplicate approval and closing while an account decision is being saved", async () => {
  driver.documents.forEach(doc => { doc.verificationStatus = "APPROVED"; });
  let finish!: () => void;
  vi.mocked(api.verifyDriver).mockImplementationOnce(() => new Promise(resolve => {
    finish = () => { driver.driver.verificationStatus = "APPROVED"; resolve({}); };
  }));
  const user = renderDocuments("/driver-documents?status=APPROVED");
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  const account = await within(dossier).findByRole("region", { name: "Quyết định tài khoản" });
  await user.click(within(account).getByRole("button", { name: "Duyệt tài khoản" }));
  expect(within(account).getByRole("button", { name: "Duyệt tài khoản" })).toBeDisabled();
  expect(within(dossier).getByRole("button", { name: "Đóng hồ sơ" })).toBeDisabled();
  await user.click(within(account).getByRole("button", { name: "Duyệt tài khoản" }));
  expect(api.verifyDriver).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); });
  await waitFor(() => expect(within(account).getByRole("status", { name: "Trạng thái tài khoản" })).toHaveTextContent("Đã duyệt"));
});

it("keeps an account awaiting verification in the queue after all papers were approved", async () => {
  driver.documents.forEach(doc => { doc.verificationStatus = "APPROVED"; });
  vi.mocked(api.drivers).mockImplementation(async () => page(driver.driver.verificationStatus === "PENDING" ? [driver.driver] : []));
  const user = renderDocuments();
  await user.click(await screen.findByRole("button", { name: "Xem và duyệt" }));
  expect(screen.getByText("Chờ duyệt tài khoản")).toBeInTheDocument();
  const dossier = await screen.findByRole("dialog", { name: /Duyệt hồ sơ tài xế/ });
  const account = await within(dossier).findByRole("region", { name: "Quyết định tài khoản" });
  await user.click(within(account).getByRole("button", { name: "Duyệt tài khoản" }));
  await waitFor(() => expect(within(account).getByRole("status", { name: "Trạng thái tài khoản" })).toHaveTextContent("Đã duyệt"));
  await waitFor(() => expect(screen.queryByRole("button", { name: "Xem và duyệt" })).not.toBeInTheDocument());
  expect(api.review).not.toHaveBeenCalled();
});

it("does not create a review request for a pending account that has submitted no papers", async () => {
  driver.documents = [];
  rows = [];
  vi.mocked(api.drivers).mockResolvedValue(page([driver.driver]));
  renderDocuments();
  expect(await screen.findByText("Không có dữ liệu phù hợp")).toBeInTheDocument();
  await waitFor(() => expect(api.driver).toHaveBeenCalledWith(41));
  expect(screen.queryByRole("button", { name: "Xem và duyệt" })).not.toBeInTheDocument();
});
