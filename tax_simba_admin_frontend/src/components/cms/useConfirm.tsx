"use client";

import { useState } from "react";

type ConfirmOptions = {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "danger" | "default";
};

import ConfirmationModal from "@/components/ConfirmationModal";

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<(v: boolean) => void>();

  const confirm = (opts: ConfirmOptions) =>
    new Promise<boolean>((resolve) => {
      setOptions(opts);
      setResolver(() => resolve);
    });

  const close = (result: boolean) => {
    resolver?.(result);
    setOptions(null);
  };

  const ConfirmUI = options ? (
    <ConfirmationModal
      isOpen={!!options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
      title={options.title ?? "Confirm"}
      confirmationText={options.message ?? "Are you sure?"}
      confirmBtnText={options.confirmText ?? "Confirm"}
      isDanger={options.tone === "danger"}
    />
  ) : null;

  return { confirm, ConfirmUI };
}
