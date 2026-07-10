import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "../email.service";

describe("EmailService", () => {
  let service: EmailService;
  let sendMock: jest.Mock;
  const ORIGINAL_RESEND_API_KEY = process.env.RESEND_API_KEY;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = "re_test_fake_key";

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get(EmailService);

    sendMock = jest.fn();
    // EmailService constructs its own Resend client internally (no DI seam),
    // so swap the private client's `emails.send` directly for the test double.
    (service as unknown as { resend: { emails: { send: jest.Mock } } }).resend = {
      emails: { send: sendMock },
    };
  });

  afterEach(() => {
    if (ORIGINAL_RESEND_API_KEY === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = ORIGINAL_RESEND_API_KEY;
  });

  // The Resend SDK resolves normally with `{ data: null, error }` on
  // delivery failure — it never rejects/throws. Every send path must
  // explicitly check for that error, or a failed send is indistinguishable
  // from a successful one to the caller.
  describe("surfacing Resend delivery failures", () => {
    it("sendOtpCode throws when Resend reports an error", async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { message: "Domain not verified", statusCode: 403, name: "validation_error" },
      });

      await expect(service.sendOtpCode("user@example.com", "123456")).rejects.toThrow(
        /Domain not verified/,
      );
    });

    it("sendSurveyInvite throws when Resend reports an error", async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { message: "Rate limited", statusCode: 429, name: "rate_limit_exceeded" },
      });

      await expect(
        service.sendSurveyInvite("recipient@example.com", "Jasper", "Alice", "tok"),
      ).rejects.toThrow(/Rate limited/);
    });

    it("sendFamilyInvite throws when Resend reports an error", async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { message: "Invalid recipient", statusCode: 422, name: "validation_error" },
      });

      await expect(
        service.sendFamilyInvite("recipient@example.com", "Jasper", "The Smiths", "tok"),
      ).rejects.toThrow(/Invalid recipient/);
    });

    it("sendPaymentFailedEmail throws when Resend reports an error", async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { message: "Bounced", statusCode: 400, name: "validation_error" },
      });

      await expect(service.sendPaymentFailedEmail("user@example.com")).rejects.toThrow(/Bounced/);
    });

    it("does not throw when Resend reports success", async () => {
      sendMock.mockResolvedValue({ data: { id: "email_123" }, error: null });

      await expect(
        service.sendSurveyInvite("recipient@example.com", "Jasper", "Alice", "tok"),
      ).resolves.toBeUndefined();
    });
  });

  describe("dev mode (no RESEND_API_KEY)", () => {
    it("logs instead of sending and never touches the Resend client", async () => {
      delete process.env.RESEND_API_KEY;
      const module: TestingModule = await Test.createTestingModule({
        providers: [EmailService],
      }).compile();
      const devService = module.get(EmailService);

      await expect(devService.sendOtpCode("user@example.com", "123456")).resolves.toBeUndefined();
    });
  });
});
