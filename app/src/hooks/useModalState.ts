import { useState, useCallback } from 'react';

export type ModalType = 'send' | 'receive' | 'earn' | 'settings' | null;

export const useModalState = () => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const openModal = useCallback((modalType: Exclude<ModalType, null>) => {
    setActiveModal(modalType);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal(null);
  }, []);

  const isModalOpen = useCallback((modalType: Exclude<ModalType, null>) => {
    return activeModal === modalType;
  }, [activeModal]);

  return {
    activeModal,
    openModal,
    closeModal,
    isModalOpen
  };
};