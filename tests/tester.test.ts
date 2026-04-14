import fs from "fs";
import { afterEach, describe, expect, it } from "vitest";
import { tester } from "../src/agents/tester.js";

const TMP_DIR = "./tests/.tmp";
const APP_FILE = `${TMP_DIR}/App.tsx`;

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
  it("passes when minimum app checks are satisfied", async () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(
      APP_FILE,
      `
import { useState } from "react";
export default function App() {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const handleDelete = () => setText("");
  const handleToggle = () => setDone((v) => !v);
  return (
    <div>
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button>Add</button>
      <button onClick={handleDelete}>Delete</button>
      <button onClick={handleToggle}>{done ? "Done" : "Toggle"}</button>
    </div>
  );
}
`.trim()
    );

    const result = await tester(APP_FILE);
    expect(result).toEqual({ success: true });
  });

  it("fails for trivial null app", async () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(APP_FILE, "export default function App() { return null; }");

    const result = await tester(APP_FILE);
    expect(result.success).toBe(false);
    expect(result.logs).toContain("not trivial null app");
  });
});
