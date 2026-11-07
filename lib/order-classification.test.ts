import { describe, expect, it } from "vitest";
import { classifyOrderType, normalizeDocument } from "@/lib/order-classification";

describe("classifyOrderType", () => {
  const expirationDate = new Date("2026-11-10T12:00:00.000Z");

  it("classifica como Venda Nova quando não há certificado anterior", () => {
    expect(classifyOrderType(new Date("2026-11-01T00:00:00.000Z"))).toBe("VENDA_NOVA");
  });

  it("classifica como Renovado quando a compra é antes do vencimento", () => {
    expect(classifyOrderType(new Date("2026-11-09T00:00:00.000Z"), expirationDate)).toBe("RENOVADO");
  });

  it("classifica como Renovado quando a compra é no vencimento", () => {
    expect(classifyOrderType(new Date("2026-11-10T00:00:00.000Z"), expirationDate)).toBe("RENOVADO");
  });

  it("classifica como Venda Nova quando a compra é depois do vencimento", () => {
    expect(classifyOrderType(new Date("2026-11-11T00:00:00.000Z"), expirationDate)).toBe("VENDA_NOVA");
  });
});

describe("normalizeDocument", () => {
  it("remove caracteres de formatação de CPF e CNPJ", () => {
    expect(normalizeDocument("529.982.247-25")).toBe("52998224725");
    expect(normalizeDocument("11.222.333/0001-81")).toBe("11222333000181");
  });
});
