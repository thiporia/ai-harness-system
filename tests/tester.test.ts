import fs from "fs";
import { afterEach, describe, expect, it } from "vitest";
import { tester } from "../src/agents/tester.js";

const ARTIFACT_DIR = "./artifacts";
const APP_FILE = `${ARTIFACT_DIR}/App.tsx`;

afterEach(() => {
  try {
    if (fs.existsSync(APP_FILE)) {
      fs.unlinkSync(APP_FILE);
    }
  } catch {
    // ignore cleanup errors in constrained environments
  }
});

describe("tester", () => {
  it("passes when useState exists", async () => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(APP_FILE, "import { useState } from 'react';");

    const result = await tester();
    expect(result).toEqual({ success: true });
  });

  it("fails with logs when useState does not exist", async () => {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
    fs.writeFileSync(APP_FILE, "export default function App() { return null; }");

    const result = await tester();
    expect(result.success).toBe(false);
    expect(result.logs).toBe("useState not found");
  });
});
