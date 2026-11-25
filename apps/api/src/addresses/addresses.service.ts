import { Injectable } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AddressResponse } from "./address.types";
import { CreateAddressDto } from "./dto/create-address.dto";

const ADDRESS_SELECT = {
  id: true,
  label: true,
  recipientName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  region: true,
  postalCode: true,
  countryCode: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AddressSelect;

type AddressRecord = Prisma.AddressGetPayload<{ select: typeof ADDRESS_SELECT }>;

function addressResponse(address: AddressRecord): AddressResponse {
  return {
    id: address.id,
    label: address.label,
    recipientName: address.recipientName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    countryCode: address.countryCode,
    isDefault: address.isDefault,
    createdAt: address.createdAt,
    updatedAt: address.updatedAt,
  };
}

@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: CreateAddressDto,
  ): Promise<AddressResponse> {
    const address = await this.prisma.address.create({
      data: { ...input, userId },
      select: ADDRESS_SELECT,
    });
    return addressResponse(address);
  }

  async list(userId: string): Promise<AddressResponse[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      select: ADDRESS_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return addresses.map(addressResponse);
  }
}
