import { describe, expect, it } from "vitest";
import { parseJsonResponse } from "../src/utils/json.js";

describe("parseJsonResponse", () => {
  it("parses plain JSON", () => {
    const raw = '{"ok":true,"items":[1,2]}';
    const result = parseJsonResponse<{ ok: boolean; items: number[] }>(raw);
    expect(result.ok).toBe(true);
    expect(result.items).toEqual([1, 2]);
  });

  it("parses fenced JSON", () => {
    const raw = "```json\n{\n  \"name\": \"planner\"\n}\n```";
    const result = parseJsonResponse<{ name: string }>(raw);
    expect(result.name).toBe("planner");
  });

  it("throws on invalid payload", () => {
    expect(() => parseJsonResponse("not-json")).toThrowError(
      "Could not parse JSON response from LLM."
    );
  });
});

