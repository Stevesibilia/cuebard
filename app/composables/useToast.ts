export type ToastKind = 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

let nextToastId = 1;

/**
 * Non-blocking messages shown by ToastHost. Unlike alert(), a toast does not
 * stop the renderer thread, so cue timers keep running while it is on screen.
 */
export const useToast = () => {
  const toasts = useState<Toast[]>('toasts', () => []);

  const dismissToast = (id: number) => {
    toasts.value = toasts.value.filter(toast => toast.id !== id);
  };

  const showToast = (message: string, kind: ToastKind = 'error', ms = 6000) => {
    const id = nextToastId++;
    toasts.value.push({ id, message, kind });
    setTimeout(() => dismissToast(id), ms);
  };

  return { toasts, showToast, dismissToast };
};
