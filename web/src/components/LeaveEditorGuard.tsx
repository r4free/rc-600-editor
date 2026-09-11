import { useEffect, useRef, useState } from "react";

const KEY = "rc600LeaveGuard";

export function LeaveEditorGuard() {
  const [open, setOpen] = useState(false);
  const allowLeaveRef = useRef(false);
  const stayBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!(history.state && (history.state as Record<string, unknown>)[KEY])) {
      history.pushState({ [KEY]: true }, "", location.href);
    }
    const onPopState = () => {
      if (allowLeaveRef.current) return;
      history.pushState({ [KEY]: true }, "", location.href);
      setOpen(true);
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (allowLeaveRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (open) stayBtnRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => setOpen(false)}>
      <div className="modal-sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>Sair do editor?</h2>
        <p>O botão voltar sai do editor RC-600. Quer mesmo sair?</p>
        <div className="modal-foot">
          <button
            type="button"
            className="btn ghost"
            onClick={() => {
              allowLeaveRef.current = true;
              setOpen(false);
              history.go(-2);
            }}
          >
            Sair
          </button>
          <button ref={stayBtnRef} type="button" className="btn primary" onClick={() => setOpen(false)}>
            Ficar no editor
          </button>
        </div>
      </div>
    </div>
  );
}
