import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isLocalUsbHost,
  listConnectedRolandVolumes,
  listMacRolandVolumes,
  parseEjectStdout,
} from "./usb-eject.js";

describe("usb eject helpers", () => {
  it("allows eject only on local editor hosts", () => {
    assert.equal(isLocalUsbHost("127.0.0.1:5191"), true);
    assert.equal(isLocalUsbHost("localhost:5190"), true);
    assert.equal(isLocalUsbHost("rc.test"), true);
    assert.equal(isLocalUsbHost("rc-600-editor.onrender.com"), false);
    assert.equal(isLocalUsbHost("127.0.0.1:5191", { RENDER: "true" }), false);
    assert.equal(isLocalUsbHost("127.0.0.1:5191", { RC600_DISABLE_USB_EJECT: "1" }), false);
  });

  it("parses ejected drive letters from PowerShell output", () => {
    assert.deepEqual(parseEjectStdout("NONE\n"), []);
    assert.deepEqual(parseEjectStdout("E:\r\nF:\n"), ["E:", "F:"]);
  });

  it("lists no Roland volumes on unsupported platforms", async () => {
    assert.deepEqual(await listConnectedRolandVolumes("linux"), []);
  });

  it("lists Windows removable Roland drives from PowerShell output", async () => {
    const volumes = await listConnectedRolandVolumes("win32", async () => ({
      stdout: "E:\r\nF:\n",
      stderr: "",
    }));
    assert.deepEqual(volumes, ["E:", "F:"]);
  });

  it("finds macOS volumes that contain ROLAND/DATA", () => {
    const volumes = listMacRolandVolumes(
      "/Volumes",
      (p) => p === "/Volumes" || p === "/Volumes/BOSS RC-600/ROLAND/DATA",
      () => ["Macintosh HD", "BOSS RC-600"],
    );
    assert.deepEqual(volumes, ["/Volumes/BOSS RC-600"]);
  });
});
