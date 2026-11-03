import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  App,
  Button,
  Descriptions,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { api } from "../lib/api";
import { date, label, money, text } from "../lib/format";
import { useAction, useFilters } from "../lib/hooks";
import {
  DataTable,
  Heading,
  InvalidRecord,
  Loading,
  Panel,
  Photo,
  QueryError,
  Refresh,
  Status,
} from "../components/common";
import type { Driver, Skill } from "../types";
import { loadDocumentApplications, type DriverApplication } from "./documentApplications";
import { DriverDocumentsDrawer } from "./DriverDocumentsDrawer";

const verificationOptions = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
].map((value) => ({ value, label: label(value) }));
const booleanOptions = [
  { value: "true", label: "Có" },
  { value: "false", label: "Không" },
];
export function Drivers() {
  const f = useFilters();
  const location = useLocation();
  const params = {
    ...f.params,
    search: f.read("search"),
    verification_status: f.read("verification_status"),
    online: f.read("online"),
    flagged: f.read("flagged"),
  };
  const query = useQuery({
    queryKey: ["admin", "drivers", params],
    queryFn: () => api.drivers(params),
  });
  const columns: ColumnsType<Driver> = [
    {
      title: "Tài xế",
      dataIndex: "fullName",
      width: 210,
      render: (value, r) => (
        <>
          <Link
            to={`/drivers/${r.id}`}
            state={{ from: location.pathname + location.search }}
          >
            {value || `Tài xế #${r.id}`}
          </Link>
          <div className="muted">
            #{r.id} · {r.phoneNumber}
          </div>
        </>
      ),
    },
    {
      title: "Xác minh",
      dataIndex: "verificationStatus",
      render: (v) => <Status value={v} />,
    },
    {
      title: "Hoạt động",
      dataIndex: "status",
      render: (v) => <Status value={v} />,
    },
    {
      title: "Đánh dấu",
      dataIndex: "flagged",
      render: (v) => (v ? <Tag color="gold">Có đánh dấu</Tag> : "Không"),
    },
    { title: "Tổng chuyến", dataIndex: "totalTrips" },
    { title: "Đánh giá", dataIndex: "averageRating", render: text },
    { title: "Số dư thu nhập", dataIndex: "incomeBalance", render: money },
    { title: "Ngày tạo", dataIndex: "createdAt", render: date },
  ];
  return (
    <>
      <Heading
        title="Quản lý tài xế"
        subtitle="Tra cứu hồ sơ, tình trạng xác minh và hoạt động."
        actions={
          <Refresh
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          />
        }
      />
      <div className="filters">
        <Input.Search
          key={f.read("search")}
          defaultValue={f.read("search")}
          aria-label="Tìm tài xế"
          placeholder="Tên hoặc số điện thoại"
          enterButton="Tìm"
          onSearch={(search) => f.update({ search: search.trim() })}
        />
        <Select
          allowClear
          aria-label="Xác minh tài xế"
          placeholder="Tất cả xác minh"
          value={f.read("verification_status") || undefined}
          options={verificationOptions}
          onChange={(v) => f.update({ verification_status: v })}
        />
        <Select
          allowClear
          aria-label="Kết nối tài xế"
          placeholder="Tất cả kết nối"
          value={f.read("online") || undefined}
          options={[
            { value: "true", label: "Đang kết nối (kể cả bận)" },
            { value: "false", label: "Ngoại tuyến" },
          ]}
          onChange={(v) => f.update({ online: v })}
        />
        <Select
          allowClear
          aria-label="Đánh dấu tài xế"
          placeholder="Đánh dấu"
          value={f.read("flagged") || undefined}
          options={booleanOptions}
          onChange={(v) => f.update({ flagged: v })}
        />
      </div>
      <QueryError error={query.error} retry={() => void query.refetch()} />
      <Panel>
        <DataTable
          columns={columns}
          data={query.data}
          loading={query.isPending}
          onPage={(page, size) => f.update({ page, size }, false)}
          scroll={1150}
        />
      </Panel>
    </>
  );
}

