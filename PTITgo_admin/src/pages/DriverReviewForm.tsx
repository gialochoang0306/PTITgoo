import { Button, Form, Input, Select, Space } from "antd";
import { label } from "../lib/format";

export type ReviewDecision = {
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
};

export function DriverReviewForm({
  title, name, account = false, currentStatus, pending, disabled, onSubmit, onCancel,
}: {
  title: string;
  name: string;
  account?: boolean;
  currentStatus?: string;
  pending: boolean;
  disabled: boolean;
  onSubmit: (values: ReviewDecision) => void;
  onCancel?: () => void;
}) {
  const [form] = Form.useForm<ReviewDecision>();
  const decision = Form.useWatch("status", form) ?? "APPROVED";
  const alreadyApproved = account && decision === "APPROVED" && currentStatus === "APPROVED";
  const submitText = account
    ? decision === "REJECTED" ? "Từ chối tài khoản" : "Duyệt tài khoản"
    : "Lưu kết quả";
  return (
    <Form<ReviewDecision>
      form={form}
      name={name}
      className="driver-review-form"
      aria-label={title}
      layout="vertical"
      disabled={disabled}
      initialValues={{ status: "APPROVED" }}
      onFinish={(values) => {
        if (!disabled && !pending && !alreadyApproved) onSubmit({
          status: values.status,
          rejectionReason: values.status === "REJECTED" ? values.rejectionReason?.trim() : undefined,
        });
      }}
    >
      <Form.Item label={account ? "Quyết định tài khoản" : "Kết quả duyệt"} name="status" rules={[{ required: true }]}>
        <Select options={["APPROVED", "REJECTED"].map(value => ({ value, label: label(value) }))} />
      </Form.Item>
      {decision === "REJECTED" && (
        <Form.Item
          label={account ? "Lý do từ chối (nếu có)" : "Lý do từ chối"}
          name="rejectionReason"
          rules={[
            { required: !account, whitespace: true, message: "Nhập lý do từ chối giấy tờ." },
            { max: 1000 },
          ]}
        >
          <Input.TextArea rows={2} maxLength={1000} showCount />
        </Form.Item>
      )}
      <Space wrap>
        <Button
          type="primary"
          htmlType="submit"
          aria-label={submitText}
          loading={pending}
          disabled={disabled || pending || alreadyApproved}
        >
          {submitText}
        </Button>
        {onCancel && <Button disabled={disabled} onClick={onCancel}>Hủy</Button>}
      </Space>
    </Form>
  );
}
