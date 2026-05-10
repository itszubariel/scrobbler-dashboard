import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

export type ModalType = "artist" | "track" | "album" | "genre";

interface ModalState {
  type: ModalType;
  name: string;
  artist?: string;
  username: string;
}

interface ModalContextValue {
  modal: ModalState | null;
  openModal: (type: ModalType, name: string, artist?: string) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue>({
  modal: null,
  openModal: () => {},
  closeModal: () => {},
});

interface ProviderProps {
  children: ReactNode;
  username: string;
}

export function ModalProvider({ children, username }: ProviderProps) {
  const [modal, setModal] = useState<ModalState | null>(null);

  function openModal(type: ModalType, name: string, artist?: string) {
    setModal({ type, name, artist, username });
  }

  function closeModal() {
    setModal(null);
  }

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal }}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
