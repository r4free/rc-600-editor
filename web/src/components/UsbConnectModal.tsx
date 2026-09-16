import { Modal } from "./Modal";
import { Icon } from "./Icon";

export function UsbConnectModal({
  onClose,
  onOpenFolder,
}: {
  onClose: () => void;
  onOpenFolder: () => void | Promise<void>;
}) {
  return (
    <Modal
      title="Connect to USB"
      onClose={onClose}
      foot={
        <>
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn primary" onClick={() => void onOpenFolder()}>
            <Icon name="folderOpen" size={14} />
            Open ROLAND folder
          </button>
        </>
      }
    >
      <p>
        Put the RC-600 in USB Storage, then open the ROLAND folder. This editor cannot turn Storage
        on for you.
      </p>
      <ol className="usb-connect-steps">
        <li>
          On the pedal: <strong>MENU → USB → STORAGE ON</strong>
        </li>
        <li>Wait until the display shows CONNECTING… and the RC-600 drive appears on this computer.</li>
        <li>Open the ROLAND folder here (or the DATA folder inside it).</li>
      </ol>
      <p>
        Browsers cannot reliably send that USB Storage command to the pedal, and any such shortcut
        would be Windows-only. Use the pedal menu so this works the same on every computer.
      </p>
    </Modal>
  );
}
