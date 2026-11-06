import { BadRequestException } from "@nestjs/common";
import { PasswordService } from "./password.service";

describe("PasswordService", () => {
  const service = new PasswordService();

  it("hashes and verifies a password without storing it in plaintext", async () => {
    const password = "strong password 123";
    const hash = await service.hash(password);

    expect(hash).toMatch(/^scrypt\$v1\$32768\$8\$1\$/);
    expect(hash).not.toContain(password);
    await expect(service.verify(password, hash)).resolves.toBe(true);
    await expect(service.verify("different password", hash)).resolves.toBe(
      false,
    );
  });

  it("rejects passwords outside the approved length bounds", async () => {
    await expect(service.hash("too short")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.hash("x".repeat(129))).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("rejects malformed or unsupported password hashes", async () => {
    await expect(service.verify("password", "not-a-hash")).resolves.toBe(false);
    await expect(
      service.verify(
        "password",
        "scrypt$v2$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ),
    ).resolves.toBe(false);
  });
});
