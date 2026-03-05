declare module "yookassa" {
  interface YooKassaConfig {
    shopId: string;
    secretKey: string;
    apiUrl?: string;
    debug?: boolean;
    timeout?: number;
    retryDelay?: number;
  }

  interface PaymentAmount {
    value: string;
    currency: string;
  }

  interface PaymentConfirmation {
    type: string;
    return_url?: string;
    confirmation_url?: string;
  }

  interface ReceiptItem {
    description: string;
    quantity: string;
    amount: PaymentAmount;
    vat_code: number;
    payment_subject?: string;
    payment_mode?: string;
  }

  interface Receipt {
    customer: { email?: string; phone?: string };
    items: ReceiptItem[];
  }

  interface CreatePaymentPayload {
    amount: PaymentAmount;
    capture?: boolean;
    confirmation?: PaymentConfirmation;
    description?: string;
    metadata?: Record<string, string>;
    receipt?: Receipt;
  }

  interface Payment {
    id: string;
    status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
    amount: PaymentAmount;
    confirmation?: PaymentConfirmation;
    metadata?: Record<string, string>;
    isPending: boolean;
    isWaitingForCapture: boolean;
    isSucceeded: boolean;
    isCanceled: boolean;
    isResolved: boolean;
    confirmationUrl?: string;
  }

  class YooKassa {
    constructor(config: YooKassaConfig);
    createPayment(
      payload: CreatePaymentPayload,
      idempotenceKey?: string
    ): Promise<Payment>;
    getPayment(paymentId: string, idempotenceKey?: string): Promise<Payment>;
    capturePayment(
      paymentId: string,
      amount: PaymentAmount,
      idempotenceKey?: string
    ): Promise<Payment>;
    cancelPayment(
      paymentId: string,
      idempotenceKey?: string
    ): Promise<Payment>;
  }

  export = YooKassa;
}
