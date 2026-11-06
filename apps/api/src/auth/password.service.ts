import { BadRequestException, Injectable } from "@nestjs/common";
import {
  randomBytes,
  scrypt as callbackScrypt,
  timingSafeEqual,
} from "node:crypto";

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const VERSIONED_HASH_PREFIX = "scrypt$v1";
const DUMMY_HASH =
  "scrypt$v1$32768$8$1$MDEyMzQ1Njc4OWFiY2RlZg$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    callbackScrypt(
      password,
      salt,
      KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(derivedKey);
      },
    );
  });
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    this.validatePasswordLength(password);
    const salt = randomBytes(SALT_LENGTH);
    const derivedKey = await scrypt(password, salt);
    return [
      VERSIONED_HASH_PREFIX,
      SCRYPT_N,
      SCRYPT_R,
      SCRYPT_P,
      salt.toString("base64url"),
      derivedKey.toString("base64url"),
    ].join("$");
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    const parts = encodedHash.split("$");
    if (
      parts.length !== 7 ||
      `${parts[0]}$${parts[1]}` !== VERSIONED_HASH_PREFIX ||
      parts[2] !== String(SCRYPT_N) ||
      parts[3] !== String(SCRYPT_R) ||
      parts[4] !== String(SCRYPT_P)
    ) {
      return false;
    }

    const salt = Buffer.from(parts[5], "base64url");
    const expectedKey = Buffer.from(parts[6], "base64url");
    if (
      salt.length !== SALT_LENGTH ||
      expectedKey.length !== KEY_LENGTH ||
      salt.toString("base64url") !== parts[5] ||
      expectedKey.toString("base64url") !== parts[6]
    ) {
      return false;
    }

    const actualKey = await scrypt(password, salt);
    return timingSafeEqual(actualKey, expectedKey);
  }

  async verifyAgainstDummyHash(password: string): Promise<boolean> {
    return this.verify(password, DUMMY_HASH);
  }

  private validatePasswordLength(password: string): void {
    if (password.length < 12 || password.length > 128) {
      throw new BadRequestException(
        "Password must be between 12 and 128 characters.",
      );
    }
  }
}