export function Documents() {
  const f = useFilters();
  const [application, setApplication] = useState<DriverApplication>();
  const status = f.read("status", "PENDING");
  const query = useQuery({
    queryKey: ["admin", "documents", "applications", status],
    queryFn: () => loadDocumentApplications(status),
  });
  const applications = query.data ?? [];
  const totalPages = Math.ceil(applications.length / f.size);
  const page = Math.min(f.page, Math.max(0, totalPages - 1));
  const columns: ColumnsType<DriverApplication> = [
    {
      title: "Tài xế",
      width: 200,
      render: (_, row) => (
        <>
          <Link to={`/drivers/${row.id}`}>
            {row.driverName || `Tài xế #${row.id}`}
          </Link>
          <div className="muted">#{row.id} · {row.driverPhone}</div>
        </>
      ),
    },
    {
      title: "Giấy tờ",
      render: (_, row) => (
        <>
          <Typography.Paragraph>{row.documents.length} giấy tờ</Typography.Paragraph>
          <Space size={[0, 8]} wrap>
            {row.documents.map(doc => <Tag key={doc.id}>{label(doc.documentType)}</Tag>)}
          </Space>
        </>
      ),
    },
    {
      title: "Trạng thái xử lý",
      render: (_, row) => row.waitingForAccount ? <Tag color="gold">Chờ duyệt tài khoản</Tag> : <Status value={status} />,
    },
    { title: "Ngày gửi", render: (_, row) => date(row.createdAt) },
    {
      title: "Thao tác",
      render: (_, row) => (
        <Button size="small" onClick={() => setApplication(row)}>
          Xem và duyệt
        </Button>
      ),
    },
  ];
  return (
    <>
      <Heading
        title="Duyệt hồ sơ tài xế"
        subtitle="Mỗi tài xế một hồ sơ. Kiểm tra giấy tờ, kỹ năng và duyệt tài khoản trong cùng cửa sổ."
        actions={
          <Refresh
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          />
        }
      />
      <div className="filters">
        <Select
          aria-label="Trạng thái xử lý hồ sơ"
          value={status}
          options={["PENDING", "APPROVED", "REJECTED"].map((value) => ({
            value,
            label: label(value),
          }))}
          onChange={(status) => f.update({ status })}
        />
      </div>
      <QueryError error={query.error} retry={() => void query.refetch()} />
      <Panel>
        <DataTable
          data={
            query.data
              ? {
                  content: applications.slice(page * f.size, (page + 1) * f.size),
                  page,
                  size: f.size,
                  totalElements: applications.length,
                  totalPages,
                  hasNext: page + 1 < totalPages,
                }
              : undefined
          }
          columns={columns}
          loading={query.isPending}
          onPage={(page, size) => f.update({ page, size }, false)}
          scroll={900}
        />
      </Panel>
      {application && (
        <DriverDocumentsDrawer
          application={application}
          onClose={() => setApplication(undefined)}
        />
      )}
    </>
  );
}

