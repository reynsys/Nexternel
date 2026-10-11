import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** When true (default), the confirm button uses error styling. */
  destructive?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (accepted: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback((accepted: boolean) => {
    setPending((current) => {
      current?.resolve(accepted);
      return null;
    });
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  const destructive = pending?.destructive !== false;

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        open={Boolean(pending)}
        onClose={() => close(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{pending?.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{pending?.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => close(false)}>{pending?.cancelLabel ?? "Cancel"}</Button>
          <Button
            variant="contained"
            color={destructive ? "error" : "primary"}
            onClick={() => close(true)}
            autoFocus
          >
            {pending?.confirmLabel ?? "Confirm"}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return ctx;
}
