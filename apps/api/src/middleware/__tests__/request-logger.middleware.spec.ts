import { redactUrlForLog } from "../request-logger.middleware";

// Finding a90ddcdd: invite and survey tokens are the whole security of their
// routes and were being written to the HTTP log line.
describe("redactUrlForLog", () => {
  it("hides the family invite token (preview and accept)", () => {
    expect(redactUrlForLog("/api/family/invites/3f9c0a1b2c3d4e5f6a7b8c9d0e1f2a3b")).toBe("/api/family/invites/[redacted]");
    expect(redactUrlForLog("/api/family/invites/3f9c0a1b2c3d4e5f/accept")).toBe("/api/family/invites/[redacted]/accept");
  });
  it("hides the public survey token", () => {
    expect(redactUrlForLog("/api/survey/abcDEF123")).toBe("/api/survey/[redacted]");
    expect(redactUrlForLog("/api/survey/abcDEF123/submit")).toBe("/api/survey/[redacted]/submit");
  });
  it("drops the query string entirely", () => {
    expect(redactUrlForLog("/api/users?email=jane@example.com&token=xyz")).toBe("/api/users");
  });
  it("leaves ordinary paths alone", () => {
    expect(redactUrlForLog("/api/family/group")).toBe("/api/family/group");
    expect(redactUrlForLog("/health")).toBe("/health");
    expect(redactUrlForLog("/api/persons/42/survey")).toBe("/api/persons/42/survey");
  });
});