export function DriverDetailPage() {
  const id = Number(useParams().id);
  const valid = Number.isSafeInteger(id) && id > 0;
  const location = useLocation();
  const f = useFilters();
  const { modal } = App.useApp();
  const [review, setReview] = useState<number | null>();
  const query = useQuery({
    queryKey: ["admin", "driver", id],
    queryFn: () => api.driver(id),
    enabled: valid,
  });
  const offline = useAction<void>(() => api.offline(id));
  if (!valid) return <InvalidRecord />;
  if (query.isPending) return <Loading />;
  if (!query.data)
    return (
      <QueryError error={query.error} retry={() => void query.refetch()} />
    );
  const { driver, documents, skills } = query.data;
  const skillColumns: ColumnsType<Skill> = [
    { title: "Loại xe", dataIndex: "vehicleType", render: label },
    { title: "Hộp số", dataIndex: "transmission", render: label },
    { title: "Hạng bằng", dataIndex: "licenseClass", render: text },
    {
      title: "Xác minh",
      dataIndex: "verified",
      render: (v) => (
        <Tag color={v ? "green" : "default"}>
          {v ? "Đã xác minh" : "Chưa xác minh"}
        </Tag>
      ),
    },
    {
      title: "Thao tác",
      render: () => (
        <Button
          size="small"
          onClick={() => setReview(null)}
        >
          Xem và duyệt
        </Button>
      ),
    },
  ];
  return (
    <>
      <Link className="back-link" to={location.state?.from || "/drivers"}>
        <ArrowLeftOutlined /> Quay lại danh sách
      </Link>
      <Heading
        title={driver.fullName || `Tài xế #${id}`}
        subtitle={`Mã tài xế #${id} · ${driver.phoneNumber}`}
        actions={
          <>
            <Status value={driver.verificationStatus} />
            <Refresh
              loading={query.isFetching}
              onClick={() => void query.refetch()}
            />
            <Button
              type="primary"
              onClick={() => setReview(null)}
            >
              Xem và duyệt hồ sơ
            </Button>
            <Button
              danger
              disabled={driver.status === "OFFLINE"}
              loading={offline.isPending}
              onClick={() =>
                modal.confirm({
                  title: "Ép tài xế ngoại tuyến?",
                  content:
                    "Tài xế sẽ bị loại khỏi danh sách khả dụng nhận chuyến. Thao tác này không hủy chuyến đang thực hiện.",
                  okText: "Ép offline",
                  cancelText: "Đóng",
                  okButtonProps: { danger: true },
                  onOk: () => offline.mutateAsync(),
                })
              }
            >
              Ép offline
            </Button>
          </>
        }
      />
      <QueryError error={query.error} retry={() => void query.refetch()} />
      <Tabs
        activeKey={
          ["profile", "documents", "skills"].includes(f.read("tab", "profile"))
            ? f.read("tab", "profile")
            : "profile"
        }
        onChange={(tab) => f.update({ tab }, false)}
        items={[
          {
            key: "profile",
            label: "Hồ sơ",
            children: (
              <div className="detail-grid">
                <Panel title="Thông tin tài xế">
                  <Descriptions
                    column={1}
                    items={[
                      {
                        key: "email",
                        label: "Email",
                        children: text(driver.email),
                      },
                      {
                        key: "phone",
                        label: "Số điện thoại",
                        children: driver.phoneNumber,
                      },
                      {
                        key: "status",
                        label: "Hoạt động",
                        children: <Status value={driver.status} />,
                      },
                      {
                        key: "flag",
                        label: "Đánh dấu",
                        children: driver.flagged ? "Có đánh dấu" : "Không",
                      },
                      {
                        key: "created",
                        label: "Ngày tạo",
                        children: date(driver.createdAt),
                      },
                    ]}
                  />
                </Panel>
                <Panel title="Chỉ số và số dư">
                  <Descriptions
                    column={1}
                    items={[
                      {
                        key: "trips",
                        label: "Tổng chuyến",
                        children: driver.totalTrips,
                      },
                      {
                        key: "rating",
                        label: "Đánh giá trung bình",
                        children: text(driver.averageRating),
                      },
                      {
                        key: "acceptance",
                        label: "Tỷ lệ nhận chuyến",
                        children: text(driver.acceptanceRate),
                      },
                      {
                        key: "completion",
                        label: "Tỷ lệ hoàn thành",
                        children: text(driver.completionRate),
                      },
                      {
                        key: "cancel",
                        label: "Tỷ lệ hủy 30 ngày",
                        children: text(driver.cancelRate30d),
                      },
                      {
                        key: "credit",
                        label: "Số dư tín dụng",
                        children: money(driver.creditBalance),
                      },
                      {
                        key: "income",
                        label: "Số dư thu nhập",
                        children: money(driver.incomeBalance),
                      },
                    ]}
                  />
                </Panel>
              </div>
            ),
          },
          {
            key: "documents",
            label: `Giấy tờ (${documents.length})`,
            children: (
              <Panel>
                {documents.length ? (
                  documents.map((doc) => (
                    <div key={doc.id} className="document-card">
                      <Photo
                        url={doc.secureUrl}
                        alt={label(doc.documentType)}
                      />
                      <div className="document-info">
                        <strong>{label(doc.documentType)}</strong>{" "}
                        {!doc.isCurrent && <Tag>Bản cũ</Tag>}
                        <p>
                          Số: {text(doc.documentNumber)} · Hết hạn:{" "}
                          {date(doc.expiresAt)}
                        </p>
                        <Status value={doc.verificationStatus} />
                        {doc.rejectionReason && (
                          <p>Lý do: {doc.rejectionReason}</p>
                        )}
                        <p>
                          Gửi: {date(doc.createdAt)} · Duyệt:{" "}
                          {date(doc.reviewedAt)}
                        </p>
                      </div>
                      <Button
                        size="small"
                        disabled={!doc.isCurrent}
                        onClick={() => setReview(doc.id)}
                      >
                        Xem và duyệt
                      </Button>
                    </div>
                  ))
                ) : (
                  <Typography.Text type="secondary">
                    Chưa có giấy tờ.
                  </Typography.Text>
                )}
              </Panel>
            ),
          },
          {
            key: "skills",
            label: `Kỹ năng (${skills.length})`,
            children: (
              <Panel>
                <Table
                  rowKey="id"
                  columns={skillColumns}
                  dataSource={skills}
                  pagination={false}
                  scroll={{ x: 650 }}
                  locale={{ emptyText: "Chưa có kỹ năng" }}
                />
              </Panel>
            ),
          },
        ]}
      />
      {review !== undefined && (
        <DriverDocumentsDrawer
          application={{ id, driverName: driver.fullName, driverPhone: driver.phoneNumber }}
          initialDocumentId={review ?? undefined}
          onClose={() => setReview(undefined)}
        />
      )}
    </>
  );
}
