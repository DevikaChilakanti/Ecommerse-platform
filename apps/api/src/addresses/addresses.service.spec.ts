import { PrismaService } from "../prisma/prisma.service";
import { AddressesService } from "./addresses.service";
import { CreateAddressDto } from "./dto/create-address.dto";

describe("AddressesService", () => {
  const prisma = {
    address: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };
  const service = new AddressesService(prisma as unknown as PrismaService);
  const address = {
    id: "address-id",
    label: "Home",
    recipientName: "Ada Customer",
    phone: "555-0100",
    line1: "1 Main Street",
    line2: null,
    city: "Exampleville",
    region: "CA",
    postalCode: "90210",
    countryCode: "US",
    isDefault: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.address.create.mockResolvedValue(address);
    prisma.address.findMany.mockResolvedValue([address]);
  });

  it("creates an address for the authenticated customer only", async () => {
    const input = {
      label: "Home",
      recipientName: "Ada Customer",
      phone: "555-0100",
      line1: "1 Main Street",
      city: "Exampleville",
      region: "CA",
      postalCode: "90210",
      countryCode: "US",
    } satisfies CreateAddressDto;

    const result = await service.create("customer-id", input);

    expect(prisma.address.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ...input, userId: "customer-id" },
      }),
    );
    expect(result.id).toBe("address-id");
    expect(result).not.toHaveProperty("userId");
    expect(prisma.address.create.mock.calls[0][0].data).not.toHaveProperty(
      "isDefault",
    );
  });

  it("lists addresses filtered to the authenticated customer", async () => {
    await expect(service.list("customer-id")).resolves.toEqual([address]);
    expect(prisma.address.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "customer-id" } }),
    );
  });
});
